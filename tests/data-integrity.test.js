/*
 * Tests de non-régression — intégrité des données (app Interviews, index.html)
 *
 * Exercent les vraies fonctions de index.html dans un navigateur headless :
 *   - appariement de réimport (préservation historique/statut malgré correction
 *     de nom/prénom ou changement d'ordre)
 *   - migration de l'historique au renommage / à la suppression d'un statut
 *   - archivage sensible à la date (pas de perte de passages répétés)
 *
 * Pré-requis (dev) :  npm i -D playwright-core
 * Navigateur : indiquer le binaire Chromium via la variable d'environnement
 *   CHROMIUM_PATH (ex. celui de Playwright), sinon on tente le Chrome/Chromium système.
 * Lancer :  CHROMIUM_PATH=/chemin/vers/chrome node tests/data-integrity.test.js
 * Sortie : "TOUS LES TESTS PASSENT" + code de sortie 0 si OK, 1 sinon.
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH
  || process.env.PLAYWRIGHT_CHROMIUM
  || '/usr/bin/chromium'; // repli ; surcharger via CHROMIUM_PATH au besoin

(async () => {
  const srv = await serve();   // app.js est un module ES → servir en http(s)
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  p.on('dialog', d => d.accept());               // confirm() → true
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  // Helper exécuté dans la page : réinitialise settings.statuts + enquetes
  await p.evaluate(() => {
    window.__setup = (statuts, enq) => {
      settings.statuts = statuts;
      Object.keys(enquetes).forEach(k => delete enquetes[k]);
      Object.entries(enq).forEach(([k, v]) => { enquetes[k] = v; });
      if (typeof filtreActif !== 'undefined') { try { filtreActif = 'Tous'; } catch (e) {} }
    };
    window.__ST = [
      { label: 'To do',  color: '#888', icon: '•', done: false, rdv: false },
      { label: 'Fait',   color: '#2e7d32', icon: '✓', done: true,  rdv: false },
      { label: 'Absent', color: '#e65100', icon: '•', done: false, rdv: false },
      { label: 'RDV',    color: '#1565c0', icon: '📅', done: false, rdv: true },
    ];
  });

  const results = {};

  // ── #1a : réimport avec prénom corrigé → historique préservé (match par ordre) ──
  results.reimport_prenom = await p.evaluate(() => {
    __setup(JSON.parse(JSON.stringify(__ST)), { E: [
      { ordre: '0005', nom: 'Dupont', prenom: 'Jean', adresse: 'Rue A 1', birth_date: '1980-01-01',
        statut: 'Fait', date: '01/08/2026', historique: [{ statut: 'Fait', date: '01/08/2026' }] }
    ]});
    const neu = [{ ordre: '0005', nom: 'Dupont', prenom: 'Jean-Pierre', adresse: 'Rue A 1', birth_date: '1980-01-01' }];
    const { result } = preparerImport(neu, 'E');
    const r = result[0];
    return { prenom: r.prenom, statut: r.statut, date: r.date, hist: (r.historique || []).length };
  });

  // ── #1b : ordre changé mais nom+prénom+naissance identiques → préservé (tier 2) ──
  results.reimport_ordre_change = await p.evaluate(() => {
    __setup(JSON.parse(JSON.stringify(__ST)), { E: [
      { ordre: '1', nom: 'Martin', prenom: 'Claire', adresse: 'Rue B 2', birth_date: '1990-05-05',
        statut: 'Fait', date: '02/08/2026', historique: [{ statut: 'Fait', date: '02/08/2026' }] }
    ]});
    const neu = [{ ordre: '2', nom: 'Martin', prenom: 'Claire', adresse: 'Rue B 2', birth_date: '1990-05-05' }];
    const { result } = preparerImport(neu, 'E');
    return { ordre: result[0].ordre, statut: result[0].statut, hist: (result[0].historique || []).length };
  });

  // ── #1c : personne réellement différente → nouveau (pas de fausse préservation) ──
  results.reimport_different = await p.evaluate(() => {
    __setup(JSON.parse(JSON.stringify(__ST)), { E: [
      { ordre: '10', nom: 'Durand', prenom: 'Paul', adresse: 'Rue C 3', birth_date: '1970-03-03',
        statut: 'Fait', date: '03/08/2026', historique: [{ statut: 'Fait', date: '03/08/2026' }] }
    ]});
    const neu = [{ ordre: '11', nom: 'Lefebvre', prenom: 'Sophie', adresse: 'Rue Z 9', birth_date: '2000-09-09' }];
    const { result } = preparerImport(neu, 'E');
    return { statut: result[0].statut || '(vide)', hist: (result[0].historique || []).length };
  });

  // ── #1d : MÊME n° d'ordre mais identité totalement différente (n° réattribué ?) →
  //          suivi NON transféré + signalé « incertain » (sécurité anti-fausse fusion) ──
  results.reimport_incertain = await p.evaluate(() => {
    __setup(JSON.parse(JSON.stringify(__ST)), { E: [
      { ordre: '0005', nom: 'Dupont', prenom: 'Jean', adresse: 'Rue A 1', birth_date: '1980-01-01',
        statut: 'Fait', date: '01/08/2026', historique: [{ statut: 'Fait', date: '01/08/2026' }] }
    ]});
    const neu = [{ ordre: '0005', nom: 'Martin', prenom: 'Marie', adresse: 'Rue Z 9', birth_date: '1995-06-06' }];
    const { result, incertains } = preparerImport(neu, 'E');
    return { statut: result[0].statut || '(vide)', hist: (result[0].historique || []).length,
             nom: result[0].nom, incertains: incertains.length };
  });

  // ── #1e : même n° d'ordre, nom différent MAIS naissance identique → apparié (1 signal) ──
  results.reimport_1signal = await p.evaluate(() => {
    __setup(JSON.parse(JSON.stringify(__ST)), { E: [
      { ordre: '0007', nom: 'Dupont', prenom: 'Jean', adresse: 'Rue A 1', birth_date: '1980-01-01',
        statut: 'Fait', date: '01/08/2026', historique: [{ statut: 'Fait', date: '01/08/2026' }] }
    ]});
    // nom marié différent + adresse différente, mais date de naissance identique → concordance
    const neu = [{ ordre: '0007', nom: 'Lefevre', prenom: 'Jean', adresse: 'Rue B 2', birth_date: '1980-01-01' }];
    const { result, incertains } = preparerImport(neu, 'E');
    return { statut: result[0].statut || '(vide)', hist: (result[0].historique || []).length, incertains: incertains.length };
  });

  // ── #2a : renommer un statut → historique migré ──
  results.rename_statut = await p.evaluate(() => {
    __setup(JSON.parse(JSON.stringify(__ST)), { E: [
      { ordre: '1', nom: 'A', prenom: 'a', statut: 'Absent', date: '04/08/2026',
        historique: [{ statut: 'Absent', date: '01/08/2026' }, { statut: 'Absent', date: '04/08/2026' }] }
    ]});
    const idx = settings.statuts.findIndex(s => s.label === 'Absent');
    try { modifierStatut(idx, 'label', 'Pas rencontré'); } catch (e) {}
    const c = enquetes.E[0];
    return { statut: c.statut, hist: c.historique.map(h => h.statut) };
  });

  // ── #2b : supprimer un statut → historique migré vers le repli ──
  results.delete_statut = await p.evaluate(() => {
    __setup(JSON.parse(JSON.stringify(__ST)), { E: [
      { ordre: '1', nom: 'A', prenom: 'a', statut: 'Absent', date: '04/08/2026',
        historique: [{ statut: 'Absent', date: '01/08/2026' }, { statut: 'Fait', date: '04/08/2026' }] }
    ]});
    const idx = settings.statuts.findIndex(s => s.label === 'Absent');
    const repli = settings.statuts[idx === 0 ? 1 : 0].label;
    try { supprimerStatut(idx); } catch (e) {}
    const c = enquetes.E[0];
    return { repli, hist: c.historique.map(h => h.statut), courant: c.statut };
  });

  // ── #3 : même statut "done" à deux dates → les deux restent, courant = plus récent ──
  results.sync_dates = await p.evaluate(() => {
    __setup(JSON.parse(JSON.stringify(__ST)), {});
    const c = { statut: 'Fait', date: '05/08/2026', historique: [{ statut: 'Fait', date: '01/08/2026' }] };
    syncStatutCourant(c);
    return { hist: c.historique.map(h => h.statut + '@' + h.date), statut: c.statut, date: c.date };
  });

  await b.close();
  await srv.close();

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const checks = [
    ['#1a réimport prénom corrigé → historique conservé',
      results.reimport_prenom.prenom === 'Jean-Pierre' && results.reimport_prenom.statut === 'Fait' && results.reimport_prenom.hist === 1],
    ['#1b ordre changé, nom+prénom+naissance → apparié',
      results.reimport_ordre_change.statut === 'Fait' && results.reimport_ordre_change.hist === 1],
    ['#1c personne différente → nouveau (pas de fausse préservation)',
      results.reimport_different.statut === '(vide)' && results.reimport_different.hist === 0],
    ['#1d même n° d\'ordre mais identité divergente → suivi NON transféré + signalé',
      results.reimport_incertain.statut === '(vide)' && results.reimport_incertain.hist === 0
      && results.reimport_incertain.nom === 'Martin' && results.reimport_incertain.incertains === 1],
    ['#1e même n° d\'ordre + naissance concordante → apparié (aucun signalement)',
      results.reimport_1signal.statut === 'Fait' && results.reimport_1signal.hist === 1
      && results.reimport_1signal.incertains === 0],
    ['#2a renommer un statut → historique migré',
      results.rename_statut.statut === 'Pas rencontré' && results.rename_statut.hist.every(s => s === 'Pas rencontré')],
    ['#2b supprimer un statut → historique migré vers le repli',
      eq(results.delete_statut.hist, ['To do', 'Fait']) && results.delete_statut.courant === 'To do'],
    ['#3 même statut « done » à 2 dates → les deux restent, courant = récent',
      results.sync_dates.hist.length === 2 && results.sync_dates.date === '05/08/2026'],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
