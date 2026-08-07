// Service Worker — Statbel Interviews (PWA hors-ligne)
// Incrémente CACHE à chaque mise à jour pour forcer le rafraîchissement.
const CACHE = 'statbel-v188';

// Ressources CRITIQUES : indispensables au fonctionnement hors-ligne. Si l'une
// manque, l'installation doit ÉCHOUER (ne pas activer un cache incomplet qui
// ferait croire à une PWA installée mais cassée hors-ligne).
const APP_CRITICAL = [
  './',
  './index.html',
  './statbel_converter.html',
  './statbel_planner.html',
  './css/base.css',
  './css/summary.css',
  './css/modals.css',
  './css/mobile.css',
  './js/app.js',
  './js/core/util.js',
  './js/core/i18n.js',
  './js/ui/pin.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './js/ui/map.js',
  './js/ui/contacts.js',
  './js/ui/rdv.js',
  './js/ui/resume.js',
  './js/data/idb.js',
  './js/data/csv.js',
  './js/data/canon.js',
  './js/features/geocoding.js',
  './js/features/history.js',
  './js/features/import.js',
  './js/features/backup.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/xlsx/xlsx.full.min.js'
];
// Ressources OPTIONNELLES : confort (icônes PWA, variantes retina, calques).
// Leur absence ne doit pas faire échouer l'installation.
const APP_OPTIONAL = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  // pdf.js (import PDF du convertisseur) — volumineux, mis en cache best-effort
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js'
];
const APP_SHELL = APP_CRITICAL.concat(APP_OPTIONAL);   // pour la stratégie fetch

// Installation : les critiques via addAll() (atomique → échec si l'une manque),
// les optionnelles en best-effort (échecs unitaires tolérés).
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(APP_CRITICAL);
    await Promise.all(APP_OPTIONAL.map(u => c.add(u).catch(() => {})));
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
    // Navigation : on récupère toujours la page fraîche depuis le réseau en
    // contournant le cache HTTP du navigateur (sinon une ancienne page peut
    // être servie). Repli hors-ligne sur la page demandée puis sur index.html.
    e.respondWith(
      fetch(new Request(req.url, { cache: 'reload' }))
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
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
