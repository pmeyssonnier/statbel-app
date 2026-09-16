// Service Worker — Statbel Interviews (PWA hors-ligne)
// Incrémente CACHE à chaque mise à jour pour forcer le rafraîchissement.
const CACHE = 'statbel-v400';

// Ressources CRITIQUES : indispensables au fonctionnement hors-ligne. Si l'une
// manque, l'installation doit ÉCHOUER (ne pas activer un cache incomplet qui
// ferait croire à une PWA installée mais cassée hors-ligne).
const APP_CRITICAL = [
  './',
  './index.html',
  './statbel_converter.html',
  './statbel_planner.html',
  './js/pdfgrp.js',
  './js/converter/i18n.js',
  './js/converter/import-normalisation.js',
  './js/converter/export-conversion.js',
  './js/converter/ui.js',
  './js/converter/refdata.js',
  './js/cand-docx.js',
  './js/planner/i18n-data.js',
  './js/planner/lecture.js',
  './js/planner/plannings-filters.js',
  './js/planner/views.js',
  './js/planner/exports.js',
  './js/planner/sauvegarde.js',
  './js/planner/geocoding.js',
  './js/planner/candidature.js',
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
//  - navigation → cache d'abord (index.html même version que les scripts), repli réseau
//  - reste → cache d'abord, sinon réseau (et on met en cache au passage)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const estGeo = /irisnet\.be|wallonie\.be|vlaanderen\.be|ngi\.be|tile\.openstreetmap\.org|nominatim/.test(url.hostname);
  if (estGeo) return; // laisse le réseau gérer (pas d'interception)

  if (req.mode === 'navigate') {
    // Navigation « cache d'abord » : une page HTML EN CACHE (index / convertisseur /
    // planner) est servie depuis le cache → HTML et scripts/CSS proviennent TOUJOURS
    // de la MÊME version (évite la désynchro HTML/JS pendant une fenêtre de mise à
    // jour ; cf. migration onclick→data-act). `ignoreSearch` : une éventuelle query
    // (index.html?x) tape quand même le shell en cache, jamais le réseau.
    // Sinon (page NON mise en cache : docs/manuel.html, docs/referentiels.html, lien
    // profond) → RÉSEAU d'abord ; ce n'est qu'HORS-LIGNE, en dernier recours, qu'on
    // retombe sur le shell de l'app. Auparavant toute navigation non cachée renvoyait
    // index.html même EN LIGNE → les pages docs/ étaient inaccessibles (bug E2).
    e.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;                                  // shell en cache → version cohérente
      try { return await fetch(req); }                           // page non cachée (docs/…) → réseau
      catch (e2) { return (await caches.match('./index.html')) || Response.error(); }  // hors-ligne → shell
    })());
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
