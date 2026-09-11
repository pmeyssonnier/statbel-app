/*
 * Test de non-régression — déduction du préréglage de statuts depuis la méthode
 * de collecte (CD_WSH_CLCT_MTHD = CATI/CAWI) à l'import.
 *
 *   1. Import d'un CSV « cibles » (export Convertisseur) contenant CD_WSH_CLCT_MTHD :
 *      - la colonne est reconnue → collect_method stocké sur les fiches ;
 *      - enquête neuve avec ≥1 méthode CATI/CAWI → préréglage « feuille de contact
 *        CATI » appliqué automatiquement (statutsParEnquete[nom]) + fiches re-mappées ;
 *      - round-trip : genererCSV ré-émet la colonne CD_WSH_CLCT_MTHD.
 *   2. Import sans méthode (vague 1 CAPI) → l'enquête reste en statuts CAPI.
 *   3. Ré-import sur une enquête existante → pas de re-déduction (estNouvelle faux).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/statut-autopreset.test.js
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
    const importer = (nom, csv) => {
      const parsed = parseCSV(csv);
      ouvrirModalImport(parsed, nom);
      document.getElementById('inputNomEnquete').value = nom;
      confirmerImport();
    };
    // Repartir propre
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    settings.statutsParEnquete = {};

    // 1. Enquête CATI/CAWI (colonne CD_WSH_CLCT_MTHD présente)
    importer('Lot CATI',
      'order,first_name,last_name,address,status,CD_WSH_CLCT_MTHD\n' +
      '1,Alice,Martin,Rue 1,Done,CATI\n' +
      '2,Bob,Durand,Rue 2,To do,CAWI\n');
    const cati = settings.statutsParEnquete['Lot CATI'] || [];
    const gCati = enquetes['Lot CATI'];
    const csvOut = genererCSV();

    // 2. Enquête CAPI (aucune méthode)
    importer('Lot CAPI',
      'order,first_name,last_name,address,status\n' +
      '1,Carla,Neyt,Rue 3,To do\n');
    const capiActif = (enqueteActive === 'Lot CAPI');
    const capiDefs = statutDefs().map(s => s.label);
    const capiSeeded = !!settings.statutsParEnquete['Lot CAPI'];

    // 3. Ré-import CATI sur l'enquête CAPI existante → pas de re-déduction
    importer('Lot CAPI',
      'order,first_name,last_name,address,status,CD_WSH_CLCT_MTHD\n' +
      '1,Carla,Neyt,Rue 3,To do,CATI\n');
    const capiDefsApresReimport = statutDefs().map(s => s.label);

    return {
      catiLabels: cati.map(s => s.label),
      aliceMethod: gCati[0].collect_method, bobMethod: gCati[1].collect_method,
      aliceStatut: gCati[0].statut,          // Done → Interview réalisée
      csvHasHeader: /CD_WSH_CLCT_MTHD/.test(csvOut),
      csvHasCati: csvOut.split('\n').some(l => /Alice/.test(l) && /CATI/.test(l)),
      capiActif, capiDefs, capiSeeded,
      capiDefsApresReimport,
    };
  });

  const catiAttendus = ['Pas encore de contact entrepris', 'Rdv fixé', 'Tentatives de contacts sans résultat',
    'Négatif', 'Interview réalisée', 'Inconnu'];
  A(JSON.stringify(r.catiLabels) === JSON.stringify(catiAttendus),
    `import CATI : préréglage CATI appliqué automatiquement (got ${JSON.stringify(r.catiLabels)})`);
  A(r.aliceMethod === 'CATI' && r.bobMethod === 'CAWI',
    `collect_method stocké sur les fiches (got ${r.aliceMethod}/${r.bobMethod})`);
  A(r.aliceStatut === 'Interview réalisée',
    `statut « Done » re-mappé vers le vocabulaire CATI (got ${r.aliceStatut})`);
  A(r.csvHasHeader, 'round-trip : genererCSV ré-émet l\'en-tête CD_WSH_CLCT_MTHD');
  A(r.csvHasCati, 'round-trip : la valeur CATI est ré-exportée');

  A(r.capiActif, 'import CAPI : enquête active = Lot CAPI');
  A(!r.capiSeeded, 'import CAPI : aucune méthode → pas de préréglage forcé (repli CAPI)');
  A(r.capiDefs[0] === 'To do' && !r.capiDefs.includes('Pas encore de contact entrepris'),
    `import CAPI : statuts restés CAPI (got ${JSON.stringify(r.capiDefs)})`);

  A(r.capiDefsApresReimport[0] === 'To do' && !r.capiDefsApresReimport.includes('Pas encore de contact entrepris'),
    `ré-import sur enquête existante : pas de re-déduction (got ${JSON.stringify(r.capiDefsApresReimport)})`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
