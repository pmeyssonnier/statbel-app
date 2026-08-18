/*
 * Test de non-régression — personnalisation du Convertisseur (KPI + blocs d'analyse).
 *
 * Vérifie le registre KPI + la config perso (afficher/masquer + réordonner) :
 *  - rendu par défaut = 6 KPI dans l'ordre attendu ;
 *  - renderKPIs calcule les valeurs depuis un contexte ;
 *  - activer un KPI « nouveau » (ex. % né·es à l'étranger) l'ajoute et persiste ;
 *  - réordonner (persoMove) change l'ordre et persiste ;
 *  - Réinitialiser rétablit le défaut.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-kpi.test.js
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
  await p.waitForTimeout(300);

  const r = await p.evaluate(() => {
    const out = {};
    localStorage.removeItem('statbel_conv_kpi');       // partir d'un état neuf

    // Défaut : 6 KPI dans l'ordre attendu
    out.def = getKpiCfg().filter(x => x.on).map(x => x.id).join(',');
    out.total = getKpiCfg().length;

    // Rendu depuis un contexte simulé
    _kpiCtx = { popN: 66, kM: 33, kF: 33, ageMoy: 46, ageMed: 44, nEtr: 30, nMin: 8, nbHH: 26, membres: 66, nbCibles15: 42 };
    renderKPIs(_kpiCtx);
    out.vals = [...document.querySelectorAll('#kpiGrid .compteur .val')].map(e => e.textContent).join('|');
    out.nTiles = document.querySelectorAll('#kpiGrid .compteur').length;
    // % mineurs = sur le ménage complet (nMin / membres), pas sur pop : 8/66 ≈ 12 %
    out.minFormula = KPI_DEFS.min.val(_kpiCtx);

    // Activer « % né·es à l'étranger » (etr) → apparaît + persiste
    ouvrirPerso();
    out.modalOpen = document.getElementById('modalPerso').classList.contains('open');
    const idxEtr = getKpiCfg().findIndex(x => x.id === 'etr');
    persoToggle(idxEtr);
    out.etrShown = [...document.querySelectorAll('#kpiGrid .label')].some(e => e.getAttribute('data-i18n') === 'kpi_pct_foreign');
    out.etrPersisted = (JSON.parse(localStorage.getItem('statbel_conv_kpi')).find(x => x.id === 'etr') || {}).on === true;
    out.etrValue = [...document.querySelectorAll('#kpiGrid .compteur')]
      .filter(el => el.querySelector('.label').getAttribute('data-i18n') === 'kpi_pct_foreign')
      .map(el => el.querySelector('.val').textContent)[0];     // 30/66 ≈ 45 %

    // Réordonner : monter le 2e KPI en 1re position
    const before = getKpiCfg().map(x => x.id);
    persoMove(1, -1);
    const after = getKpiCfg().map(x => x.id);
    out.reordered = before[0] === after[1] && before[1] === after[0];

    // Réinitialiser → défaut
    resetPerso();
    out.reset = getKpiCfg().filter(x => x.on).map(x => x.id).join(',');

    // ── Blocs d'analyse ───────────────────────────────────────────────
    localStorage.removeItem('statbel_conv_blocs');
    persoTab('blocs');
    out.blocDefaut = getCfg('blocs').length + '/' + getCfg('blocs').filter(x => x.on).length;   // 14/14 par défaut
    // Libellé dynamique du KPI « Cibles ≥N » selon l'âge min courant
    _ui.ageMinCible = 16;
    out.cibLabel16 = KPI_DEFS.cib.dyn();   // « Cibles ≥16 ans »
    // Masquer le bloc Sankey → carte cachée dans le DOM + persistée
    const idxSankey = getCfg('blocs').findIndex(x => x.id === 'sankey');
    persoToggle(idxSankey);
    const sankeyCard = document.querySelector('#statsBlocks [data-block="sankey"]');
    out.sankeyHidden = sankeyCard && sankeyCard.style.display === 'none';
    out.blocPersisted = (JSON.parse(localStorage.getItem('statbel_conv_blocs')).find(x => x.id === 'sankey') || {}).on === false;
    // Réordonner : monter le 2e bloc → l'ordre DOM suit
    persoMove(1, -1);
    const domOrder = [...document.querySelectorAll('#statsBlocks [data-block]')].map(el => el.getAttribute('data-block'));
    const cfgOrder = getCfg('blocs').map(x => x.id);
    out.blocDomMatchesCfg = JSON.stringify(domOrder) === JSON.stringify(cfgOrder);

    // ── Colonnes du tableau (Aperçu) ─────────────────────────────────
    localStorage.removeItem('statbel_conv_cols');
    persoTab('cols');
    out.colDefaut = getCfg('cols').length + '/' + getCfg('cols').filter(x => x.on).length;   // 6/6
    renderCiblesHead();
    out.headDefault = document.querySelectorAll('#tableCibles thead th').length;   // 1 expansion + 6
    // Masquer la colonne Téléphone (gsm) → th absent + persiste
    const idxGsm = getCfg('cols').findIndex(x => x.id === 'gsm');
    persoToggle(idxGsm);   // apply → rerenderCibles → renderCiblesHead
    out.headAfterHide = document.querySelectorAll('#tableCibles thead th').length;   // 6
    out.gsmGone = !document.querySelector('#tableCibles thead th[data-i18n="th_phone"]');
    out.colPersisted = (JSON.parse(localStorage.getItem('statbel_conv_cols')).find(x => x.id === 'gsm') || {}).on === false;
    // Réordonner : monter la 2e colonne (Contact) → 1re colonne de données du thead
    persoMove(1, -1);
    const firstDataTh = document.querySelectorAll('#tableCibles thead th')[1];
    out.firstColAfterReorder = firstDataTh ? firstDataTh.getAttribute('data-col') : null;   // 'prenom'
    return out;
  });

  A(r.def === 'men,pop,size,age,h,f', `défaut = 6 KPI ordonnés → ${r.def}`);
  A(r.total === 10, `registre complet (10 KPI, dont 4 nouveaux) → ${r.total}`);
  A(r.nTiles === 6 && r.vals === '26|66|2.5|46 ans|50 %|50 %', `rendu des valeurs depuis le contexte → ${r.vals}`);
  A(r.minFormula === '12 %', `% mineurs calculé sur le ménage complet (8/66) → ${r.minFormula}`);
  A(r.modalOpen, 'panneau « Personnaliser » s\'ouvre');
  A(r.etrShown && r.etrPersisted, 'activer un KPI l\'affiche et le persiste (localStorage)');
  A(/%$/.test((r.etrValue || '').trim()), `KPI % né·es à l'étranger calculé → ${r.etrValue}`);
  A(r.reordered, 'réordonner (↑) échange bien les deux premiers KPI');
  A(r.reset === 'men,pop,size,age,h,f', 'Réinitialiser rétablit le défaut');
  A(r.blocDefaut === '14/14', `blocs : 14 cartes, toutes affichées par défaut → ${r.blocDefaut}`);
  A(/16/.test(r.cibLabel16 || ''), `KPI « Cibles » suit l'âge min (≥16) → « ${r.cibLabel16} »`);
  A(r.sankeyHidden && r.blocPersisted, 'masquer un bloc cache la carte (DOM) et persiste');
  A(r.blocDomMatchesCfg, 'réordonner un bloc réordonne les cartes dans le DOM');
  A(r.colDefaut === '6/6', `colonnes : 6, toutes affichées par défaut → ${r.colDefaut}`);
  A(r.headDefault === 7, `en-tête par défaut = 1 (expansion) + 6 colonnes → ${r.headDefault} th`);
  A(r.headAfterHide === 6 && r.gsmGone && r.colPersisted, 'masquer une colonne retire le th et persiste');
  A(r.firstColAfterReorder === 'prenom', `réordonner met Contact en 1re colonne → data-col="${r.firstColAfterReorder}"`);
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
