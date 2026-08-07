/*
 * Tests de non-régression — robustesse opérationnelle (app Interviews, index.html)
 *
 * Couvre le « bloc 3 » de la revue :
 *   #12 validation de date réelle (aller-retour Date : 31/02, 29/02 non bissextile…)
 *   #10 injection de formule CSV neutralisée à l'export, tout en préservant le
 *       round-trip export → ré-import
 *   #11 le cache de coordonnées n'est écrit qu'à la confirmation (pas au parse)
 *   #8  indicateur d'état de sauvegarde
 *
 * Pré-requis (dev) :  npm i -D playwright-core
 * Navigateur : CHROMIUM_PATH=/chemin/vers/chrome
 * Lancer :  CHROMIUM_PATH=… node tests/robustesse.test.js
 */
const path = require('path');
const { chromium } = require('playwright-core');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
const INDEX_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto(INDEX_URL, { waitUntil: 'load' });
  await p.waitForTimeout(600);

  const r = await p.evaluate(async () => {
    const out = {};
    // #12 — validité calendaire réelle
    out.d_31_02      = jourValide(2026, 2, 31);   // attendu false
    out.d_28_02      = jourValide(2026, 2, 28);   // attendu true
    out.d_29_02_2025 = jourValide(2025, 2, 29);   // attendu false (non bissextile)
    out.d_29_02_2024 = jourValide(2024, 2, 29);   // attendu true  (bissextile)
    out.vi_bad = valeurIncoherente('birth_date', '2026-02-31'); // true
    out.vi_ok  = valeurIncoherente('birth_date', '2026-02-28'); // false

    // #10 — garde CSV réversible + round-trip + neutralisation Excel
    out.guard = ['=SUM(1)', '-cmd', '@x', '+1', 'normal'].every(s => csvDeguard(csvGuard(s)) === s);
    settings.statuts = [{ label: 'To do', done: false, rdv: false }];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.E = [{ ordre: '1', nom: 'Test', prenom: 'A', adresse: '-12 rue X', statut: 'To do',
                    notes: '=SUM(A1)+2', gsm: 'a;b"c', historique: [] }];
    enqueteActive = 'E';
    const csv = genererCSV();
    const c = parseCSV(csv).rows[0];
    out.rt_notes = c.notes === '=SUM(A1)+2';   // round-trip identique
    out.rt_adr   = c.adresse === '-12 rue X';
    out.rt_gsm   = c.gsm === 'a;b"c';
    out.excel_neutralized = /'=SUM\(A1\)\+2/.test(csv);  // apostrophe de garde présente dans l'export

    // #11 — le parse ne doit PAS écrire le cache de coordonnées
    const parsed2 = parseCSV('order,first_name,last_name,address,lat,lng\n9,B,Two,Rue Y,50.8,4.3\n');
    out.parse_returns_coords = Array.isArray(parsed2.coords) && parsed2.coords.length === 1;
    out.parse_no_cache = !coordsCache('Rue Y');

    // #8 — indicateur de sauvegarde
    await sauver();
    await new Promise(res => setTimeout(res, 150));
    out.saveState = document.getElementById('saveState').textContent;
    return out;
  });

  await b.close();

  const checks = [
    ['#12 31/02 rejeté',                 r.d_31_02 === false],
    ['#12 28/02 accepté',                r.d_28_02 === true],
    ['#12 29/02/2025 rejeté',            r.d_29_02_2025 === false],
    ['#12 29/02/2024 (bissextile) OK',   r.d_29_02_2024 === true],
    ['#12 valeurIncoherente 31/02',      r.vi_bad === true && r.vi_ok === false],
    ['#10 garde CSV réversible',         r.guard === true],
    ['#10 round-trip notes/adresse/gsm', r.rt_notes && r.rt_adr && r.rt_gsm],
    ['#10 formule neutralisée à l’export', r.excel_neutralized === true],
    ['#11 parse retourne les coords',    r.parse_returns_coords === true],
    ['#11 parse n’écrit pas le cache',   r.parse_no_cache === true],
    ['#8  indicateur ✓ après sauvegarde', r.saveState === '✓'],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
