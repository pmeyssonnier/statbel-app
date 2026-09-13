/*
 * Test de non-régression — fermeture des modales par tap sur le fond (backdrop) +
 * empilement correct (inert selon le z-index, pas l'ordre DOM).
 *
 * Sur mobile il n'y a pas de touche Échap : sans fermeture par le fond, une modale
 * dont les boutons ne répondraient pas piégerait l'utilisateur. Et surtout :
 * #modalPin (z-index 300) s'ouvre PAR-DESSUS #modalSettings (200) tout en le
 * précédant dans le DOM — se fier à l'ordre DOM marquait la modale VISIBLE « inert »
 * (boutons + fond morts). On vérifie donc que la modale du dessus reste interactive.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/modal-backdrop.test.js
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
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  // 1) Backdrop : clic dans la carte → reste ; clic sur le fond → ferme.
  const r1 = await p.evaluate(() => {
    const out = {};
    settings.pinCode = _pinHash('2468'); saveSettings();
    ouvrirGestionPin();
    out.open = document.getElementById('modalPin').classList.contains('open');
    document.querySelector('#modalPin .modal').click();
    out.stillOpenInner = document.getElementById('modalPin').classList.contains('open');
    document.getElementById('modalPin').click();
    out.closedByBackdrop = !document.getElementById('modalPin').classList.contains('open');
    return out;
  });
  A(r1.open, 'modale PIN ouverte');
  A(r1.stillOpenInner, 'clic DANS la carte → la modale reste ouverte');
  A(r1.closedByBackdrop, 'clic sur le fond → la modale se ferme');

  // 2) Empilement réel : Paramètres ouvert PUIS popup PIN par-dessus (le cas signalé).
  await p.evaluate(() => { ouvrirSettings(); ouvrirGestionPin(); });
  await p.waitForTimeout(80);   // laisse le MutationObserver appliquer inert
  const r2 = await p.evaluate(() => ({
    pinInert: document.getElementById('modalPin').hasAttribute('inert'),
    settingsInert: document.getElementById('modalSettings').hasAttribute('inert'),
    pinOpen: document.getElementById('modalPin').classList.contains('open'),
  }));
  A(r2.pinOpen, 'popup PIN ouvert par-dessus Paramètres');
  A(!r2.pinInert, 'la modale VISIBLE du dessus (PIN, z-index 300) N\'EST PAS inert → boutons vivants');
  A(r2.settingsInert, 'la modale du dessous (Paramètres) est bien neutralisée (inert)');

  // Les boutons du popup PIN répondent réellement dans cet empilement.
  const r3 = await p.evaluate(() => {
    document.querySelector('#modalPin [data-act="fermerModalPin"]').click();
    return { pinClosed: !document.getElementById('modalPin').classList.contains('open') };
  });
  A(r3.pinClosed, 'empilé : « Annuler » ferme bien le popup PIN (plus de piège)');

  // 3) L'écran de verrouillage PIN ne se ferme pas par tap sur le fond.
  const r4 = await p.evaluate(() => {
    ouvrirLockScreen(false);
    const lock = document.getElementById('lockScreen');
    const open = lock.classList.contains('open');
    lock.click();
    const stays = lock.classList.contains('open');
    fermerLockScreen();
    return { open, stays };
  });
  A(r4.open && r4.stays, 'écran de verrouillage PIN : NON fermable par le fond (sécurité)');

  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
