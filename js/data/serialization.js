/*
 * js/data/serialization.js — Sérialisation des fiches : modèle interne (FR) ↔
 * pivot anglais (export / backup / CSV).
 *
 * Fonctions PURES : renommage de clés uniquement, aucune lecture d'état applicatif
 * (`enquetes`, `settings`), ni DOM, ni stockage, ni i18n → testables par appel
 * direct (tests/serialization.test.js).
 *
 * L'orchestration du backup (écriture/lecture du fichier, bannière, comparaison,
 * restauration) reste dans js/features/backup.js, qui consomme ce module.
 */

// Clés de champs : modèle interne (FR) → pivot anglais (export/backup). Source
// unique ; le sens inverse (KEYMAP_IN) est DÉRIVÉ pour éviter toute divergence.
const KEYMAP_OUT = { prenom:'first_name', nom:'last_name', adresse:'address', ordre:'order', sexe:'sex', statut:'status', historique:'history', taille_menage:'household_size', gsm:'mobile_number', rdv:'appointment' };
const KEYMAP_IN  = Object.fromEntries(Object.entries(KEYMAP_OUT).map(([fr, en]) => [en, fr]));

// Renomme les clés d'un objet selon `map` (les clés absentes de la map sont conservées).
export function renommerCles(c, map) { const o = {}; for (const k in c) o[map[k] || k] = c[k]; return o; }

// Fiche : modèle interne (FR) → pivot EN (renomme aussi les entrées d'historique).
export function contactVersEN(c) {
  const o = renommerCles(c, KEYMAP_OUT);
  if (Array.isArray(o.history)) o.history = o.history.map(h => renommerCles(h, { statut:'status' }));
  return o;
}

// Fiche : pivot EN → modèle interne (FR).
export function contactVersInterne(c) {
  const o = renommerCles(c, KEYMAP_IN);
  if (Array.isArray(o.historique)) o.historique = o.historique.map(h => renommerCles(h, { status:'statut' }));
  return o;
}

// Enquêtes complètes (map { nom → fiches[] }) converties dans chaque sens.
export function enquetesVersEN(enq) { const r = {}; Object.entries(enq).forEach(([n, arr]) => r[n] = arr.map(contactVersEN)); return r; }
export function enquetesVersInterne(enq) { const r = {}; Object.entries(enq).forEach(([n, arr]) => r[n] = arr.map(contactVersInterne)); return r; }
