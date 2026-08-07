/*
 * Tests de non-régression — verrouillage par code PIN (app Interviews)
 *
 * Exerce le module js/ui/pin.js dans un navigateur : définition d'un code,
 * démarrage verrouillé, rejet d'un mauvais code, déverrouillage avec le bon
 * code (via le pavé tactile). Vérifie l'écran de verrouillage réel (#lockScreen).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/pin.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
const lockOpen = (p) => p.evaluate(() => document.getElementById('lockScreen').classList.contains('open'));
const tape = (p, d) => p.evaluate((k) => pinToucheAppuyee(k), d);

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const out = {};

  // Définir un code PIN (hash stocké, jamais le code en clair) puis simuler
  // un démarrage : l'app doit s'ouvrir verrouillée.
  await p.evaluate(() => { settings.pinCode = _pinHash('1234'); });
  out.actif = await p.evaluate(() => pinEstActif());
  out.hash_not_plaintext = await p.evaluate(() => settings.pinCode !== '1234' && settings.pinCode.length > 0);
  await p.evaluate(() => pinVerifierAuDemarrage());
  out.locked_at_start = await lockOpen(p);

  // Mauvais code → reste verrouillé (auto-validation à 4 chiffres)
  for (const d of ['9', '9', '9', '9']) await tape(p, d);
  await p.waitForTimeout(300);
  out.still_locked_wrong = await lockOpen(p);

  // Bon code → déverrouille
  for (const d of ['1', '2', '3', '4']) await tape(p, d);
  await p.waitForTimeout(300);
  out.unlocked_right = !(await lockOpen(p));

  await b.close();
  await srv.close();

  const checks = [
    ['PIN actif après définition',        out.actif === true],
    ['code stocké haché (pas en clair)',  out.hash_not_plaintext === true],
    ['démarrage verrouillé',              out.locked_at_start === true],
    ['mauvais code → reste verrouillé',   out.still_locked_wrong === true],
    ['bon code → déverrouillé',           out.unlocked_right === true],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
