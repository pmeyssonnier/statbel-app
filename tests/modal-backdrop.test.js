/*
 * Test de non-régression — fermeture des modales par tap sur le fond (backdrop).
 *
 * Sur mobile il n'y a pas de touche Échap : sans fermeture par le fond, une modale
 * dont les boutons ne répondraient pas (ex. HTML/JS désynchronisés pendant une mise
 * à jour) piégerait l'utilisateur. On vérifie : un clic sur l'overlay ferme la
 * modale ; un clic DANS la carte ne la ferme pas ; l'écran de verrouillage PIN
 * (#lockScreen, pas un .modal-overlay) N'EST PAS fermable par le fond.
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

  const r = await p.evaluate(() => {
    const out = {};
    settings.pinCode = _pinHash('2468'); saveSettings();

    // 1) Modale PIN : clic DANS la carte → reste ouverte ; clic sur le FOND → ferme.
    ouvrirGestionPin();
    out.open = document.getElementById('modalPin').classList.contains('open');
    document.querySelector('#modalPin .modal').click();          // clic intérieur
    out.stillOpenInner = document.getElementById('modalPin').classList.contains('open');
    document.getElementById('modalPin').click();                 // clic sur le fond (overlay)
    out.closedByBackdrop = !document.getElementById('modalPin').classList.contains('open');

    // 2) L'écran de verrouillage PIN ne doit PAS se fermer par tap sur le fond.
    ouvrirLockScreen(false);
    const lock = document.getElementById('lockScreen');
    out.lockOpen = lock.classList.contains('open');
    lock.click();
    out.lockStaysOpen = lock.classList.contains('open');
    fermerLockScreen();
    return out;
  });

  A(r.open, 'modale PIN ouverte');
  A(r.stillOpenInner, 'clic DANS la carte → la modale reste ouverte');
  A(r.closedByBackdrop, 'clic sur le fond → la modale se ferme');
  A(r.lockOpen && r.lockStaysOpen, 'écran de verrouillage PIN : NON fermable par le fond (sécurité)');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
