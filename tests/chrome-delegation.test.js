/*
 * Test navigateur — délégation d'événements du « chrome » (lot 2).
 *
 * Vérifie que les contrôles de l'en-tête / barre d'outils / menu kebab migrés
 * de `onclick` vers `data-act` déclenchent bien leur action via le routeur
 * (js/core/actions.js) : bascule de vues, ouverture du menu kebab, et absence
 * de handler inline résiduel dans le chrome.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/chrome-delegation.test.js
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

    // click bascule de vues : setView('carte') puis retour 'liste'
    document.querySelector('[data-act="setView"][data-view="carte"]').click();
    out.vueCarte = vueActive;
    document.querySelector('[data-act="setView"][data-view="liste"]').click();
    out.vueListe = vueActive;

    // les 4 boutons de vue portent bien data-act (markup migré)
    out.nbSetView = document.querySelectorAll('[data-act="setView"]').length;

    // click menu kebab : ouvre #kebabMenu (classe 'open')
    document.getElementById('btnKebab').click();
    out.kebabOuvert = document.getElementById('kebabMenu').classList.contains('open');

    // aucun handler inline résiduel dans les zones migrées au lot 2
    // (menu kebab + contrôles de la barre d'outils ; l'input d'import CSV reste
    // au lot 3, donc on ne balaie pas tout <header>)
    out.inlineChrome = document.querySelectorAll(
      '#kebabMenu [onclick], #kebabMenu [onchange], .view-toggle [onclick], ' +
      '#surveySelect[onchange], #btnGeo[onclick], #btnKebab[onclick]').length;

    return out;
  });

  await b.close();
  await srv.close();

  const checks = [
    ['click setView → vue carte',        r.vueCarte === 'carte'],
    ['click setView → retour liste',     r.vueListe === 'liste'],
    ['4 boutons de vue migrés (data-act)', r.nbSetView === 4],
    ['click kebab → menu ouvert',        r.kebabOuvert === true],
    ['0 handler inline dans le chrome',  r.inlineChrome === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
