/*
 * Test navigateur — délégation d'événements sur l'écran Réglages (lot 1).
 *
 * Vérifie que les contrôles migrés de `onclick`/`onchange`/`oninput` vers
 * `data-act` déclenchent bien leur action via le routeur (js/core/actions.js),
 * pour les trois types d'événement : change (<select>), input (champ URL),
 * click (bouton). Prouve que la délégation posée dans init() est câblée.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/settings-delegation.test.js
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
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const r = await p.evaluate(() => {
    const out = {};
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

    // change sur <select> : setTheme → settings.theme + thème appliqué
    const th = document.getElementById('setTheme');
    th.value = 'dark'; fire(th, 'change');
    out.theme = settings.theme;

    // change sur <select> : setCsvSep → settings.csvSep
    const cs = document.getElementById('setCsvSep');
    cs.value = ';'; fire(cs, 'change');
    out.csvSep = settings.csvSep;

    // input sur champ URL : setCawiUrl → settings.cawiUrl (trim)
    const url = document.getElementById('setCawiUrl');
    url.value = '  https://enquete.be  '; fire(url, 'input');
    out.cawi = settings.cawiUrl;

    // Changement de langue, modale OUVERTE : les contenus rendus en JS (hors
    // data-i18n) doivent se traduire à chaud, sans réouverture. Régression :
    // l'option « Toutes les enquêtes » et le statut de sauvegarde restaient
    // figés dans la langue précédente jusqu'à la réouverture de la modale.
    localStorage.removeItem('statbel_last_backup');   // → statut « aucune sauvegarde »
    document.getElementById('modalSettings').classList.add('open');
    majSettingsUI(); majLastBackupInfo();             // état initial (comme ouvrirSettings)
    const lang = document.getElementById('setLang');
    lang.value = 'nl'; fire(lang, 'change');
    out.allScope   = document.querySelector('#viderCacheScope option[value="__all__"]').textContent;
    out.backupInfo = document.getElementById('lastBackupInfo').textContent;
    // Sélecteur d'enquête (en-tête, hors modale) : sans enquête chargée, l'option
    // « — Aucune enquête — » doit aussi suivre la langue à chaud.
    out.surveyOpt  = document.querySelector('#surveySelect option').textContent;
    lang.value = 'fr'; fire(lang, 'change');           // rétablir pour la suite

    // click sur bouton : fermerSettings ferme la modale
    document.getElementById('modalSettings').classList.add('open');
    document.querySelector('[data-act="fermerSettings"]').click();
    out.modalClosed = !document.getElementById('modalSettings').classList.contains('open');

    // aucun handler inline ne doit subsister dans la modale Réglages
    out.inlineRestant = document.querySelectorAll(
      '#modalSettings [onclick],#modalSettings [onchange],#modalSettings [oninput]').length;

    return out;
  });

  await b.close();
  await srv.close();

  const checks = [
    ['change <select> → settings.theme',  r.theme === 'dark'],
    ['change <select> → settings.csvSep', r.csvSep === ';'],
    ['input champ URL → settings.cawiUrl (trim)', r.cawi === 'https://enquete.be'],
    ['option « Toutes les enquêtes » traduite à chaud (NL)', /Alle onderzoeken/.test(r.allScope)],
    ['statut de sauvegarde traduit à chaud (NL)', /Nog geen back-up/.test(r.backupInfo)],
    ['option « Aucune enquête » traduite à chaud (NL)', /Geen onderzoek/.test(r.surveyOpt)],
    ['click bouton → fermerSettings',     r.modalClosed === true],
    ['0 handler inline restant (Réglages)', r.inlineRestant === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
