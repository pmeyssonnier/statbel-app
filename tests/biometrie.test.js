/*
 * Test de non-régression — déverrouillage biométrique (WebAuthn) de l'app Interviews.
 *
 * Pilote un AUTHENTIFICATEUR VIRTUEL via CDP (Chrome DevTools Protocol) pour simuler
 * un capteur de plateforme (Touch ID / empreinte) sans matériel. Couvre : détection
 * de disponibilité, enrôlement via l'interrupteur des Réglages, déverrouillage de
 * l'écran de verrouillage par empreinte, repli PIN quand la biométrie échoue, et
 * désactivation. Le contexte est sécurisé (servi sur 127.0.0.1).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/biometrie.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const srv = await serve();
  // WebAuthn refuse une adresse IP comme RP ID (« invalid domain ») : on passe par
  // « localhost », un domaine valide en contexte sécurisé — comme le domaine réel en
  // production (GitHub Pages). Le code applicatif ne fixe pas de rp.id (défaut = domaine).
  const base = srv.url.replace('127.0.0.1', 'localhost');
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  // Authentificateur virtuel de plateforme (empreinte), utilisateur vérifié.
  const client = await p.context().newCDPSession(p);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', transport: 'internal',
      hasResidentKey: false, hasUserVerification: true,
      isUserVerified: true, automaticPresenceSimulation: true,
    },
  });

  // 1) Disponibilité + enrôlement via l'interrupteur des Réglages.
  const step1 = await p.evaluate(async () => {
    settings.pinCode = _pinHash('2468'); settings.pinFails = 0; settings.pinLockUntil = 0; saveSettings();
    const out = {};
    out.dispo = await bioPlateformeDispo();
    await majBioUI();
    out.rowShown = !document.getElementById('bioRow').classList.contains('hidden');
    // Active l'empreinte (comme un clic sur la case à cocher des Réglages)
    await toggleBioUnlock({ checked: true });
    out.enrolled = bioEnrolee();
    out.hasCred = !!settings.bioCredId;
    out.checkboxOn = document.getElementById('setBioUnlock').checked;
    return out;
  });
  A(step1.dispo, 'authentificateur de plateforme détecté (bioPlateformeDispo)');
  A(step1.rowShown, 'Réglages : ligne « empreinte » visible (PIN actif + capteur dispo)');
  A(step1.enrolled && step1.hasCred, 'enrôlement OK : clé mémorisée dans settings.bioCredId');
  A(step1.checkboxOn, 'Réglages : la case « empreinte » reste cochée après enrôlement');

  // 2) Déverrouillage par empreinte : l'écran de verrouillage se ferme.
  const step2 = await p.evaluate(async () => {
    ouvrirLockScreen(false);
    const open1 = document.getElementById('lockScreen').classList.contains('open');
    await pinTenterBio();     // appui manuel du bouton empreinte
    const open2 = document.getElementById('lockScreen').classList.contains('open');
    return { open1, open2 };
  });
  A(step2.open1, 'écran de verrouillage ouvert avant l\'empreinte');
  A(!step2.open2, 'empreinte reconnue → écran déverrouillé (fermé)');

  // 3) Repli PIN : empreinte NON reconnue → l'écran reste, message de repli.
  await client.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  const step3 = await p.evaluate(async () => {
    ouvrirLockScreen(false);
    await pinTenterBio();     // manuel → échoue (utilisateur non vérifié)
    return {
      stillOpen: document.getElementById('lockScreen').classList.contains('open'),
      msg: document.getElementById('lockErrorMsg').textContent,
      keypad: !!document.getElementById('lockKeypad').children.length,
    };
  });
  A(step3.stillOpen, 'empreinte refusée → écran de verrouillage maintenu (repli PIN)');
  A(/code|pin/i.test(step3.msg), `message de repli affiché (got "${step3.msg}")`);
  A(step3.keypad, 'le pavé PIN reste disponible en repli');

  // 4) Désactivation : la clé est oubliée.
  await client.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true });
  const step4 = await p.evaluate(async () => {
    await toggleBioUnlock({ checked: false });
    return { enrolled: bioEnrolee(), cred: settings.bioCredId };
  });
  A(!step4.enrolled && !step4.cred, 'désactivation : clé biométrique oubliée');

  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
