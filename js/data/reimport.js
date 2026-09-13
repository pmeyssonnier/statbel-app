/*
 * js/data/reimport.js — Moteur de réimport : appariement & diff.
 *
 * Cœur métier du réimport, isolé de l'UI et de l'état applicatif : aucune lecture
 * de `enquetes`, `settings`, `enqueteActive`, du DOM, de localStorage/IndexedDB, ni
 * d'i18n. Tout arrive en paramètres → testable sans navigateur (tests/reimport.test.js).
 * `diffHistorique` et `_diffContacts` sont pures ; `apparieurAnciens`
 * renvoie un matcher AUTONOME à état interne (contacts déjà appariés, incertains) le
 * temps d'une passe de réimport — autonome, pas « pur » au sens strict.
 *
 * L'orchestration (modale, aperçu, confirmation, lecture de l'existant) et la
 * validation de cohérence liée au vocabulaire de statuts actif restent dans
 * js/features/import.js, qui consomme ce moteur.
 */

// Appariement hiérarchique d'un nouveau contact avec un ancien, pour préserver
// le suivi (historique / statut / date / RDV) même si le nom/prénom a été
// corrigé, l'ordre changé, etc. Priorité :
//   1. numéro d'ordre (s'il existe et est UNIQUE côté ancien)
//   2. nom + prénom + date de naissance
//   3. nom + prénom + adresse normalisée
//   4. adresse seule (uniquement pour les contacts sans ordre ni nom ni prénom)
//   sinon → nouveau contact
// Chaque ancien contact ne peut être apparié qu'une seule fois.
// Retourne une fonction match(neu) → ancien|null, dotée de .restants() et .incertains().
export function apparieurAnciens(oldArr) {
  const used = new Set();
  const incertains = [];   // { neu, old } : n° d'ordre concordant mais identité divergente
  const norm    = s => (s == null ? '' : String(s)).trim().toLowerCase();
  const normAdr = s => norm(s).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  // Clé composite : jointure des champs par un séparateur (U+0001) qui n'apparaît
  // pas dans les données réelles (noms/adresses/dates issus de CSV/XLSX). Sans lui,
  // « ab »+« c » et « a »+« bc » produiraient la même clé → faux appariement silencieux.
  const cle = (...parts) => parts.join('\u0001');
  const byOrdre = new Map(), byNPB = new Map(), byNPA = new Map(), byAdr = new Map();
  const add = (m, k, c) => { if (!k) return; const l = m.get(k); if (l) l.push(c); else m.set(k, [c]); };
  (oldArr || []).forEach(c => {
    const ord = norm(c.ordre), nom = norm(c.nom), pre = norm(c.prenom);
    add(byOrdre, ord, c);
    if (nom || pre) {
      add(byNPB, cle(nom, pre, norm(c.birth_date)), c);   // recherchée seulement si la naissance est renseignée (cf. match)
      add(byNPA, cle(nom, pre, normAdr(c.adresse)), c);
    } else {
      add(byAdr, normAdr(c.adresse), c);                   // ni ordre ni identité → adresse seule
    }
  });
  const firstFree = l => { if (l) for (const c of l) if (!used.has(c)) return c; return null; };
  const take = c => { if (c) used.add(c); return c; };
  // Signal de cohérence d'un champ : +1 concordant, -1 conflit, 0 indeterminé (vide d'un côté).
  const sig = (a, b, f = norm) => { const x = f(a), y = f(b); if (!x || !y) return 0; return x === y ? 1 : -1; };
  const match = function (neu) {
    const ord = norm(neu.ordre), nom = norm(neu.nom), pre = norm(neu.prenom);
    if (ord) {
      const l = byOrdre.get(ord);
      if (l && l.length === 1 && !used.has(l[0])) {
        const o = l[0];
        // Le n° d'ordre seul ne suffit plus : on exige qu'AU MOINS un autre identifiant
        // concorde (nom, prénom, naissance ou adresse). Si l'ordre concorde mais que tout
        // le reste diffère (n° peut-être réutilisé pour une autre personne), on N'apparie
        // PAS -> pas de transfert de suivi ; on signale pour validation humaine.
        const identite = [sig(o.nom, neu.nom), sig(o.prenom, neu.prenom),
                          sig(o.birth_date, neu.birth_date)];
        const adresse = sig(o.adresse, neu.adresse, normAdr);
        const identitePositive = identite.some(s => s > 0);
        const identiteEnConflit = identite.some(s => s < 0);
        // Une adresse concordante ne doit jamais, à elle seule, neutraliser une
        // identité entièrement divergente : plusieurs ménages/personnes peuvent
        // partager ou conserver la même adresse entre deux imports.
        if (identitePositive || (!identiteEnConflit && adresse >= 0)) return take(o);
        incertains.push({ neu, old: o });
      }
    }
    if (nom || pre) {
      const bd = norm(neu.birth_date);
      let c = bd ? firstFree(byNPB.get(cle(nom, pre, bd))) : null;
      if (c) return take(c);
      c = firstFree(byNPA.get(cle(nom, pre, normAdr(neu.adresse))));
      if (c) return take(c);
    } else {
      const c = firstFree(byAdr.get(normAdr(neu.adresse)));
      if (c) return take(c);
    }
    return null;
  };
  match.restants = () => (oldArr || []).filter(c => !used.has(c));
  match.incertains = () => incertains;
  return match;
}

