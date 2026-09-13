// Service Worker — Statbel Interviews (PWA hors-ligne)
// Incrémente CACHE à chaque mise à jour pour forcer le rafraîchissement.
const CACHE = 'statbel-v335';

// Ressources CRITIQUES : indispensables au fonctionnement hors-ligne. Si l'une
// manque, l'installation doit ÉCHOUER (ne pas activer un cache incomplet qui
// ferait croire à une PWA installée mais cassée hors-ligne).
const APP_CRITICAL = [
  './',
  './index.html',
  './statbel_converter.html',
  './statbel_planner.html',
  './statbel_pdf2grp.html',
  './js/pdfgrp.js',
  './js/charts.js',
  './css/base.css',
  './css/summary.css',
  './css/modals.css',
  './css/mobile.css',
  './css/charts.css',
  './js/boot.js',
  './js/app.js',
  './js/core/util.js',
  './js/core/i18n.js',
  './js/core/actions.js',
  './js/ui/pin.js',
  './js/ui/biometrie.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './js/ui/map.js',
  './js/ui/contacts.js',
  './js/ui/rdv.js',
  './js/ui/resume.js',
  './js/data/idb.js',
  './js/data/csv.js',
  './js/data/canon.js',
  './js/data/collect-method.js',
  './js/data/statuses.js',
  './js/data/reimport.js',
  './js/data/serialization.js',
  './js/features/geocoding.js',
  './js/features/history.js',
  './js/features/import.js',
  './js/features/backup.js',
  './js/features/reminders.js',
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
  './favicon.ico',
  './favicon-32.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-192-mask.png',
  './icon-512-mask.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  // pdf.js (import PDF du convertisseur) — volumineux, mis en cache best-effort
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  // Manuel d'utilisation illustré — volumineux (captures en data-URI), best-effort
  './docs/manuel.html'
];
const APP_SHELL = APP_CRITICAL.concat(APP_OPTIONAL);   // pour la stratégie fetch

// Installation : les critiques via addAll() (atomique → échec si l'une manque),
// les optionnelles en best-effort (échecs unitaires tolérés).
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(APP_CRITICAL);
    await Promise.all(APP_OPTIONAL.map(u => c.add(u).catch(() => {})));
    // Pas de skipWaiting() automatique : le nouveau SW reste en attente
    // (« waiting ») et ne prend la main QUE lorsque l'utilisateur choisit de
    // poser la mise à jour via le popup (message SKIP_WAITING ci-dessous).
    // Au tout premier install (aucun SW actif), l'activation est immédiate de
    // toute façon — l'app fonctionne hors-ligne dès le départ.
  })());
});

// Pose de la mise à jour à la demande : la page envoie SKIP_WAITING quand
// l'utilisateur clique « Poser » → le SW en attente s'active, purge les vieux
// caches, prend le contrôle (clients.claim) → la page se recharge une fois.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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
    // Navigation « cache d'abord » : la page HTML et les scripts/CSS proviennent
    // ainsi TOUJOURS du même cache, donc de la MÊME version. Auparavant l'index
    // était récupéré frais (réseau) tandis que les scripts restaient servis « cache
    // d'abord » : pendant la fenêtre de mise à jour (nouveau SW « en attente »), un
    // index.html neuf pouvait être servi avec un app.js encore périmé → HTML/JS
    // désynchronisés (depuis la migration onclick→data-act : boutons sans routeur
    // enregistré → interface figée). Le popup « Mise à jour disponible » reste servi
    // (il vit dans l'index.html en cache, présent dans toutes les versions) et le
    // cycle SW (nouveau cache → « Poser » → SKIP_WAITING → activate/claim → reload)
    // fait basculer HTML ET scripts atomiquement vers la nouvelle version. Repli
    // réseau si l'URL demandée n'est pas en cache (1er lancement, lien profond).
    e.respondWith(
      caches.match(req)
        .then(r => r || caches.match('./index.html'))
        .then(r => r || fetch(req))
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
