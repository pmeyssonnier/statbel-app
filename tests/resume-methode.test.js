/*
 * Test de non-régression — Résumé : filtre par méthode de collecte (CAPI/CATI/CAWI).
 *
 * Vérifie que le filtre méthode (setResumeMethode) narrow bien la population du Résumé :
 *   - défaut « toutes » = tous les contacts ;
 *   - CATI / CAWI / CAPI ne gardent que les contacts de la méthode (CAPI = ni CATI ni CAWI) ;
 *   - les boutons de filtre affichent le bon compte.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/resume-methode.test.js
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
  p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to (fetch|load)|tile/i.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  let r;
  try {
    r = await p.evaluate(async () => {
      settings.statuts = [
        { label: 'To do', color: '#90a4ae', icon: '⚪', done: false, rdv: false, realise: false },
        { label: 'Done',  color: '#2e7d32', icon: '✅', done: true,  rdv: false, realise: true  },
      ];
      Object.keys(enquetes).forEach(k => delete enquetes[k]);
      // 2 CAPI (méthode absente ou « CAPI »), 1 CATI, 1 CAWI
      enquetes.G1 = [
        { ordre: '1', nom: 'Capi', prenom: 'Un',   adresse: 'Rue A, 1000', statut: 'Done',  date: '10/08/2026', nb_cibles: 1, historique: [{ statut: 'Done', date: '10/08/2026' }] },
        { ordre: '2', nom: 'Capi', prenom: 'Deux', adresse: 'Rue B, 1000', statut: 'To do', date: '', nb_cibles: 1, collect_method: 'CAPI', historique: [] },
        { ordre: '3', nom: 'Cati', prenom: 'Tel',  adresse: 'Rue C, 1030', statut: 'To do', date: '', nb_cibles: 1, collect_method: 'CATI', historique: [] },
        { ordre: '4', nom: 'Cawi', prenom: 'Web',  adresse: 'Rue D, 1030', statut: 'Done',  date: '11/08/2026', nb_cibles: 1, collect_method: 'CAWI', historique: [{ statut: 'Done', date: '11/08/2026' }] },
      ];
      enqueteActive = 'G1';
      if (typeof refreshSelect === 'function') refreshSelect();
      setResumeScope('all');
      setView('resume');
      const rowsFor = async (meth) => {
        setResumeMethode(meth);
        await new Promise(res => setTimeout(res, 120));
        const tbl = document.getElementById('resumeContactsTable');
        return tbl ? tbl.querySelectorAll('tbody tr').length : -1;
      };
      const out = {};
      out.all  = await rowsFor('all');
      out.capi = await rowsFor('capi');
      out.cati = await rowsFor('cati');
      out.cawi = await rowsFor('cawi');
      // Boutons de filtre + compteurs (retour sur « all »)
      setResumeMethode('all');
      await new Promise(res => setTimeout(res, 120));
      const btns = [...document.querySelectorAll('#resumeContainer button')].map(x => x.textContent.trim());
      out.hasCapiBtn = btns.some(t => /CAPI \(2\)/.test(t));
      out.hasCatiBtn = btns.some(t => /CATI \(1\)/.test(t));
      out.hasCawiBtn = btns.some(t => /CAWI \(1\)/.test(t));
      return out;
    });
  } catch (e) {
    A(false, 'rendu du Résumé sans exception → ' + e.message);
    await b.close(); await srv.close(); process.exit(1);
  }

  A(r.all === 4,  `« toutes méthodes » = 4 contacts → ${r.all}`);
  A(r.capi === 2, `CAPI (ni CATI ni CAWI) = 2 contacts → ${r.capi}`);
  A(r.cati === 1, `CATI = 1 contact → ${r.cati}`);
  A(r.cawi === 1, `CAWI = 1 contact → ${r.cawi}`);
  A(r.hasCapiBtn && r.hasCatiBtn && r.hasCawiBtn, 'boutons de filtre méthode avec compteurs (CAPI 2 · CATI 1 · CAWI 1)');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
