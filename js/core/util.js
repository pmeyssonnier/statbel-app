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