// Champs comparés pour détecter une "modification" (les champs purement
// d'horodatage ou de cache ne sont pas pris en compte).
const _CHAMPS_COMPARES = [
  'prenom','nom','adresse','statut','date','gsm','email','notes',
  'sexe','birth_date','age','birth_country','nationality','marital_status',
  'taille_menage','rdv'
];

// Détail des changements d'historique : appariement par statut (ordre des dates),
// retourne { unch, mod:[{statut,avant,apres}], add:[{statut,date}], rem:[{statut,date}] }.
export function diffHistorique(oldH, newH) {
  const groupe = arr => {
    const g = {};
    (arr || []).forEach(e => { (g[e.statut] = g[e.statut] || []).push(e.date || ''); });
    return g;
  };
  const go = groupe(oldH), gn = groupe(newH);
  const statuts = [...new Set([...Object.keys(go), ...Object.keys(gn)])];
  const res = { unch: [], mod: [], add: [], rem: [] };
  statuts.forEach(st => {
    const od = (go[st] || []), nd = (gn[st] || []);
    const n = Math.max(od.length, nd.length);
    for (let i = 0; i < n; i++) {
      const a = od[i], b = nd[i];
      if (a !== undefined && b !== undefined) {
        if (a !== b) res.mod.push({ statut: st, avant: a, apres: b });
        else res.unch.push({ statut: st, date: a });
      }
      else if (a !== undefined) res.rem.push({ statut: st, date: a });
      else res.add.push({ statut: st, date: b });
    }
  });
  return res;
}

// Diff champ à champ de deux fiches (+ signalement de tout changement d'historique).
// Retourne [{ champ, avant, apres }].
export function _diffContacts(a, b) {
  const diffs = [];
  _CHAMPS_COMPARES.forEach(champ => {
    const va = (a[champ] ?? '').toString();
    const vb = (b[champ] ?? '').toString();
    if (va !== vb) diffs.push({ champ, avant: va, apres: vb });
  });
  // Historique : signaler tout changement (perte/modification d'entrées)
  const sig = h => (Array.isArray(h) ? h : []).map(e => `${e.statut}@${e.date}${e.rdv ? '/' + e.rdv : ''}`).join('|');
  const sa = sig(a.historique), sb = sig(b.historique);
  if (sa !== sb) diffs.push({
    champ: 'historique',
    avant: `${(a.historique || []).length}`,
    apres: `${(b.historique || []).length}`,
  });
  return diffs;
}
