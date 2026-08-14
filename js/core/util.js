/*
 * js/core/util.js — Fonctions utilitaires PURES (aucune dépendance à l'état
 * applicatif : ni settings, ni enquetes, ni DOM, ni i18n). Extraites de
 * js/app.js dans le cadre du découpage en modules ES. Réimportées et
 * réexposées au global par app.js (pont de compatibilité).
 */


let _debounceTimer;

export function debounce(fn, delai) {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(fn, delai || 200);
}

/** Neutralise les caractères HTML dangereux avant insertion via innerHTML */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Recherche libre : nom, prénom, adresse, et numéro de téléphone
 *  (tolérant au formatage — comparaison des chiffres seuls). */
export function correspondRecherche(c, q) {
  if (!q) return true;
  const hay = (c.prenom + ' ' + c.nom + ' ' + c.adresse + ' ' + (c.gsm || '')).toLowerCase();
  if (hay.includes(q)) return true;
  const qd = q.replace(/\D/g, '');
  if (!qd) return false;
  const dg = (c.gsm || '').replace(/\D/g, '');
  // équivalence numéro belge : 0467… ↔ +32 467…
  return dg.includes(qd) || dg.includes(qd.replace(/^0/, '32'));
}

// ════════════════════════════════════════════════════════════════════
// CONFIG GÉO + PARAMÈTRES — fournisseurs de carte/géocodage
// ════════════════════════════════════════════════════════════════════
//
// Chaque fournisseur regroupe À LA FOIS le fond de carte (tuiles) ET le
// géocodage (adresse → coordonnées). Le choix se fait désormais dans le
// panneau ⚙️ Paramètres (plus besoin d'éditer le code).
//
// Détermine la région d'un code postal belge (pour le mode « Automatique »).
//  1000-1299 → Bruxelles ; 1300-1499 + 4000-7999 → Wallonie ; le reste → Flandre.
export function regionPourCP(cp) {
  const n = parseInt(cp, 10);
  if (!n) return 'bruxelles';
  if (n >= 1000 && n <= 1299) return 'bruxelles';
  if ((n >= 1300 && n <= 1499) || (n >= 4000 && n <= 7999)) return 'wallonie';
  return 'flandre';
}

export function parseAdresse(adresse) {
  if (!adresse) return { rue: '', boite: '', cpville: '' };
  const comma = adresse.indexOf(',');
  const avant = comma >= 0 ? adresse.slice(0, comma).trim() : adresse.trim();
  const apres = comma >= 0 ? adresse.slice(comma + 1).trim() : '';
  const bteMatch =
    avant.match(/\s+(b(?:o[iî]te?|te?|us|ox|t)?\.?\s*\d+[a-z]?)$/i) ||
    avant.match(/\s+((?:é|e)tages?\s*\d*[a-z]?)$/i) ||
    avant.match(/\s+(ET[-]?[A-Z0-9]{1,4})$/i) ||
    avant.match(/\s+(app?t?\.?\s*\d+[a-z]?)$/i) ||
    avant.match(/(\s*\/[A-Z0-9]+)$/i);
  let boite = bteMatch ? bteMatch[1].trim() : '';
  let rue   = bteMatch ? avant.slice(0, bteMatch.index).trim() : avant;
  // Boîte/appartement en numéro nu après le numéro de rue : « 192 5 » → rue « 192 », boîte « 5 »
  if (!bteMatch) {
    const m = avant.match(/^(.*\d)\s+(\d{1,4}[a-z]?)$/i);
    if (m) { rue = m[1].trim(); boite = m[2].trim(); }
  }
  return { rue, boite, cpville: apres };
}

export function composeAdresse(rue, boite, cpville) {
  let a = (rue || '').trim();
  if ((boite || '').trim()) a += ' ' + boite.trim();
  if ((cpville || '').trim()) a += ', ' + cpville.trim();
  return a;
}

export function adresseSansBoite(adresse) {
  const p = parseAdresse(adresse);
  return composeAdresse(p.rue, '', p.cpville);
}

export function todayStr() {
  const now = new Date();
  return ('0'+now.getDate()).slice(-2)+'/'+('0'+(now.getMonth()+1)).slice(-2)+'/'+now.getFullYear();
}

