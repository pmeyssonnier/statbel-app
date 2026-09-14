/*
 * Planner — candidature : ordre des groupes par COMMUNE + QUARTIER.
 *
 * Les groupes retenus ne sont plus regroupés en un seul bloc par commune :
 * chaque quartier d'une même commune est une entrée ordonnable séparément
 * (ex. « Schaerbeek — Gd. Rue au Bois » avant « Schaerbeek — Helmet »).
 * Vérifie la séparation, le tri par défaut (commune puis quartier), le
 * déplacement indépendant et l'ordre transmis au .docx.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/candidature-order.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto(srv.url + '/statbel_planner.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    allRows = [
      { numero:'101', commune:'Schaerbeek', quartier:'HELMET', vagues:[] },
      { numero:'102', commune:'Schaerbeek', quartier:'HELMET', vagues:[] },
      { numero:'201', commune:'Schaerbeek', quartier:'GD. RUE AU BOIS', vagues:[] },
      { numero:'301', commune:'Ixelles', quartier:'FLAGEY', vagues:[] },
    ];
    selected = new Set(['101', '102', '201', '301']);
    candCommuneOrder = [];

    // Tri par défaut : commune puis quartier → les 2 quartiers de Schaerbeek
    // sont DEUX entrées distinctes (pas un bloc commune unique).
    const entries = candCommunes().map(c => c.communeFR + ' — ' + c.quartier);
    const nbEntries = entries.length;
    const schaerbeekEntries = candCommunes().filter(c => c.communeFR === 'Schaerbeek').length;
    const gdBeforeHelmetDefault =
      candCommunes().findIndex(c => c.quartier === 'GD. RUE AU BOIS') <
      candCommunes().findIndex(c => c.quartier === 'HELMET');

    // Déplacement INDÉPENDANT : monter HELMET au-dessus de GD. RUE AU BOIS.
    candMoveCommune(candCommunes().findIndex(c => c.quartier === 'HELMET'), -1);
    const helmetNowBefore =
      candCommunes().findIndex(c => c.quartier === 'HELMET') <
      candCommunes().findIndex(c => c.quartier === 'GD. RUE AU BOIS');

    // L'ordre transmis au .docx suit l'ordre des entrées (puis n° de groupe).
    const docxOrder = candSelectedGroups().map(g => g.numero);

    // Aperçu candidature : le n° de groupe + le quartier apparaissent (« 201 - GD. RUE AU BOIS »).
    updateCandidaturePreview();
    const previewHtml = document.getElementById('candGrpPreview').innerHTML;
    const previewHasGroupQuartier = /201 - GD\. RUE AU BOIS/.test(previewHtml) && /101, 102 - HELMET/.test(previewHtml);

    // .docx (ZIP STORE, non compressé) : la cellule commune contient « commune - quartier ».
    const data = { groupes: candSelectedGroups(), nom:'', prenom:'', adresse:'', cp:'', commune:'',
      telPrive:'', heuresPrive:'', telPort:'', heuresPort:'', telBur:'', heuresBur:'',
      emailPrive:'', emailBur:'', nbGroupes:'2', date:'', title:'', abbrev:'EFT', period:'2026-T4',
      choix:'groupes', signaturePng:null };
    const docxStr = candBytesToStr(candGenerateDocxBytes(data));
    const docxHasQuartier = docxStr.includes('Schaerbeek - HELMET') && docxStr.includes('Schaerbeek - GD. RUE AU BOIS');

    return { entries, nbEntries, schaerbeekEntries, gdBeforeHelmetDefault, helmetNowBefore, docxOrder,
      previewHasGroupQuartier, docxHasQuartier };
  });

  await b.close();
  await srv.close();

  const checks = [
    ['4 groupes → 3 entrées (commune+quartier)', r.nbEntries === 3],
    ['Schaerbeek = 2 entrées distinctes (quartiers séparés)', r.schaerbeekEntries === 2],
    ['tri par défaut : GD. RUE AU BOIS avant HELMET', r.gdBeforeHelmetDefault === true],
    ['déplacement indépendant : HELMET remonté', r.helmetNowBefore === true],
    ['ordre .docx suit les entrées : 301, puis HELMET (101,102), puis GD. RUE (201)',
      JSON.stringify(r.docxOrder) === JSON.stringify(['301', '101', '102', '201'])],
    ['aperçu : n° de groupe + quartier affichés', r.previewHasGroupQuartier === true],
    ['.docx : cellule commune = « commune - quartier »', r.docxHasQuartier === true],
    ['aucune erreur de page', perr.length === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) console.log('PAGEERRORS:', perr);
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
