/*
 * Tests de non-régression — vue Résumé (app Interviews) × lib de composants js/charts.js
 *
 * Vérifie l'intégration des composants partagés dans le Résumé :
 *   - donut de « Répartition des statuts » (Charts.donut) rendu avec sa légende ;
 *   - tableau de contacts triable (Charts.table) avec badges de statut ;
 *   - tri au clic sur un en-tête.
 *
 * Données injectées via les globals de l'app (même pont que contacts.test.js).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/resume.test.js
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
  p.on('console', m => {
    if (m.type() === 'error' && !/net::|Failed to (fetch|load)|tile/i.test(m.text())) errs.push('console: ' + m.text());
  });
  p.on('dialog', d => d.accept());
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const libLoaded = await p.evaluate(() => !!(window.Charts && Charts.donut && Charts.table));
  A(libLoaded, 'lib js/charts.js chargée dans l\'app Interviews (window.Charts)');

  let r;
  try {
    r = await p.evaluate(async () => {
      settings.statuts = [
        { label: 'To do', color: '#90a4ae', icon: '⚪', done: false, rdv: false },
        { label: 'Done',  color: '#2e7d32', icon: '✅', done: true,  rdv: false },
        { label: 'Refus', color: '#c62828', icon: '⛔', done: false, rdv: false },
        { label: 'RDV',   color: '#f9a825', icon: '📅', done: false, rdv: true },
      ];
      Object.keys(enquetes).forEach(k => delete enquetes[k]);
      enquetes.G1 = [
        { ordre: '1', nom: 'Dupont', prenom: 'Jean', adresse: 'Rue A, 1000 Bruxelles', statut: 'Done', date: '10/08/2026', historique: [{ statut: 'RDV', date: '05/08/2026' }, { statut: 'Done', date: '10/08/2026' }] },
        { ordre: '2', nom: 'Martin', prenom: 'Anne', adresse: 'Rue B, 1000 Bruxelles', statut: 'To do', date: '', historique: [] },
        { ordre: '3', nom: 'Sy', prenom: 'Omar', adresse: 'Rue C, 1030 Schaerbeek', statut: 'Refus', date: '08/08/2026', historique: [{ statut: 'RDV', date: '06/08/2026' }] },
      ];
      enquetes.G2 = [
        { ordre: '1', nom: 'Blanc', prenom: 'Eva', adresse: 'Rue D, 1030 Schaerbeek', statut: 'Done', date: '11/08/2026', historique: [{ statut: 'Done', date: '11/08/2026' }] },
      ];
      enqueteActive = 'G1';
      if (typeof refreshSelect === 'function') refreshSelect();
      setResumeScope('all');
      setView('resume');
      await new Promise(res => setTimeout(res, 200));
      const box = document.getElementById('resumeContainer');
      const tbl = document.getElementById('resumeContactsTable');
      const firstBefore = tbl.querySelector('tbody tr td') ? tbl.querySelector('tbody tr td').textContent : null;
      tbl.querySelector('th').click();   // trier par 1re colonne (Contact)
      const firstAfter = tbl.querySelector('tbody tr td') ? tbl.querySelector('tbody tr td').textContent : null;
      return {
        kpiSparks: document.querySelectorAll('.kpi-grid .kpi-card svg').length,
        donutSvg: box.querySelectorAll('svg').length,
        donutLegend: !!box.querySelector('ul li strong'),
        rows: tbl.querySelectorAll('tbody tr').length,
        badges: tbl.querySelectorAll('.chart-badge').length,
        sortable: !!tbl.querySelector('th[aria-sort]'),
        firstBefore, firstAfter,
      };
    });
  } catch (e) {
    A(false, 'rendu du Résumé sans exception → ' + e.message);
    await b.close(); await srv.close(); process.exit(1);
  }

  A(r.kpiSparks >= 2, `sparklines dans les cartes KPI (statuts avec activité datée) → ${r.kpiSparks}`);
  A(r.donutSvg >= 1 && r.donutLegend, `donut « Répartition des statuts » rendu avec légende (svg=${r.donutSvg})`);
  A(r.rows === 4, `tableau de contacts : 4 lignes (2 enquêtes) → ${r.rows}`);
  A(r.badges === 4, `un badge de statut par ligne → ${r.badges}`);
  A(r.sortable, 'en-têtes triables (aria-sort présent)');
  // Défaut = tri par visites décroissant (Dupont, 2 passages) ; clic sur Contact → tri alpha (Blanc).
  A(r.firstBefore === 'Dupont Jean' && r.firstAfter === 'Blanc Eva',
    `tri au clic actif (défaut "${r.firstBefore}" → alpha "${r.firstAfter}")`);
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
