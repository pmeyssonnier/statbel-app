/*
 * Test de non-régression — Convertisseur : rattachement des VAGUES au groupe initial.
 *
 * Le planning n'est indexé que sur le numéro de la VAGUE 1 (« 1·SS·GG »), qui porte
 * déjà les 4 interrogations. Un fichier de vague ≥ 2 a un numéro différent
 * (« V·SS·GG », ex. 24005) absent du planning : chercherPlanning doit remonter au
 * groupe INITIAL de même GG dont l'interrogation Iᵥ tombe sur la semaine SS.
 *
 * Données embarquées utilisées : 12705 (Jette, GG=05) → I1 wk27, I2 wk40, I3 wk27, I4 wk40.
 *   → 24005 (V2, wk40, GG05) doit se rattacher à 12705 (I2).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-wave-link.test.js
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
    const S = m => m ? { base: m.base, c: m.e.c } : null;
    return {
      w1:    S(chercherPlanning('12705', 1)),   // exact, vague 1
      w2:    S(chercherPlanning('24005', 2)),   // vague 2 → rattaché à 12705
      w4:    S(chercherPlanning('44005', 4)),   // vague 4 → rattaché à 12705
      wrongWk: chercherPlanning('29905', 2),    // semaine inexistante → null
      wrongGg: chercherPlanning('24099', 2),    // GG inexistant → null
      // bout-en-bout : les colonnes planning se remplissent pour un fichier de vague 2
      pg2: (() => { const x = planningPourGRP({ NR_GRP: '202624005', NR_WAVE: '2' });
                    return { found: x.found, commune: x.commune, sem: x.sem, wave: x.wave }; })(),
    };
  });

  A(r.w1 && r.w1.base === '12705' && r.w1.c === 'Jette', `vague 1 : 12705 trouvé en direct (got ${JSON.stringify(r.w1)})`);
  A(r.w2 && r.w2.base === '12705', `vague 2 : 24005 rattaché au groupe initial 12705 (got ${JSON.stringify(r.w2)})`);
  A(r.w4 && r.w4.base === '12705', `vague 4 : 44005 rattaché au groupe initial 12705 (got ${JSON.stringify(r.w4)})`);
  A(r.wrongWk === null, 'semaine sans correspondance → non rattaché (introuvable)');
  A(r.wrongGg === null, 'GG sans correspondance → non rattaché (introuvable)');
  A(r.pg2 && r.pg2.found && r.pg2.commune === 'Jette' && r.pg2.sem === '40' && r.pg2.wave === 2,
    `planningPourGRP vague 2 : commune + semaine I2 remplies (got ${JSON.stringify(r.pg2)})`);
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
