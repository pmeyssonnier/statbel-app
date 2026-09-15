/*
 * js/planner/lecture.js — Planner : LECTURE DES DATES. parseDate() normalise les valeurs
 * de dates issues du Convertisseur (objet Date, numero de serie Excel, chaine ISO yyyy-mm-dd
 * ou belge jj/mm/aaaa, repli US mm/jj/aaaa) vers un Date local minuit. Extrait verbatim du
 * <script> du Planner. Script CLASSIQUE : globale partagee, appele par les autres modules.
 */
// ══════════════════════════════════════════════════════════════════════
//  LECTURE DES DATES (chaînes jj/mm/aaaa ou ISO issues du Convertisseur)
// ══════════════════════════════════════════════════════════════════════
function parseDate(v) {
  if (!v && v !== 0) return null;
  // 1. Objet Date JS natif — cas le plus fréquent avec cellDates:true
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  // 2. Numéro de série Excel (entier ou flottant)
  if (typeof v === 'number') {
    const serial = Math.round(v);
    if (serial > 1) {
      const d = new Date(Math.round((serial - 25569) * 86400000));
      if (!isNaN(d.getTime()))
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    return null;
  }
  // 3. Chaîne de caractères
  const s = String(v).trim();
  if (!s) return null;
  // yyyy-mm-dd (ISO non ambigu)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  // jj/mm/aaaa (belge/européen) — priorité, à condition que le mois soit valide (≤ 12)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m && +m[2] <= 12) return new Date(+m[3], +m[2]-1, +m[1]);
  // mm/jj/aaaa (US) : uniquement quand jj/mm est impossible (2e nombre > 12) mais que
  // le 1er est un mois valide (≤ 12). Évite le débordement silencieux de « 05/13/2026 ».
  if (m && +m[1] <= 12) return new Date(+m[3], +m[1]-1, +m[2]);
  return null;
}
