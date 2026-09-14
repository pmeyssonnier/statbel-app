/*
 * Test de non-régression — accessibilité de statbel_pdf2grp.html (PDF → GRP).
 *
 * Le module était en retard sur les 3 autres apps (pas de lien d'évitement, zone
 * de tableau défilable non atteignable au clavier, pas de règle reduced-motion,
 * carte de résultat sans nom accessible). On vérifie l'alignement :
 *  - landmarks <header>/<main id="contenu"> ; lien d'évitement 1er focusable,
 *    cible #contenu, caché puis révélé au focus ;
 *  - la zone d'aperçu défilable est une région focusable au clavier ;
 *  - la carte de résultat est une région nommée (aria-labelledby → titre) ;
 *  - règles :focus-visible et prefers-reduced-motion présentes ;
 *  - la zone de dépôt est un bouton accessible (role/aria-label/tabindex).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/pdf2grp-a11y.test.js
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
  await p.goto(srv.url + '/statbel_pdf2grp.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const r = await p.evaluate(async () => {
    const out = {};

    // Landmarks
    out.hasHeader = !!document.querySelector('header');
    const main = document.querySelector('main#contenu');
    out.mainIsMain = !!main;
    out.mainTabindex = main ? main.getAttribute('tabindex') : null;
    out.headerOutsideMain = !!(main && !main.querySelector('header'));

    // Lien d'évitement
    const skip = document.querySelector('.skip-link');
    out.skipExists = !!skip;
    out.skipTarget = skip ? new URL(skip.href).hash : null;
    const focusables = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null || el.getClientRects().length || el === skip);
    out.skipIsFirst = focusables[0] === skip;
    const avant = skip.getBoundingClientRect();
    out.hiddenByDefault = avant.bottom <= 0;
    skip.style.transition = 'none';
    skip.focus();
    const apres = skip.getBoundingClientRect();
    out.visibleOnFocus = apres.top >= 0 && apres.bottom > 0;
    if (main.focus) main.focus();
    out.mainFocusable = document.activeElement === main;

    // Zone de dépôt = bouton accessible
    const dz = document.getElementById('dz');
    out.dzButton = dz.getAttribute('role') === 'button'
                && dz.getAttribute('tabindex') === '0'
                && !!(dz.getAttribute('aria-label') || '').trim();

    // Zone d'aperçu défilable atteignable au clavier + nommée
    const tw = document.querySelector('.tblwrap');
    out.tableRegion = tw.getAttribute('tabindex') === '0'
                   && tw.getAttribute('role') === 'region'
                   && !!(tw.getAttribute('aria-label') || '').trim();

    // Carte de résultat = région nommée par son titre (non vide)
    const res = document.getElementById('res');
    const lb = res.getAttribute('aria-labelledby');
    const titre = lb ? document.getElementById(lb) : null;
    out.resNamed = res.getAttribute('role') === 'region'
                && !!(lb && titre && res.contains(titre) && titre.textContent.trim());

    // Régions live pour les messages transitoires
    out.liveMsg = document.getElementById('msg').getAttribute('aria-live') === 'polite';
    out.liveWarn = document.getElementById('warn').getAttribute('aria-live') === 'polite';

    // Feuilles de style : :focus-visible + prefers-reduced-motion
    let focusVisible = false, reducedMotion = false;
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (const rule of rules) {
        if (rule.selectorText && rule.selectorText.includes(':focus-visible')) focusVisible = true;
        if (rule.media && rule.media.mediaText && rule.media.mediaText.includes('prefers-reduced-motion')) reducedMotion = true;
      }
    }
    out.focusVisibleRule = focusVisible;
    out.reducedMotion = reducedMotion;
    return out;
  });

  A(r.hasHeader, 'landmark <header> (banner) présent');
  A(r.mainIsMain, 'landmark <main id="contenu"> présent');
  A(r.mainTabindex === '-1', '<main> focusable programmatiquement (tabindex="-1")');
  A(r.headerOutsideMain, '<header> n\'est pas imbriqué dans <main>');
  A(r.skipExists, 'lien d\'évitement présent');
  A(r.skipTarget === '#contenu', `lien d'évitement cible le contenu → ${r.skipTarget}`);
  A(r.skipIsFirst, 'lien d\'évitement = 1er élément focusable');
  A(r.hiddenByDefault, 'lien d\'évitement caché hors écran par défaut');
  A(r.visibleOnFocus, 'lien d\'évitement révélé au focus clavier');
  A(r.mainFocusable, 'le contenu principal reçoit le focus');
  A(r.dzButton, 'zone de dépôt = bouton accessible (role/aria-label/tabindex)');
  A(r.tableRegion, 'aperçu défilable = région focusable au clavier et nommée');
  A(r.resNamed, 'carte de résultat = région nommée (aria-labelledby → titre)');
  A(r.liveMsg && r.liveWarn, 'messages transitoires en région live (aria-live polite)');
  A(r.focusVisibleRule, 'anneau de focus clavier : règle :focus-visible présente');
  A(r.reducedMotion, 'règle @media prefers-reduced-motion présente');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
