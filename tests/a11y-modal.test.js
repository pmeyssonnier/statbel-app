/*
 * Test de non-régression — accessibilité des modales (passe a11y-2, app Interviews).
 *
 * À l'ouverture d'une modale :
 *  - l'arrière-plan (tout sauf la modale) est neutralisé (`inert`) ;
 *  - le focus entre dans la modale ;
 *  - Tab / Maj+Tab bouclent à l'intérieur (piège de focus) ;
 * À la fermeture :
 *  - `inert` est retiré de l'arrière-plan ;
 *  - le focus revient sur l'élément déclencheur.
 *
 * Le pilotage passe par la bascule de la classe `.open` (observée par setupA11y),
 * donc via les vraies fonctions d'ouverture/fermeture.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/a11y-modal.test.js
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
    const tick = () => new Promise(res => setTimeout(res, 40)); // laisse tourner le MutationObserver
    settings.statuts = [{ label: 'To do', done: false }, { label: 'Done', done: true }];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.G1 = [{ ordre: '1', nom: 'A', prenom: 'a', adresse: 'Rue A, 1000 Bruxelles', statut: 'To do', historique: [] }];
    enqueteActive = 'G1';
    if (typeof refreshSelect === 'function') refreshSelect();

    // Élément déclencheur : on lui donne le focus AVANT d'ouvrir → doit être restauré.
    const declencheur = document.getElementById('btnListe');
    declencheur.focus();
    out.declencheurId = document.activeElement && document.activeElement.id;

    // ── Ouverture de la modale « Renommer » ───────────────────────────
    renommerEnquete();
    await tick();
    const modal = document.getElementById('modalRename');

    // Arrière-plan neutralisé (header/main inertes, modale active NON inerte)
    out.headerInert = document.querySelector('header').hasAttribute('inert');
    out.modalNotInert = !modal.hasAttribute('inert');

    // Focus entré dans la modale
    out.focusDansModale = modal.contains(document.activeElement);

    // Piège de focus : depuis le dernier focusable, Tab → revient au premier
    const foc = [...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null || el.getClientRects().length);
    const premier = foc[0], dernier = foc[foc.length - 1];
    dernier.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    out.tabWrapToFirst = document.activeElement === premier;
    // Maj+Tab depuis le premier → va au dernier
    premier.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    out.shiftTabWrapToLast = document.activeElement === dernier;
    out.nbFocusables = foc.length;

    // ── Fermeture ─────────────────────────────────────────────────────
    fermerRename();
    await tick();
    out.headerInertApres = document.querySelector('header').hasAttribute('inert');
    out.focusRestaure = document.activeElement && document.activeElement.id === 'btnListe';

    return out;
  });

  A(r.declencheurId === 'btnListe', 'point de départ : le déclencheur a le focus');
  A(r.headerInert, 'ouverture : l\'arrière-plan (header) est neutralisé (inert)');
  A(r.modalNotInert, 'ouverture : la modale active n\'est PAS inerte');
  A(r.focusDansModale, 'ouverture : le focus entre dans la modale');
  A(r.nbFocusables >= 2, `modale avec plusieurs focusables (${r.nbFocusables})`);
  A(r.tabWrapToFirst, 'piège de focus : Tab depuis le dernier revient au premier');
  A(r.shiftTabWrapToLast, 'piège de focus : Maj+Tab depuis le premier va au dernier');
  A(!r.headerInertApres, 'fermeture : l\'arrière-plan n\'est plus neutralisé');
  A(r.focusRestaure, 'fermeture : le focus revient sur l\'élément déclencheur');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
