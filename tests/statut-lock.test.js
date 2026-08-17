/*
 * Test de non-régression — verrouillage du statut hors mode édition (app Interviews)
 *
 * Pour éviter les changements de statut accidentels au toucher, la barre de statut
 * de la CARTE est verrouillée : un clic n'applique PAS le statut, il ouvre le
 * formulaire d'édition. Le statut ne se change que dans le formulaire (mode édition).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/statut-lock.test.js
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
  p.on('dialog', d => d.accept());
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(async () => {
    settings.statuts = [
      { label: 'To do', color: '#90a4ae', icon: '⚪' },
      { label: 'Done',  color: '#2e7d32', icon: '✅', done: true },
      { label: 'Refus', color: '#c62828', icon: '⛔' },
    ];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.G1 = [{ ordre: '1', nom: 'A', prenom: 'a', adresse: 'Rue A, 1000 Bruxelles', statut: 'To do', historique: [] }];
    enqueteActive = 'G1';
    if (typeof refreshSelect === 'function') refreshSelect();
    setView('liste'); rendu();
    await new Promise(res => setTimeout(res, 100));
    const out = {};
    out.hasLockBar = !!document.querySelector('#liste .statut-bar-lock');
    out.hasLockIcon = !!document.querySelector('#liste .statut-lock');
    // Clic sur le statut « Done » de la CARTE (verrouillée)
    const doneIdx = settings.statuts.findIndex(s => s.label === 'Done');
    const cardDone = document.querySelectorAll('#liste .statut-bar-lock .s-btn')[doneIdx];
    cardDone.click();
    await new Promise(res => setTimeout(res, 80));
    out.statutAfterCardClick = enquetes.G1[0].statut;
    out.editOpened = !!(document.getElementById('edit-0') && document.getElementById('edit-0').classList.contains('open'));
    // En mode édition : clic « Done » dans le formulaire
    const editDone = document.querySelectorAll('#edit-0 .statut-bar .s-btn')[doneIdx];
    editDone.click();
    await new Promise(res => setTimeout(res, 80));
    out.statutAfterEditClick = enquetes.G1[0].statut;
    return out;
  });

  A(r.hasLockBar && r.hasLockIcon, 'carte : barre de statut verrouillée + cadenas 🔒');
  A(r.statutAfterCardClick === 'To do', `clic sur la CARTE ne change PAS le statut (reste "${r.statutAfterCardClick}")`);
  A(r.editOpened, 'clic sur le statut de la carte ouvre le formulaire d\'édition');
  A(r.statutAfterEditClick === 'Done', `clic en MODE ÉDITION change bien le statut → "${r.statutAfterEditClick}"`);
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
