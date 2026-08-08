/*
 * Tests de non-régression — Content-Security-Policy (les 3 apps)
 *
 * Vérifie que la CSP pragmatique (<meta http-equiv>) ne bloque AUCUNE ressource
 * légitime : chargement des pages, script/style inline conservés, module ES,
 * tuiles de carte (img https:) et connexions aux géocodeurs régionaux
 * (connect-src). Une CSP mal réglée déclencherait un événement
 * `securitypolicyviolation` — on en capture zéro.
 *
 * NB : une requête réseau AUTORISÉE par la CSP mais qui échoue faute de réseau
 * (environnement hors-ligne) ne déclenche PAS de violation CSP — c'est bien la
 * politique qu'on teste ici, pas la connectivité.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/csp.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
const PAGES = ['/index.html', '/statbel_planner.html', '/statbel_converter.html', '/statbel_pdf2grp.html'];

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const results = {};

  for (const path of PAGES) {
    const p = await b.newPage();
    // Collecte des violations CSP réelles (déclenchées avant toute requête réseau)
    await p.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => {
        window.__csp.push(e.violatedDirective + ' ← ' + (e.blockedURI || '(inline)'));
      });
    });
    await p.goto(srv.url + path, { waitUntil: 'load' });
    await p.waitForTimeout(700);

    // Sur l'app Interviews : exercer la carte (tuiles → img-src) et une connexion
    // géocodeur (→ connect-src). L'échec réseau est attendu et sans effet ici.
    if (path === '/index.html') {
      await p.evaluate(async () => {
        try { setView('carte'); } catch (e) {}
        // fetch vers un géocodeur régional autorisé : ne doit PAS violer connect-src
        try { await fetch('https://geoservices.wallonie.be/geocodeWS/ping'); } catch (e) {}
        try { await fetch('https://nominatim.openstreetmap.org/search?q=x'); } catch (e) {}
      });
      await p.waitForTimeout(500);
    }

    results[path] = await p.evaluate(() => window.__csp.slice());
    await p.close();
  }

  await b.close();
  await srv.close();

  let ok = true;
  for (const path of PAGES) {
    const v = results[path] || [];
    const pass = v.length === 0;
    console.log((pass ? '✓ PASS ' : '✗ FAIL ') + 'aucune violation CSP — ' + path);
    if (!pass) { console.log('   violations:', v); ok = false; }
  }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
