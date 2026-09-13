/*
 * Test navigateur — délégation d'événements des fiches contact (lot 5).
 *
 * Parcours délégué réel : rendu de la liste, ouverture d'une fiche (click), saisie
 * des notes (input), changement de statut (click sur la barre), filtre (click).
 * Vérifie aussi qu'aucun handler inline ne subsiste dans la liste/fiche. Les
 * fonctions métier sont couvertes par ailleurs (contacts, statut-*, rappel…).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/contacts-delegation.test.js
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
  await p.waitForTimeout(300);

  const r = await p.evaluate(async () => {
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    settings.statuts = [
      { label: 'To do', color: '#90a4ae', icon: '⚪', done: false, rdv: false, realise: false },
      { label: 'Done',  color: '#2e7d32', icon: '✅', done: true,  rdv: false, realise: true  },
    ];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.G1 = [{ ordre: '1', nom: 'Test', prenom: 'Un', adresse: 'Rue A, 1000', statut: 'To do', historique: [] }];
    enqueteActive = 'G1';
    if (typeof refreshSelect === 'function') refreshSelect();
    setView('liste');
    rendu();
    await sleep(120);

    const out = {};
    out.cards = document.querySelectorAll('#liste .card').length;

    // click délégué : ouvrir la fiche
    document.querySelector('[data-act="toggleEdit"][data-i="0"]').click();
    await sleep(120);
    out.editOuvert = (document.getElementById('edit-0').innerHTML || '').length > 0;

    // input délégué : notes
    const nt = document.querySelector('#edit-0 [data-act="editNotes"]');
    nt.value = 'Note déléguée';
    nt.dispatchEvent(new Event('input', { bubbles: true }));
    out.notes = contacts()[0].notes;

    // click délégué : bouton de statut éditable → « Done »
    const done = [...document.querySelectorAll('#edit-0 [data-act="statutBtn"]')].find(x => x.dataset.label === 'Done');
    done.click();
    await sleep(120);
    out.statut = contacts()[0].statut;

    // click délégué : filtre « Done »
    document.querySelector('.filters [data-act="filtrer"][data-label="Done"]').click();
    await sleep(120);
    out.filtre = filtreActif;

    // aucun handler inline résiduel dans la liste et la fiche
    out.inlineListe = document.querySelectorAll(
      '#liste [onclick],#liste [oninput],#liste [onchange],#liste [ondblclick],#liste [onblur],#liste [onmousedown],#liste [onkeydown]').length;

    return out;
  });

  await b.close();
  await srv.close();

  const checks = [
    ['liste rendue (1 fiche)',          r.cards === 1],
    ['click délégué → fiche ouverte',   r.editOuvert === true],
    ['input délégué → notes enregistrées', r.notes === 'Note déléguée'],
    ['click délégué → statut « Done »', r.statut === 'Done'],
    ['click délégué → filtre « Done »', r.filtre === 'Done'],
    ['0 handler inline dans la liste',  r.inlineListe === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
