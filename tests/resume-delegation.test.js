/*
 * Test navigateur — délégation d'événements de la vue Résumé (lot 4).
 *
 * Vérifie que les filtres de portée/méthode et les briques d'événements, migrés
 * de `onclick` vers `data-act`, réagissent via le routeur (js/core/actions.js).
 * On observe l'effet par la classe `actif` des boutons re-rendus après le clic.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/resume-delegation.test.js
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
    enquetes.G1 = [
      { ordre: '1', nom: 'Capi', prenom: 'Un',  adresse: 'Rue A, 1000', statut: 'Done',  date: '10/08/2026', historique: [{ statut: 'Done', date: '10/08/2026' }] },
      { ordre: '2', nom: 'Cati', prenom: 'Tel', adresse: 'Rue C, 1030', statut: 'To do', collect_method: 'CATI', historique: [] },
    ];
    enqueteActive = 'G1';
    if (typeof refreshSelect === 'function') refreshSelect();
    setView('resume');
    await sleep(150);

    const out = {};
    // markup migré : 2 boutons portée + 4 boutons méthode
    out.nbScope = document.querySelectorAll('#resumeContainer [data-act="setResumeScope"]').length;
    out.nbMeth  = document.querySelectorAll('#resumeContainer [data-act="setResumeMethode"]').length;

    // clic délégué : filtre méthode CATI → le bouton re-rendu porte « actif »
    document.querySelector('[data-act="setResumeMethode"][data-meth="cati"]').click();
    await sleep(150);
    out.catiActif = document.querySelector('[data-act="setResumeMethode"][data-meth="cati"]').classList.contains('actif');

    // retour « toutes méthodes »
    document.querySelector('[data-act="setResumeMethode"][data-meth="all"]').click();
    await sleep(150);
    out.allActif = document.querySelector('[data-act="setResumeMethode"][data-meth="all"]').classList.contains('actif');

    // aucun handler inline résiduel dans le Résumé (boutons + frise + activité)
    out.inlineResume = document.querySelectorAll(
      '#resumeContainer [onclick], #resumeContainer [onchange], #resumeContainer [oninput]').length;

    return out;
  });

  await b.close();
  await srv.close();

  const checks = [
    ['2 boutons portée migrés (data-act)',  r.nbScope === 2],
    ['4 boutons méthode migrés (data-act)', r.nbMeth === 4],
    ['clic délégué → filtre CATI actif',    r.catiActif === true],
    ['clic délégué → retour « toutes » actif', r.allActif === true],
    ['0 handler inline dans le Résumé',     r.inlineResume === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
