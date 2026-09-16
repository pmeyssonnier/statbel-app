/*
 * Test de non-régression — bug E2 : le service worker ne renvoie plus index.html
 * pour TOUTE navigation non mise en cache.
 *
 * Avant : navigate → caches.match(req) || caches.match('./index.html') || fetch(req).
 * index.html étant toujours en cache, fetch(req) n'était jamais atteint → une page
 * NON cachée (docs/manuel.html, docs/referentiels.html…) recevait l'app Interviews
 * au lieu de son contenu, même EN LIGNE.
 *
 * On charge sw.js dans un bac à sable (self/caches/fetch simulés) et on dispatche
 * des évènements « fetch » de navigation. Aucune dépendance navigateur.
 *
 * Lancer :  node tests/sw-navigation.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

const BASE = 'https://example.test/app/';
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

// Pages RÉELLEMENT en cache (extrait d'APP_CRITICAL, en URL absolues).
const cacheSet = new Set([BASE, BASE + 'index.html', BASE + 'statbel_converter.html']);
const norm = (u, ignoreSearch) => (ignoreSearch ? u.split('?')[0] : u);
const inCache = (u, ignoreSearch) =>
  [...cacheSet].some(k => norm(k, ignoreSearch) === norm(u, ignoreSearch));

const caches = {
  match(arg, opts) {
    const u = typeof arg === 'string' ? new URL(arg, BASE).href : arg.url;
    const is = !!(opts && opts.ignoreSearch);
    return Promise.resolve(inCache(u, is) ? { __src: 'CACHE', __url: u } : undefined);
  },
  open() { return Promise.resolve({ addAll: () => Promise.resolve(), add: () => Promise.resolve(), put() {} }); },
  keys() { return Promise.resolve([]); },
  delete() { return Promise.resolve(true); },
};

const handlers = {};
const ctx = {
  self: { addEventListener: (t, fn) => { handlers[t] = fn; }, clients: { claim() {} }, skipWaiting() {} },
  caches,
  fetch: null,   // (re)défini par cas de test
  Response: { error: () => ({ __src: 'NETERR', __url: '' }) },
  URL,
  clients: { claim() {} },
  console,
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

// Dispatche une navigation et renvoie la Response résolue par respondWith.
async function navigate(urlStr, { offline = false } = {}) {
  ctx.fetch = offline
    ? () => Promise.reject(new Error('offline'))
    : (r) => Promise.resolve({ __src: 'NET', __url: (r && r.url) || String(r) });
  const req = { url: urlStr, method: 'GET', mode: 'navigate' };
  let responded;
  handlers.fetch({ request: req, respondWith: (p) => { responded = p; } });
  return responded ? await responded : undefined;
}

(async () => {
  // 1. Page en cache (le shell) → servie DEPUIS le cache (version cohérente)
  const r1 = await navigate(BASE + 'index.html');
  A(r1 && r1.__src === 'CACHE' && /index\.html$/.test(r1.__url), `index.html → cache (got ${r1 && r1.__src})`);

  // 2. Autre page en cache (Convertisseur) → cache
  const r2 = await navigate(BASE + 'statbel_converter.html');
  A(r2 && r2.__src === 'CACHE', `statbel_converter.html → cache (got ${r2 && r2.__src})`);

  // 3. Shell avec query (?x) → ignoreSearch → cache (pas de fetch réseau, pas de désynchro)
  const r3 = await navigate(BASE + 'index.html?x=1');
  A(r3 && r3.__src === 'CACHE', `index.html?x → cache via ignoreSearch (got ${r3 && r3.__src})`);

  // 4. Page NON cachée EN LIGNE → RÉSEAU (le cœur du bug E2 : plus index.html)
  const r4 = await navigate(BASE + 'docs/manuel.html');
  A(r4 && r4.__src === 'NET' && /docs\/manuel\.html$/.test(r4.__url),
    `docs/manuel.html en ligne → réseau, PAS le shell (got ${r4 && r4.__src} ${r4 && r4.__url})`);

  // 5. Page NON cachée HORS-LIGNE → repli sur le shell (SPA)
  const r5 = await navigate(BASE + 'docs/manuel.html', { offline: true });
  A(r5 && r5.__src === 'CACHE' && /index\.html$/.test(r5.__url),
    `docs/manuel.html hors-ligne → repli shell (got ${r5 && r5.__src})`);

  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
