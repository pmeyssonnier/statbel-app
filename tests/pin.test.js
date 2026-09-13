/*
 * Tests de non-régression — verrouillage par code PIN (app Interviews)
 *
 * Exerce le module js/ui/pin.js dans un navigateur : définition d'un code,
 * démarrage verrouillé, rejet d'un mauvais code, temporisation anti-essais après
 * 3 échecs (gel de la saisie), déverrouillage avec le bon code (via le pavé
 * tactile). Vérifie l'écran de verrouillage réel (#lockScreen).
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

  // 3 mauvais codes consécutifs (seuil de temporisation) → reste verrouillé et
  // déclenche le gel de la saisie
  for (let k = 0; k < 3; k++) {
    for (const d of ['9', '9', '9', '9']) await tape(p, d);
    await p.waitForTimeout(200);
  }
  out.still_locked_wrong = await lockOpen(p);
  out.tempo_locked   = await p.evaluate(() => (settings.pinLockUntil || 0) > Date.now());
  out.tempo_disabled = await p.evaluate(() => document.getElementById('lockKeypad').classList.contains('disabled'));

  // Saisie gelée : appuyer ne remplit aucun point pendant la temporisation.
  // On laisse d'abord les rendus en attente (renderLockDots différé) se stabiliser.
  await p.waitForTimeout(300);
  const dotsAvant = await p.evaluate(() => document.querySelectorAll('#lockDots .lock-dot.filled').length);
  await tape(p, '1');
  const dotsApres = await p.evaluate(() => document.querySelectorAll('#lockDots .lock-dot.filled').length);
  out.tempo_frozen = (dotsAvant === 0 && dotsApres === 0);

  // Expiration simulée du gel → le bon code déverrouille et remet le compteur à zéro
  await p.evaluate(() => { settings.pinLockUntil = 0; });
  for (const d of ['1', '2', '3', '4']) await tape(p, d);
  await p.waitForTimeout(300);
  out.unlocked_right = !(await lockOpen(p));
  out.fails_reset = await p.evaluate(() => (settings.pinFails || 0) === 0);

  await b.close();
  await srv.close();

  const checks = [
    ['PIN actif après définition',        out.actif === true],
    ['code stocké haché (pas en clair)',  out.hash_not_plaintext === true],
    ['démarrage verrouillé',              out.locked_at_start === true],
    ['mauvais code → reste verrouillé',   out.still_locked_wrong === true],
    ['3 échecs → temporisation active',   out.tempo_locked === true],
    ['temporisation → pavé désactivé',    out.tempo_disabled === true],
    ['temporisation → saisie gelée',      out.tempo_frozen === true],
    ['bon code → déverrouillé',           out.unlocked_right === true],
    ['déverrouillage → compteur remis à 0', out.fails_reset === true],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
