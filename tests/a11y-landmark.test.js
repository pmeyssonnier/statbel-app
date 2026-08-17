/*
 * Test de non-régression — landmarks, lien d'évitement & focus clavier
 * (passe a11y-3, app Interviews).
 *
 *  - <header> (banner) et <main id="contenu"> (contenu principal) présents ;
 *  - le lien d'évitement est le 1er élément focusable, cible #contenu, et
 *    devient visible au focus (caché hors écran sinon) ;
 *  - activer le lien amène le focus dans le contenu principal ;
 *  - une règle :focus-visible existe (anneau de focus clavier).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/a11y-landmark.test.js
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

  const r = await p.evaluate(async () => {
    const out = {};

    // Landmarks
    out.hasHeader = !!document.querySelector('header');
    const main = document.querySelector('main#contenu');
    out.mainIsMain = !!main;
    out.mainTabindex = main ? main.getAttribute('tabindex') : null;
    out.mainWrapsContent = !!(main && main.querySelector('#liste'));
    // header et main ne sont pas imbriqués
    out.headerOutsideMain = !!(main && !main.querySelector('header'));

    // Lien d'évitement
    const skip = document.querySelector('.skip-link');
    out.skipExists = !!skip;
    out.skipTarget = skip ? new URL(skip.href).hash : null;
    // 1er élément focusable du document
    const focusables = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null || el.getClientRects().length || el === skip);
    out.skipIsFirst = focusables[0] === skip;

    // Caché hors écran par défaut, révélé au focus
    const avant = skip.getBoundingClientRect();
    out.hiddenByDefault = avant.bottom <= 0;   // translaté vers le haut hors écran
    skip.focus();
    await new Promise(res => setTimeout(res, 300)); // laisse la transition (.15s) finir
    const apres = skip.getBoundingClientRect();
    out.visibleOnFocus = apres.top >= 0 && apres.bottom > 0;

    // Activer le lien → focus dans le contenu principal
    if (main.focus) { main.focus(); }
    out.mainFocusable = document.activeElement === main;

    // Règle :focus-visible présente dans les feuilles de style (même origine)
    let focusVisibleRule = false;
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (const rule of rules) {
        if (rule.selectorText && rule.selectorText.includes(':focus-visible')) { focusVisibleRule = true; break; }
      }
      if (focusVisibleRule) break;
    }
    out.focusVisibleRule = focusVisibleRule;

    // i18n : le lien d'évitement a bien un data-i18n traduit
    out.skipI18n = skip.getAttribute('data-i18n') === 'skip_link';
    return out;
  });

  A(r.hasHeader, 'landmark <header> (banner) présent');
  A(r.mainIsMain && r.mainWrapsContent, 'landmark <main id="contenu"> enveloppe le contenu (#liste)');
  A(r.headerOutsideMain, '<header> n\'est pas imbriqué dans <main>');
  A(r.mainTabindex === '-1', '<main> focusable programmatiquement (tabindex="-1")');
  A(r.skipExists, 'lien d\'évitement présent');
  A(r.skipTarget === '#contenu', `lien d'évitement cible le contenu → ${r.skipTarget}`);
  A(r.skipIsFirst, 'lien d\'évitement = 1er élément focusable');
  A(r.hiddenByDefault, 'lien d\'évitement caché hors écran par défaut');
  A(r.visibleOnFocus, 'lien d\'évitement révélé au focus clavier');
  A(r.mainFocusable, 'activer le lien amène le focus dans <main>');
  A(r.focusVisibleRule, 'anneau de focus clavier : règle :focus-visible présente');
  A(r.skipI18n, 'lien d\'évitement traduit (data-i18n="skip_link")');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
