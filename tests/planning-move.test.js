/*
 * Test de non-régression — Déplacement de l'onglet « Planning » vers le Planner.
 *
 * L'import et la gestion des plannings LFS vivent désormais dans le Planner
 * (statbel_planner.html). Le Convertisseur n'a plus d'onglet Planning mais
 * garde la LECTURE du stockage partagé localStorage['plannings'] pour relier
 * chaque GRP_2026xxxxx au planning LFS importé.
 *
 * Ce test prouve, bout en bout, que le lien GRP↔LFS est conservé :
 *   1. Planner : import LFS simulé (sans dialogue fichier) → écrit
 *      localStorage['plannings'] au format contractuel, avec l'index « grp ».
 *   2. Planner : réagit (sélecteur d'agenda + carte de gestion + filtres visibles).
 *   3. Convertisseur (même origine) : chercherPlanning()/planningPourGRP() lisent
 *      l'entrée importée → commune/quartier/dates du groupe retrouvés.
 *   4. Convertisseur : l'onglet Planning a bien disparu.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/planning-move.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';

// Un fichier LFS_IESS_GRP_APPEL minimal : 1 groupe (BRU), 2 interrogations.
// Colonnes = format officiel large lu par importerPlanningLFS().
const LFS_HEADERS = [
  'Numero_du_groupe', 'Province', 'Commune', 'Quartier_central',
  'Semaine_ref_Interro_1', 'Start_Interrogation_1', 'Stop_Interrogation_1',
  'Semaine_ref_Interro_2', 'Start_Interrogation_2', 'Stop_Interrogation_2',
];
const LFS_ROW = [
  '12345', 'BRU', 'Bruxelles / Brussel', 'NORD',
  '10', '02/03/2026', '22/03/2026',
  '20', '11/05/2026', '31/05/2026',
];
const LFS_FILE = 'LFS_IESS_GRP_APPEL_Y2026Q1_FR.xlsx';
const NOM_ATTENDU = 'LFS_IESS_GRP_APPEL_Y2026Q1_FR — EFT / LFS';

let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  p.on('dialog', d => d.accept());

  // ── 1-2. Planner : importer un planning LFS (sans dialogue fichier) ─────
  await p.goto(srv.url + '/statbel_planner.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const imp = await p.evaluate((args) => {
    const [headers, row, file] = args;
    // On alimente l'état de mapping puis on déclenche le parsing LFS direct.
    _mapHeaders = headers.slice();
    _mapData = [row.slice()];
    importerPlanningLFS(file);
    const stored = JSON.parse(localStorage.getItem('plannings') || '[]');
    const e = stored[0] || {};
    const g = (e.grp && e.grp['12345']) || null;
    return {
      count: stored.length,
      type: e.type, embedded: e.embedded, nom: e.nom,
      grp: g,
      // réaction du Planner
      selOptions: [...document.getElementById('selPlanning').options].map(o => o.textContent),
      mgmtVisible: document.getElementById('planMgmtCard').style.display !== 'none',
      filterVisible: document.getElementById('filterCard').style.display !== 'none',
      planSelectHas: [...document.getElementById('planSelect').options].some(o => /EFT \/ LFS/.test(o.textContent)),
    };
  }, [LFS_HEADERS, LFS_ROW, LFS_FILE]);

  A(imp.count === 1, `planning écrit dans localStorage['plannings'] (got ${imp.count})`);
  A(imp.type === 'EFT / LFS', `type EFT / LFS (got "${imp.type}")`);
  A(imp.embedded === false, 'embedded:false (planning importé, non embarqué)');
  A(imp.nom === NOM_ATTENDU, `nom dérivé du fichier (got "${imp.nom}")`);
  A(!!imp.grp, 'index « grp » présent pour le code 12345');
  if (imp.grp) {
    A(imp.grp.p === 'BRU' && imp.grp.c === 'Bruxelles / Brussel' && imp.grp.q === 'NORD',
      `grp['12345'] = province/commune/quartier corrects (${imp.grp.p}/${imp.grp.c}/${imp.grp.q})`);
    A(Array.isArray(imp.grp.i) && imp.grp.i.length === 2
      && imp.grp.i[0][0] === '10' && imp.grp.i[0][1] === '02/03/2026' && imp.grp.i[0][2] === '22/03/2026',
      'grp[..].i = [[sem,start,stop]…] (2 interrogations, dates conservées)');
  }
  A(imp.mgmtVisible, 'Planner : carte de gestion du planning affichée');
  A(imp.filterVisible, 'Planner : carte de filtres/agenda affichée');
  A(imp.planSelectHas, 'Planner : sélecteur de gestion liste le planning importé');
  A(imp.selOptions.some(t => /EFT \/ LFS/.test(t)), 'Planner : sélecteur d\'agenda liste le planning importé');

  // ── 3. Convertisseur (même origine) : le lien GRP↔LFS est lisible ───────
  await p.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const conv = await p.evaluate(() => {
    chargerRegistrePlannings();                 // relit localStorage['plannings']
    const m = chercherPlanning('12345');
    const pg = planningPourGRP({ NR_GRP: '112345', NR_WAVE: '1' });   // GRP_2026 → code 5 chiffres
    const pg2 = planningPourGRP({ NR_GRP: '112345', NR_WAVE: '2' });
    return {
      found: !!m, source: m ? m.source : '',
      pgFound: pg.found, commune: pg.commune, quartier: pg.quartier,
      start: pg.start, stop: pg.stop, province: pg.province,
      pg2start: pg2.start,
      // onglet Planning retiré ?
      ongPlanning: !!document.getElementById('ong-planning'),
      panPlanning: !!document.getElementById('pan-planning'),
      modalPlanMap: !!document.getElementById('modalPlanMap'),
    };
  });

  A(conv.found, 'Convertisseur : chercherPlanning("12345") trouve le planning importé');
  A(conv.source === NOM_ATTENDU, `Convertisseur : source = nom du planning importé (got "${conv.source}")`);
  A(conv.pgFound, 'Convertisseur : planningPourGRP() résout le groupe (annexe Aperçu)');
  A(conv.province === 'BRU' && conv.commune === 'Bruxelles / Brussel' && conv.quartier === 'NORD',
    `Convertisseur : province/commune/quartier depuis le planning (${conv.province}/${conv.commune}/${conv.quartier})`);
  A(conv.start === '02/03/2026' && conv.stop === '22/03/2026',
    `Convertisseur : période terrain vague 1 (${conv.start} → ${conv.stop})`);
  A(conv.pg2start === '11/05/2026', `Convertisseur : vague 2 distincte (${conv.pg2start})`);

  // ── 4. Convertisseur : plus d'onglet Planning ───────────────────────────
  A(!conv.ongPlanning, 'Convertisseur : bouton d\'onglet Planning retiré');
  A(!conv.panPlanning, 'Convertisseur : panneau Planning retiré');
  A(!conv.modalPlanMap, 'Convertisseur : modale de mapping retirée');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
