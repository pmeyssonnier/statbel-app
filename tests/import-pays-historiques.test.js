/*
 * Test de non-régression — bug C2 : un code pays de naissance / nationalité
 * inconnu d'Interviews faisait ÉCARTER la fiche à l'import (case « n'importer que
 * les corrects » cochée par défaut) → ménage absent de l'enquête, ou mise à jour
 * perdue au réimport. Typiquement les codes d'États disparus émis par le
 * Convertisseur (YUG ex-Yougoslavie, SUN ex-URSS…), fréquents chez les ≥ 60 ans.
 *
 * Correctif à deux volets :
 *   A. Les 8 codes historiques du Convertisseur sont ajoutés à PAYS_I18N
 *      (js/data/canon.js) → reconnus et affichés proprement.
 *   B. Un pays inconnu ne fait PLUS écarter la ligne (recordEnErreur) : la fiche
 *      est importée, le code reste seulement signalé (barré en rouge / cohérence).
 *
 * Garde-fous conservés : un statut hors vocabulaire ou une date impossible
 * excluent toujours la ligne.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/import-pays-historiques.test.js
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
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    const out = {};
    settings.lang = 'fr';
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    settings.statutsParEnquete = {};

    // Défaut du markup : « n'importer que les corrects » coché (condition du bug).
    out.defaultChecked = !!(document.getElementById('chkOnlyValid') || {}).checked;

    const importer = (nom, csv) => {
      ouvrirModalImport(parseCSV(csv), nom);
      document.getElementById('inputNomEnquete').value = nom;
      const chk = document.getElementById('chkOnlyValid'); if (chk) chk.checked = true;
      confirmerImport();
    };

    // ── A+B. Lot avec des pays d'États disparus + un code réellement inconnu ──
    importer('LFS pays',
      'order,first_name,last_name,address,status,birth_country,nationality\n' +
      '1,Marko,Petrovic,Rue A 1 1000 Bxl,To do,YUG,YUG\n' +   // ex-Yougoslavie
      '2,Ivan,Sovietski,Rue B 2 1000 Bxl,To do,SUN,SUN\n' +   // ex-URSS
      '3,Jan,Cesky,Rue C 3 1000 Bxl,To do,CSK,BEL\n' +        // ex-Tchécoslovaquie
      '4,Xavier,Zzz,Rue D 4 1000 Bxl,To do,ZZZ,BEL\n');       // code vraiment inconnu → importé quand même
    const lot = enquetes['LFS pays'] || [];
    out.count = lot.length;
    out.pays = lot.map(c => c.birth_country).sort();

    // Volet A : les codes historiques sont désormais connus (plus signalés).
    out.yugConnu = valeurIncoherente('birth_country', 'YUG') === false;
    out.sunConnu = valeurIncoherente('birth_country', 'SUN') === false;
    out.yugLabel = paysAffiche('YUG');
    // Volet B : un code vraiment inconnu reste signalé… mais n'exclut plus.
    out.zzzSignale = valeurIncoherente('birth_country', 'ZZZ') === true;

    // ── Garde-fou 1 : un statut hors vocabulaire exclut toujours ──
    importer('Statut KO',
      'order,first_name,last_name,address,status,birth_country\n' +
      '1,Eve,Bad,Rue 5 1000 Bxl,ZZZ_NOPE,BEL\n');
    out.statutKo = (enquetes['Statut KO'] || []).length;

    // ── Garde-fou 2 : une date de naissance impossible exclut toujours ──
    importer('Date KO',
      'order,first_name,last_name,address,status,birth_date\n' +
      '1,Fred,Bad,Rue 6 1000 Bxl,To do,2026-02-31\n');
    out.dateKo = (enquetes['Date KO'] || []).length;

    return out;
  });

  A(r.defaultChecked === true, 'la case « n\'importer que les corrects » est cochée par défaut');

  // A+B — toutes les lignes importées, y compris pays historiques et code inconnu
  A(r.count === 4, `les 4 fiches sont importées, aucune écartée pour le pays (got ${r.count})`);
  A(JSON.stringify(r.pays) === JSON.stringify(['CSK', 'SUN', 'YUG', 'ZZZ']),
    `pays conservés tels quels sur les fiches (got ${JSON.stringify(r.pays)})`);

  // A — codes historiques reconnus
  A(r.yugConnu, 'YUG (ex-Yougoslavie) est un pays reconnu (plus signalé incohérent)');
  A(r.sunConnu, 'SUN (ex-URSS) est un pays reconnu');
  A(/Yougoslavie/.test(r.yugLabel), `YUG s'affiche proprement (got « ${r.yugLabel} »)`);

  // B — code réellement inconnu : signalé mais pas exclu
  A(r.zzzSignale, 'un code pays vraiment inconnu reste signalé comme incohérent');

  // Garde-fous
  A(r.statutKo === 0, `garde-fou : un statut hors vocabulaire exclut toujours (got ${r.statutKo})`);
  A(r.dateKo === 0, `garde-fou : une date de naissance impossible exclut toujours (got ${r.dateKo})`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
