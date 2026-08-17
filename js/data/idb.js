/*
 * js/data/idb.js — Couche de persistance : IndexedDB (enquêtes) + localStorage
 * (coordonnées, préférence d'enquête active) et l'indicateur d'état de
 * sauvegarde associé. Extrait de js/app.js (découpage en modules ES).
 *
 * Dépendances : adresseSansBoite (util) ; l'état mutable partagé (db, enquetes,
 * enqueteActive, _lastSaved) et t() sont des globaux (globalThis / pont de
 * compatibilité). Réexporté et réexposé au global par app.js.
 */
import { adresseSansBoite } from '../core/util.js';

// ════════════════════════════════════════════════════════════════════
// STORAGE — IndexedDB (enquêtes) + localStorage (coords, prefs)
// ════════════════════════════════════════════════════════════════════

const DB_NAME    = 'StatbelInterviewer';
const DB_VERSION = 1;
globalThis.db = null;   // global partagé (tests headless ouvrent des transactions)
let dbPromise = null;   // promesse de connexion mémorisée (évite double ouverture / race)

/** Ouvre (ou crée) la base IndexedDB — une seule connexion, partagée. */
export function ouvrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains('enquetes'))
        idb.createObjectStore('enquetes', { keyPath: 'nom' });
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = e => { dbPromise = null; reject(e.target.error); };
  });
  return dbPromise;
}

/** Promesse sur un IDBRequest */
export function idbReq(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

/** Promesse sur la complétion d'une transaction IDB */
export function idbTx(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  });
}

/** Sauvegarde toutes les enquêtes dans IndexedDB (fire-and-forget) */
// Indicateur d'état de sauvegarde (en-tête) : ⏳ en cours · ✓ enregistré · ⚠️ erreur
let _saveErrAlerted = false;
export function majEtatSauvegarde(etat) {
  const el = document.getElementById('saveState');
  if (!el) return;
  const map = {
    saving: { t: '⏳', c: '#888',    title: 'Enregistrement…' },
    ok:     { t: '✓',  c: '#2e7d32', title: 'Modifications enregistrées' },
    error:  { t: '⚠️', c: '#c62828', title: 'Erreur de stockage — faites une sauvegarde JSON' },
  }[etat] || {};
  el.textContent = map.t || '';
  el.style.color = map.c || '';
  el.title = map.title || '';
  el.dataset.state = etat || '';
}

export function signalerEchecSauvegarde(e) {
  console.error('sauvegarde impossible:', e);
  majEtatSauvegarde('error');
  if (!_saveErrAlerted) {   // une seule alerte bloquante ; l'indicateur ⚠️ reste visible ensuite
    _saveErrAlerted = true;
    const msg = (typeof t === 'function' && t('al_save_failed') !== 'al_save_failed')
      ? t('al_save_failed')
      : '⚠️ Les dernières modifications n\'ont pas pu être enregistrées.\nFaites une sauvegarde JSON (⋮ → Sauvegarder) dès que possible.';
    try { alert(msg); } catch(_) {}
  }
}

globalThis._lastSaved = {};   // nom -> JSON du dernier état persisté (n'écrire que le modifié) — global partagé (tests)
export async function sauver() {
  majEtatSauvegarde('saving');
  if (!db) {
    // db pas encore prête : on attend l'initialisation au lieu d'abandonner
    try { await ouvrirDB(); } catch(e) { signalerEchecSauvegarde(e); return; }
  }
  try {
    const tx    = db.transaction('enquetes', 'readwrite');
    const store = tx.objectStore('enquetes');
    // N'écrire QUE les enquêtes modifiées depuis la dernière sauvegarde
    // (au lieu d'un clear() + réécriture complète à chaque petit changement).
    const aEcrire = [];
    for (const [nom, cts] of Object.entries(enquetes)) {
      const snap = JSON.stringify(cts);
      if (_lastSaved[nom] !== snap) { store.put({ nom, contacts: cts }); aEcrire.push([nom, snap]); }
    }
    // Supprimer les enquêtes retirées
    const aSupprimer = Object.keys(_lastSaved).filter(nom => !(nom in enquetes));
    aSupprimer.forEach(nom => store.delete(nom));
    await idbTx(tx);
    // Transaction validée → on mémorise l'état persisté. Jamais avant : sinon un
    // échec ferait « oublier » une écriture non faite (= perte silencieuse).
    aEcrire.forEach(([nom, snap]) => { _lastSaved[nom] = snap; });
    aSupprimer.forEach(nom => { delete _lastSaved[nom]; });
    // Garde-fou backup : une écriture réelle = modifications non sauvegardées
    // depuis la dernière sauvegarde (drapeau levé jusqu'au prochain export).
    if (aEcrire.length || aSupprimer.length) localStorage.setItem('statbel_backup_dirty', '1');
    localStorage.setItem('statbel_active', enqueteActive);
    majEtatSauvegarde('ok');
    _saveErrAlerted = false;
  } catch(e) { signalerEchecSauvegarde(e); }
}

/** Charge toutes les enquêtes depuis IndexedDB, avec migration localStorage → IDB */
export async function charger() {
  db = await ouvrirDB();

  // Migration : si IDB est vide et localStorage contient des données, on importe
  const count = await idbReq(db.transaction('enquetes','readonly').objectStore('enquetes').count());
  if (count === 0) {
    const raw = localStorage.getItem('statbel_enquetes');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        const tx    = db.transaction('enquetes', 'readwrite');
        const store = tx.objectStore('enquetes');
        for (const [nom, cts] of Object.entries(data)) store.put({ nom, contacts: cts });
        await idbTx(tx);
        localStorage.removeItem('statbel_enquetes');
        console.info('✅ Migration localStorage → IndexedDB effectuée');
      } catch(e) { console.warn('Erreur migration:', e); }
    }
  }

  // Charger les enquêtes
  const items = await idbReq(db.transaction('enquetes','readonly').objectStore('enquetes').getAll());
  enquetes = {};
  items.forEach(item => { enquetes[item.nom] = item.contacts; });
  // Amorce _lastSaved à l'état persisté : évite une réécriture inutile au 1er
  // save ET fiabilise la détection des modifications non sauvegardées (backup) —
  // sinon le 1er sauver() après chargement réécrirait tout et lèverait un faux « dirty ».
  _lastSaved = {};
  Object.entries(enquetes).forEach(([nom, cts]) => { _lastSaved[nom] = JSON.stringify(cts); });
  enqueteActive = localStorage.getItem('statbel_active') || Object.keys(enquetes)[0] || '';
}

/** Cache de coordonnées — localStorage (accès synchrone requis dans le rendu) */
export function coordsCache(adresse) {
  const raw = localStorage.getItem('coords_' + adresseSansBoite(adresse));
  return raw ? JSON.parse(raw) : null;
}
export function saveCoords(adresse, lat, lng) {
  localStorage.setItem('coords_' + adresseSansBoite(adresse), JSON.stringify({ lat, lng }));
}
