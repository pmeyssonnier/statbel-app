/*
 * Test de non-régression — accessibilité (passe a11y-1, app Interviews).
 *
 * Vérifie les noms accessibles et les états ARIA ajoutés :
 *  - <h1> logo a un nom (aria-label) plutôt que « presse-papiers » ;
 *  - boutons de vue : aria-pressed reflète la vue active ;
 *  - menu ⋮ : aria-expanded bascule à l'ouverture ;
 *  - barre de statut : emoji décoratif (aria-hidden), aria-pressed en édition ;
 *  - boutons icône dynamiques : aria-label présent (ex. supprimer une entrée).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/a11y.test.js
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
    settings.statuts = [
      { label: 'To do', color: '#90a4ae', icon: '✕' },
      { label: 'Done',  color: '#2e7d32', icon: '✓', done: true },
      { label: 'RDV',   color: '#f9a825', icon: '⏳', rdv: true },
    ];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.G1 = [{ ordre: '1', nom: 'A', prenom: 'a', adresse: 'Rue A, 1000 Bruxelles',
      statut: 'Done', date: '10/08/2026', historique: [{ statut: 'Done', date: '10/08/2026', heure: '09:00' }] }];
    enqueteActive = 'G1';
    if (typeof refreshSelect === 'function') refreshSelect();
    setView('liste'); rendu();
    await new Promise(res => setTimeout(res, 80));

    // <h1> logo → nom accessible
    out.h1Label = document.querySelector('header h1').getAttribute('aria-label');
    out.h1IconHidden = !!document.querySelector('header h1 [aria-hidden="true"]');

    // Boutons de vue → aria-pressed
    out.viewActivePressed  = document.getElementById('btnListe').getAttribute('aria-pressed');
    out.viewOtherPressed   = document.getElementById('btnCarte').getAttribute('aria-pressed');

    // Menu ⋮ → aria-expanded bascule
    const kb = document.getElementById('btnKebab');
    out.kebabBefore = kb.getAttribute('aria-expanded');
    toggleKebab();
    out.kebabAfter = kb.getAttribute('aria-expanded');
    toggleKebab();

    // Barre de statut de la CARTE : emoji décoratif
    const cardBtn = document.querySelector('#liste .statut-bar-lock .s-btn');
    out.cardIconHidden = !!(cardBtn && cardBtn.querySelector('[aria-hidden="true"]'));

    // Mode édition : aria-pressed sur les boutons de statut, actif = true
    ouvrirEdit(0);
    const editBtns = [...document.querySelectorAll('#edit-0 .statut-bar .s-btn')];
    out.editAllPressed = editBtns.length > 0 && editBtns.every(x => x.hasAttribute('aria-pressed'));
    const actif = editBtns.find(x => x.classList.contains('actif'));
    out.editActivePressed = actif ? actif.getAttribute('aria-pressed') : null;

    // Bouton icône dynamique : aria-label (supprimer une entrée d'historique)
    const hd = document.querySelector('#edit-0 .historique-del');
    out.histDelLabel = hd ? hd.getAttribute('aria-label') : null;
    return out;
  });

  A(r.h1Label === 'Statbel Interviews', `<h1> a un nom accessible → « ${r.h1Label} » (emoji masqué: ${r.h1IconHidden})`);
  A(r.viewActivePressed === 'true' && r.viewOtherPressed === 'false', 'boutons de vue : aria-pressed reflète la vue active');
  A(r.kebabBefore === 'false' && r.kebabAfter === 'true', 'menu ⋮ : aria-expanded bascule false → true à l\'ouverture');
  A(r.cardIconHidden, 'barre de statut (carte) : emoji marqué décoratif (aria-hidden)');
  A(r.editAllPressed, 'mode édition : tous les boutons de statut portent aria-pressed');
  A(r.editActivePressed === 'true', `mode édition : le statut actif est aria-pressed="true"`);
  A(r.histDelLabel === 'Supprimer cette entrée', `bouton icône dynamique nommé → « ${r.histDelLabel} »`);
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