export function nowHHMM() {
  const now = new Date();
  return ('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);
}

/** Convertit DD/MM/YYYY en YYYY-MM-DD pour comparaison de tri */
export function dateFrToISO(d) {
  if (!d) return '';
  const p = d.split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
}

/** Convertit YYYY-MM-DD (input date) en DD/MM/YYYY */
export function dateISOToFr(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
}

/**
 * Normalise une date vers l'ISO AAAA-MM-JJ. Tolère les formats qu'Excel
 * réinjecte quand on ouvre/édite/ré-enregistre un export (JJ/MM/AAAA, JJ-MM-AA,
 * M/D/YY…), en plus de l'ISO déjà correct. `moisDabord` = true interprète les
 * dates numériques comme MOIS/JOUR (format US mm/jj/aaaa), sinon JOUR/MOIS
 * (défaut Europe). Retourne '' si non reconnu (l'appelant conserve alors la
 * valeur brute pour que le contrôle la signale).
 */
export function toISODate(v, moisDabord) {
  const s = (v == null ? '' : v).toString().trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                       // déjà ISO
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);   // jj/mm/aaaa, mm/jj/aa & variantes
  if (!m) return '';
  let a = +m[1], b = +m[2], y = +m[3];
  const d  = moisDabord ? b : a;                                     // jour
  const mo = moisDabord ? a : b;                                     // mois
  if (y < 100) { y = 2000 + y; if (y > new Date().getFullYear()) y -= 100; } // pivot de siècle
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Devine si une colonne de dates numériques est au format MOIS d'abord
 * (mm/jj/aaaa — typiquement réécrit par un Excel en locale US) plutôt que JOUR
 * d'abord (jj/mm). Preuve par l'absurde sur l'ensemble de la colonne : un 1er
 * composant > 12 quelque part ⇒ jour d'abord ; un 2e composant > 12 ⇒ mois
 * d'abord. Sans preuve (tout ≤ 12), on garde le défaut Europe (jour d'abord).
 * Une seule date « désambiguïsante » (ex. 4/14/05) fixe l'ordre de toute la colonne.
 */
export function colonneMoisDabord(values) {
  let jourSur = false, moisSur = false;
  for (const v of (values || [])) {
    const m = (v == null ? '' : v).toString().trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}$/);
    if (!m) continue;
    if (+m[1] > 12) jourSur = true;   // 1er composant impossible en mois → jour d'abord
    if (+m[2] > 12) moisSur = true;   // 2e composant impossible en mois → mois d'abord
  }
  return moisSur && !jourSur;         // mois d'abord seulement si preuve claire et non contredite
}

/**
 * Normalise une date (+ heure éventuelle) vers « JJ/MM/AAAA[ HH:mm] », le format
 * interne des champs date d'interview / RDV. Détache une heure finale « HH:mm »
 * (ou « HHhMM »), normalise la partie date (jour d'abord), puis recompose. Si la
 * date n'est pas reconnue, la valeur brute est renvoyée telle quelle.
 */
export function toFrDateTime(v) {
  const s = (v == null ? '' : v).toString().trim();
  if (!s) return '';
  const mt = s.match(/^(.*?)[\sT]+(\d{1,2}[:h]\d{2})\s*$/);          // partie heure finale ?
  const datePart = mt ? mt[1].trim() : s;
  const timePart = mt ? mt[2].replace('h', ':') : '';
  const iso = toISODate(datePart);
  const fr = iso ? dateISOToFr(iso) : datePart;                     // non reconnu → tel quel
  return timePart ? `${fr} ${timePart}` : fr;
}

export function formaterGsm(val) {
  let d = val.replace(/[^\d]/g, '');
  if (d.startsWith('0')) d = '32' + d.slice(1);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? '+' + d : '';
  if (d.length <= 5) return '+' + d.slice(0,2) + ' ' + d.slice(2);
  if (d.length <= 7) return '+' + d.slice(0,2) + ' ' + d.slice(2,5) + ' ' + d.slice(5);
  if (d.length <= 9) return '+' + d.slice(0,2) + ' ' + d.slice(2,5) + ' ' + d.slice(5,7) + ' ' + d.slice(7);
  return '+' + d.slice(0,2) + ' ' + d.slice(2,5) + ' ' + d.slice(5,7) + ' ' + d.slice(7,9) + ' ' + d.slice(9,11);
}

/** Insère les ':' pendant la saisie de l'heure : 0930 → 09:30 */
export function formatHeureSaisie(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : d.slice(0, 2) + ':' + d.slice(2);
}

// ── Synthèse démographique (lecture seule, issue de l'import) ────────
export function calcAge(birthDate) {
  if (!birthDate) return null;
  const n = new Date(birthDate);
  if (isNaN(n)) return null;
  const now = new Date();
  let age = now.getFullYear() - n.getFullYear();
  const m = now.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < n.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

// Injection de formule CSV : une cellule commençant par = + - @ (ou tab)
// peut être interprétée comme formule à l'ouverture dans Excel. On la préfixe
// d'une apostrophe (neutralise dans Excel). Réversible : csvDeguard() retire
// exactement ce préfixe à la ré-importation → round-trip préservé.
export function csvGuard(s)   { return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }

export function csvDeguard(s) { return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s; }

// Vrai si la valeur d'un champ est incohérente (pour barrer en rouge dans la comparaison)
// Vraie validité calendaire (rejette 31/02, 31/04, 29/02 hors bissextile…)
// via un aller-retour Date, plutôt qu'un simple jour<=31 / mois<=12.
export function jourValide(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
