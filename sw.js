// Service Worker — Statbel Interviews (PWA hors-ligne)
// Incrémente CACHE à chaque mise à jour pour forcer le rafraîchissement.
const CACHE = 'statbel-v58';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];

// Installation : pré-cache de la coquille applicative
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll échouerait si une seule ressource manque ; on tolère les échecs unitaires
    await Promise.all(APP_SHELL.map(u =>
      c.add(new Request(u, { mode: u.startsWith('http') && !u.startsWith(self.location.origin) ? 'no-cors' : 'same-origin' }))
        .catch(() => {})
    ));
    self.skipWaiting();
  })());
});

// Activation : purge des anciens caches
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

// Stratégie :
//  - tuiles carte & géocodage (services géo) → réseau seul (jamais en cache,
//    données dynamiques + on ne veut pas gonfler le cache)
//  - navigation → réseau puis repli sur index.html en cache (hors-ligne)
//  - reste → cache d'abord, sinon réseau (et on met en cache au passage)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const estGeo = /irisnet\.be|wallonie\.be|vlaanderen\.be|ngi\.be|tile\.openstreetmap\.org|nominatim/.test(url.hostname);
  if (estGeo) return; // laisse le réseau gérer (pas d'interception)

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const resp = await fetch(req);
      if (resp && (resp.ok || resp.type === 'opaque')) {
        const c = await caches.open(CACHE);
        c.put(req, resp.clone());
      }
      return resp;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
