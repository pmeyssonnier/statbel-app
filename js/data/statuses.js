/*
 * js/data/statuses.js — Statuts d'interview (vocabulaire par enquête).
 *
 * Modèle par défaut + fonctions de RÉSOLUTION PURES : elles reçoivent la liste de
 * statuts (ou la map par enquête + le nom d'enquête) en paramètres et ne lisent
 * aucun état applicatif (ni `settings`, ni `enqueteActive`, ni DOM). Directement
 * testables (tests/statuses.test.js, sans navigateur).
 *
 * L'orchestrateur (js/app.js) garde de fines enveloppes globales — statutDefaut(),
 * statutDef(label), statutsActifs()… — qui lisent l'enquête active et `settings`
 * puis délèguent ici : l'état reste la responsabilité de l'UI/orchestration, la
 * logique métier vit dans ce module.
 *
 * Libellés = identifiants canoniques EN (langue pivot) ; l'affichage est traduit
 * via statutLabel() (data/canon.js). done = « traité » ; realise = interview
 * RÉALISÉE (cibles ≥15 interrogées) — un refus/absent est « traité » mais non réalisé.
 */
export const STATUTS_DEFAULTS = [
  { label:'To do',       color:'#90a4ae', icon:'✕',  done:false, rdv:false, realise:false },
  { label:'In progress', color:'#f9a825', icon:'⏳', done:false, rdv:true,  realise:false },
  { label:'Done',        color:'#2e7d32', icon:'✓',  done:true,  rdv:false, realise:true  },
  { label:'Absent',      color:'#a1887f', icon:'⊘',  done:true,  rdv:false, realise:false },
  { label:'Refusal',     color:'#c62828', icon:'✗',  done:true,  rdv:false, realise:false },
  { label:'Moved',       color:'#6a1b9a', icon:'📦', done:true,  rdv:false, realise:false },
];

// Palette contrastée par défaut (clé = label EN) — appliquée aux statuts standards
// lors de la migration pour bien distinguer les segments du graphe.
export const STATUT_COULEURS = { 'To do':'#90a4ae', 'In progress':'#f9a825', 'Done':'#2e7d32', 'Absent':'#a1887f', 'Refusal':'#c62828', 'Moved':'#6a1b9a', 'Impossible':'#d81b60' };

// Copie indépendante du modèle par défaut (repli + base d'une nouvelle install).
export const cloneStatuts = () => STATUTS_DEFAULTS.map(s => Object.assign({}, s));

// Résout le vocabulaire d'une enquête : sa liste propre si définie et non vide,
// sinon le modèle global (repli). Renvoie la MÊME référence que statutsGlobaux au
// repli (pas de copie). Pur.
export function resoudreStatuts(statutsGlobaux, statutsParEnquete, nom) {
  const m = statutsParEnquete;
  return (nom && m && Array.isArray(m[nom]) && m[nom].length) ? m[nom] : statutsGlobaux;
}

// Label du statut par défaut d'une liste (le premier), repli « To do ». Pur.
export function statutDefautDe(statuts) {
  return ((statuts && statuts[0]) || { label: 'To do' }).label;
}

// Définition d'un statut par label dans une liste : correspondance exacte, sinon
// le premier, sinon un statut de repli neutre. Pur.
export function statutDefDe(statuts, label) {
  const arr = statuts || [];
  return arr.find(s => s.label === label)
      || arr[0]
      || { label, color:'#90a4ae', icon:'•', done:false, rdv:false };
}

// Sème le vocabulaire de chaque enquête (noms) depuis statutsGlobaux dans la map
// `statutsParEnquete` (MUTÉE en place), une seule fois par enquête (idempotent).
// Ne persiste rien : renvoie true si au moins une entrée a été ajoutée, à charge
// de l'appelant de sauvegarder. Pur (hors mutation de l'argument).
export function semerStatutsParEnquete(statutsParEnquete, statutsGlobaux, noms) {
  let chg = false;
  (noms || []).forEach(nom => {
    if (!Array.isArray(statutsParEnquete[nom]) || !statutsParEnquete[nom].length) {
      statutsParEnquete[nom] = statutsGlobaux.map(s => ({ ...s }));   // clone profond
      chg = true;
    }
  });
  return chg;
}
