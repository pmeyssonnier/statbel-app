/*
 * js/core/actions.js — Routeur de délégation d'événements (Interviews).
 *
 * Objectif du chantier (voir docs/chantier-delegation-onclick.md) : remplacer
 * les handlers HTML inline (`onclick=`, `onchange=`, `oninput=`) par de la
 * délégation. Un écouteur unique par type d'événement est posé sur `document` ;
 * au déclenchement, on remonte au plus proche élément portant `data-act` et on
 * appelle l'action enregistrée sous ce nom, en lui passant l'élément (d'où elle
 * lit ses `data-*`) et l'événement.
 *
 * Avantages : les actions restent des fonctions de module normales (plus besoin
 * du pont `window` pour être atteignables), la délégation couvre nativement les
 * éléments recréés au rendu (pas de re-binding), et le HTML devient sans script
 * inline (permet, en fin de chantier, de retirer `'unsafe-inline'` de la CSP).
 *
 * La logique de dispatch (`_dispatch`) est séparée de l'installation DOM
 * (`installerDelegation`) → testable sans navigateur (tests/actions.test.js).
 */

// Registre : { type d'événement → { nom d'action → fonction(el, event) } }.
// `focusout` est utilisé plutôt que `blur` car ce dernier ne « bulle » pas
// (la délégation sur `document` ne le verrait pas) ; `focusout` en est la
// variante propagée.
const _actions = { click: {}, change: {}, input: {}, keydown: {}, dblclick: {}, mousedown: {}, focusout: {} };

// Enregistre (ou complète) les actions d'un type d'événement. Appelé par chaque
// module d'écran au fil de la migration.
export function registerActions(type, map) {
  if (!_actions[type]) _actions[type] = {};
  Object.assign(_actions[type], map);
}

// Dispatch pur (sans DOM) : trouve l'action `el.dataset.act` pour ce type et
// l'exécute. Renvoie true si une action a été trouvée et appelée, false sinon
// (élément absent, sans `data-act`, ou action non enregistrée → ignoré sans
// erreur, pour coexister avec les `onclick` non encore migrés).
export function _dispatch(type, el, event) {
  const table = _actions[type];
  const nom = el && el.dataset ? el.dataset.act : undefined;
  if (!table || !nom || !table[nom]) return false;
  table[nom](el, event);
  return true;
}

// Installe les écouteurs délégués (une seule fois, depuis init()).
export function installerDelegation(doc = document) {
  const relai = type => event => {
    const cible = event.target;
    const el = cible && cible.closest ? cible.closest('[data-act]') : null;
    if (el) _dispatch(type, el, event);
  };
  ['click', 'change', 'input', 'keydown', 'dblclick', 'mousedown', 'focusout'].forEach(type => doc.addEventListener(type, relai(type)));
}

// Réinitialise le registre — réservé aux tests (isolation entre cas).
export function _resetActions() {
  for (const k in _actions) _actions[k] = {};
}
