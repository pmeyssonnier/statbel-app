/*
 * Test de non-régression — blocs d'analyse pilotés par majStats (Convertisseur).
 *
 * On construit un petit résultat SYNTHÉTIQUE (données factices, aucune donnée
 * réelle) et on appelle majStats() pour exercer le rendu réel des blocs récents :
 *  - Tranches d'âge : 5 barres, cliquables → drill-down treemap des nationalités ;
 *  - Ratio de dépendance : donut + ligne « ratio » ;
 *  - Complétude des contacts : barres téléphone/email/joignable ;
 *  - titre « Tranches d'âge » sans « LFS ».
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-blocks.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await p.waitForTimeout(250);

  const r = await p.evaluate(() => {
    const out = {};
    const mk = (hh, mb, cn, sexe, age, nat, gsm, email, mrtl) => ({
      nr_hh: hh, nr_membre: mb, fl_cntct: cn, ordre: hh, prenom: 'T', nom: 'X', adresse: 'R 1, 1000',
      sexe, age: String(age), nationality: nat, birth_country: 'BEL', birth_commune: 'BXL', birth_region: 'BRU',
      marital_status: mrtl || 'Single', gsm: gsm || '', email: email || '', taille_menage: '2', nb_cibles: '1',
    });
    // 2 ménages : 2 mineurs (10, 12), 1 âgé implicite non → adultes 40/30 ; 1 tél, 1 mail
    const membres = [
      mk('1', '1', '1', 'M', 10, 'BEL', '+32470', '', 'Single'),
      mk('1', '2', '0', 'F', 40, 'FRA', '', '', 'Married'),
      mk('2', '1', '1', 'F', 70, 'TUR', '', 'a@b.be', 'Widowed'),
      mk('2', '2', '0', 'M', 30, 'BEL', '', '', 'Single'),
    ];
    const res = {
      outMembres: membres, outCibles: membres.filter(m => m.fl_cntct === '1'),
      tailleHH: { '1': 2, '2': 2 }, srcRows: membres,
      adminCols: { NR_YEAR: '2026', NR_WAVE: '1', NR_SEQ: '1', NR_REF_WK: '36', NR_GRP: '12305' },
      grpId: '2026-12305', localisation: 'TEST',
    };
    _resultat = res;   // affecte le binding global `let _resultat` (lu par majMenagesCartes)
    if (typeof statsScope !== 'undefined') statsScope = 'membres';
    try { majStats(res); } catch (e) { out.threw = String((e && e.message) || e); return out; }

    // Squelette commun : chaque bloc du registre a peuplé son conteneur (non vide).
    const BLOC_ELS = ['statsTreemap', 'statsCont', 'statsEU', 'statsMrtl', 'statsSexe', 'statsCommune',
      'statsAge', 'statsAgeLFS', 'statsDepend', 'statsTaille', 'statsCiblesHH', 'statsCompoHH', 'statsContact', 'statsSankey'];
    out.blocsVides = BLOC_ELS.filter(id => !((document.getElementById(id) || {}).innerHTML || '').trim().length);

    out.ageBars = document.querySelectorAll('#statsAgeLFS .bar-row').length;
    out.ageClickable = !!document.querySelector('#statsAgeLFS .bar-row[onclick]');
    out.titreSansLFS = !/LFS/.test(document.querySelector('[data-block="ageLFS"] .card-titre').textContent);
    // Drill-down : clic sur la tranche 0–14 → treemap nationalités
    zoomAgeLFS('0_14');
    out.drillTreemap = !!document.getElementById('statsAgeLFSTM')
      && document.getElementById('statsAgeLFSDetail').innerHTML.length > 0;
    // Fermeture du drill
    document.getElementById('statsAgeLFSDetail').innerHTML = '';
    out.drillClosed = document.getElementById('statsAgeLFSDetail').innerHTML === '';
    // Ratio de dépendance : 2 dépendants (10, 70) / 2 actifs (40, 30) = 100 %
    out.dependRatio = document.getElementById('statsDependDetail').textContent;
    out.dependDonut = document.getElementById('statsDepend').innerHTML.length > 0;
    // Complétude : 3 barres
    out.contactBars = document.querySelectorAll('#statsContact .bar-row').length;
    // « Personnes à interroger (≥N) par ménage » : titre dynamique + drill-down
    out.chhTitle = document.getElementById('titreCiblesHH').textContent;
    out.chhClickable = !!document.querySelector('#statsCiblesHH .bar-row[onclick]');
    out.chhBarLabel = (document.querySelector('#statsCiblesHH .bar-lbl') || {}).textContent || '';
    zoomCibles('1');
    out.chhDrill = !!document.getElementById('statsCiblesHHTM')
      && document.getElementById('statsCiblesHHDetail').innerHTML.length > 0;
    // Table ménage (accordéon) : drapeaux pays + icônes sexe/état civil (Unicode, hors-ligne)
    renderCibles(res.outCibles);
    const hhHtml = document.getElementById('bodyCibles').innerHTML;
    const flagBE = String.fromCodePoint(0x1F1E7, 0x1F1EA);   // 🇧🇪
    const flagTR = String.fromCodePoint(0x1F1F9, 0x1F1F7);   // 🇹🇷
    out.hhFlagBE = hhHtml.includes(flagBE);
    out.hhFlagTR = hhHtml.includes(flagTR);
    out.hhSexeM = hhHtml.includes('♂');
    out.hhSexeF = hhHtml.includes('♀');
    out.hhMrtl = hhHtml.includes('💍') && hhHtml.includes('🕊');
    // Colonnes du ménage pilotées par la config : 10 par défaut, puis masquer en retire une
    const hhHeadRow = () => document.querySelector('#bodyCibles tr[id^="men-"] thead tr');
    out.hhColsDef = hhHeadRow() ? hhHeadRow().children.length : 0;
    const cfgHh = getCfg('hh'); const mi = cfgHh.findIndex(x => x.id === 'marital_status');
    cfgHh[mi].on = false; saveCfg('hh', cfgHh); rerenderCibles();
    out.hhColsHidden = hhHeadRow() ? hhHeadRow().children.length : 0;
    cfgHh[mi].on = true; saveCfg('hh', cfgHh); rerenderCibles();   // restaure
    // Tables de correspondance (Lookup) : drapeau pays + icônes sexe/état civil
    if (typeof ouvrirParametres === 'function') {
      try {
        ouvrirParametres();
        out.lookupFlag = /\uD83C[\uDDE6-\uDDFF]/.test((document.getElementById('refNlty') || {}).innerHTML || '');
        const sexeHtml = (document.getElementById('refSexe') || {}).innerHTML || '';
        out.lookupSexe = sexeHtml.includes('♂') && sexeHtml.includes('♀');
        const mrtlHtml = (document.getElementById('refMrtl') || {}).innerHTML || '';
        out.lookupMrtl = mrtlHtml.includes('💍') && mrtlHtml.includes('🕊');
      } catch (e) { out.lookupErr = String(e && e.message || e); }
    }
    return out;
  });

  A(!r.threw, 'majStats() ne lève pas d\'erreur' + (r.threw ? ' → ' + r.threw : ''));
  A(r.blocsVides && r.blocsVides.length === 0, 'squelette commun : les 14 blocs rendent leur conteneur' + (r.blocsVides && r.blocsVides.length ? ' → vides : ' + r.blocsVides.join(', ') : ''));
  A(r.ageBars === 5, `tranches d'âge : 5 barres → ${r.ageBars}`);
  A(r.ageClickable, 'barres de tranches d\'âge cliquables (drill-down)');
  A(r.titreSansLFS, 'titre « Tranches d\'âge » sans « LFS »');
  A(r.drillTreemap, 'clic sur une tranche → treemap des nationalités');
  A(r.drillClosed, 'fermeture du drill-down (✕) vide le détail');
  A(/100/.test(r.dependRatio || '') && r.dependDonut, `ratio de dépendance = 100 % → « ${r.dependRatio} »`);
  A(r.contactBars === 3, `complétude des contacts : 3 barres → ${r.contactBars}`);
  A(/≥15/.test(r.chhTitle || '') && /interroger|survey|ondervragen|befragende/i.test(r.chhTitle || ''), `titre « à interroger » avec seuil dynamique → « ${r.chhTitle} »`);
  A(r.chhClickable && r.chhDrill, 'barres « à interroger » cliquables → treemap des nationalités');
  A(/interroger|survey|ondervragen|befragende/i.test(r.chhBarLabel) && !/cible|target/i.test(r.chhBarLabel), `libellé de barre « à interroger » (plus « cible ») → « ${r.chhBarLabel} »`);
  A(r.hhFlagBE && r.hhFlagTR, 'table ménage : drapeaux pays (🇧🇪 / 🇹🇷) devant naissance/nationalité');
  A(r.hhSexeM && r.hhSexeF, 'table ménage : icônes de sexe ♂ / ♀');
  A(r.hhMrtl, 'table ménage : emoji d\'état civil (💍 / 🕊)');
  A(r.hhColsDef === 10 && r.hhColsHidden === 9, `colonnes du ménage pilotées par la config (10 → 9 après masquage) → ${r.hhColsDef}/${r.hhColsHidden}`);
  A(r.lookupFlag && !r.lookupErr, 'table de correspondance Pays : drapeau devant le nom' + (r.lookupErr ? ' → ' + r.lookupErr : ''));
  A(r.lookupSexe, 'table de correspondance Sexe : icônes ♂ / ♀');
  A(r.lookupMrtl, 'table de correspondance État civil : emoji (💍 / 🕊)');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
