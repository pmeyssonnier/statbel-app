/*
 * js/data/collect-method.js — Méthode de collecte (CAPI / CATI / CAWI).
 *
 * Logique métier PURE et UNIQUE pour Interviews : classification d'une valeur
 * brute de méthode de collecte (colonne Statbel CD_WSH_CLCT_MTHD) à partir des
 * libellés rencontrés dans les exports. Aucune dépendance DOM ni état global →
 * directement testable (tests/collect-method.test.js).
 *
 * Convention : CAPI (face-à-face) = ni CATI ni CAWI (méthode absente, « CAPI »,
 * ou valeur non reconnue).
 *
 * Ces deux regex sont la SOURCE UNIQUE côté Interviews (badge de fiche,
 * classement du Résumé, préréglage de statuts des Réglages). Le Convertisseur,
 * mono-fichier ouvrable en file://, ne peut pas importer ce module : il garde sa
 * propre copie dans collecteInfo() — tests/collect-method.test.js vérifie que les
 * regex restent alignées entre les deux.
 */
export const RE_CAWI = /CAWI|WEB|INTERNET|ONLINE|EN\s?LIGNE/;
export const RE_CATI = /CATI|T[ÉE]L|PHONE|TELEPH/;

// Classe une méthode de collecte brute → 'cawi' | 'cati' | '' (CAPI / inconnu).
// CAWI testé avant CATI (ordre historique de l'UI ; les libellés ne se recouvrent pas).
export function classerMethode(v) {
  const u = String(v || '').toUpperCase();
  if (RE_CAWI.test(u)) return 'cawi';
  if (RE_CATI.test(u)) return 'cati';
  return '';
}

// true si la méthode est CATI ou CAWI (c.-à-d. à distance, ≠ CAPI face-à-face).
export function estCatiCawi(v) {
  return classerMethode(v) !== '';
}
