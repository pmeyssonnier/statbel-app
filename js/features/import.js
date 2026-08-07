/*
 * js/features/import.js — Import de fichiers (CSV/XLSX) et appariement/comparaison.
 * Lecture + parsing, modale de nommage, aperçu et comparaison avec l'existant
 * (ajouts/suppressions/modifs), confirmation. Inclut l'appariement hiérarchique
 * des anciens contacts (préservation de l'historique) et la construction du HTML
 * de comparaison, partagés avec la restauration de sauvegarde. Extrait de app.js.
 *
 * Imports : parseCSV (csv) ; esc, jourValide (util) ; t/tf/tPlural/champLabel
 * (i18n) ; statutLabel, PAYS_I18N (canon) ; saveCoords (idb). Le reste
 * (enquetes, statutDefs, statutDefaut, renderNonTraduits, renderCoherence,
 * refreshSelect, rendu, XLSX) est global (pont).
 */
import { parseCSV } from '../data/csv.js';
import { esc, jourValide } from '../core/util.js';
import { t, tf, tPlural, champLabel } from '../core/i18n.js';
import { statutLabel, PAYS_I18N } from '../data/canon.js';
import { saveCoords } from '../data/idb.js';



let csvEnAttente  = null;
let coordsEnAttente = null;   // coords d'import en attente (écrites à la confirmation)

export function importerFichier(event) {
  const file = event.target.files[0];
  if (!file) return;
  const defaultName = file.name.replace(/\.(csv|xlsx|xls)$/i, '');
  const reader = new FileReader();
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    reader.onload = e => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS:',', RS:'\n' });
        const parsed = parseCSV(csv);
        if (!parsed?.rows.length) { alert(t('al_excel_invalid')); return; }
        ouvrirModalImport(parsed, defaultName);
      } catch(err) { alert(t('al_excel_error')+err.message); }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = e => {
      const parsed = parseCSV(e.target.result);
      if (!parsed?.rows.length) { alert(t('al_csv_invalid')); return; }
      ouvrirModalImport(parsed, defaultName);
    };
    reader.readAsText(file, 'UTF-8');
  }
  event.target.value = '';
}

export function ouvrirModalImport(parsed, defaultName) {
  csvEnAttente = parsed.rows;
  coordsEnAttente = parsed.coords || [];   // appliquées seulement à la confirmation
  document.getElementById('importApercu').innerHTML = renderImportApercu(parsed.stats);
  document.getElementById('inputNomEnquete').value = defaultName;
  document.getElementById('modalNom').classList.add('open');
  majComparaisonImport();
  setTimeout(() => document.getElementById('inputNomEnquete').select(), 100);
}

// Prépare le résultat d'import pour l'enquête `nom` :
//  - fusionne les lignes correctes (préserve le suivi des contacts appariés) ;
//  - si « n'importer que les corrects » est coché, un enregistrement en erreur est
//    EXCLU de la mise à jour : s'il existe déjà dans l'app il est CONSERVÉ tel quel
//    (jamais supprimé), s'il est nouveau il est simplement ignoré.
// Retourne { result:[...], exclus:[{c,raisons,garde}] }.
export function preparerImport(rawRows, nom) {
  const old = enquetes[nom];
  const match = apparieurAnciens(old || []);
  const chk = document.getElementById('chkOnlyValid');
  const onlyValid = chk ? chk.checked : false;
  const result = [], exclus = [];
  (rawRows || []).forEach(neu => {
    const o = match(neu);
    if (onlyValid && recordEnErreur(neu)) {
      const raisons = raisonsErreur(neu);
      if (o) { result.push(o); exclus.push({ c: neu, raisons, garde: true }); }   // existant → conservé
      else   { exclus.push({ c: neu, raisons, garde: false }); }                   // nouveau → ignoré
      return;
    }
    if (!o) { result.push(neu); return; }                  // nouveau contact correct
    const travaille = (Array.isArray(o.historique) && o.historique.length)
      || (o.statut && o.statut !== statutDefaut()) || o.rdv;
    if (!travaille) { result.push(neu); return; }
    const m = Object.assign({}, neu);                      // préserve le suivi
    m.statut = o.statut; m.date = o.date;
    if (o.rdv) m.rdv = o.rdv; else delete m.rdv;
    if (Array.isArray(o.historique) && o.historique.length) m.historique = o.historique;
    result.push(m);
  });
  return { result, exclus };
}

// Affiche le compteur + le détail des enregistrements exclus pour erreur (avec raison)
export function renderExclus(exclus) {
  const count = document.getElementById('importExcluded');
  const el    = document.getElementById('importExclusDetail');
  if (count) count.textContent = exclus.length ? tf('ip_excluded', { n: exclus.length }) : '';
  if (!el) return;
  el.innerHTML = exclus.length ? exclus.map(x => {
    const nom = esc(((x.c.prenom || '') + ' ' + (x.c.nom || '')).trim()) || ('N° ' + esc(String(x.c.ordre || '—')));
    const why = x.raisons.map(esc).join(', ');
    const etat = x.garde ? t('ip_excl_kept') : t('ip_excl_skipped');
    return `<div class="excl-row">⚠️ <b>${nom}</b> — ${why} <span class="excl-state">(${etat})</span></div>`;
  }).join('') : '';
}

// Met à jour la comparaison "csvEnAttente" vs l'enquête existante portant
// le même nom que celui actuellement saisi dans le champ. N'affiche rien
// si aucune enquête de ce nom n'existe (cas d'une création).
export function majComparaisonImport() {
  const wrap = document.getElementById('importCompareWrap');
  const btn  = document.getElementById('btnConfirmerImport');
  if (!csvEnAttente) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }

  const nom = document.getElementById('inputNomEnquete').value.trim();
  const { result, exclus } = preparerImport(csvEnAttente, nom);
  renderExclus(exclus);   // compteur + détail (raisons) — affiché quel que soit le cas
  const suffixExcl = exclus.length ? ' · ' + tf('ip_btn_excl', { n: exclus.length }) : '';

  const existante = nom ? enquetes[nom] : null;
  if (!existante) {
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
    btn.textContent = t('ip_btn_import') + suffixExcl;
    return;
  }

  const src = { [nom]: result };
  // buildCompareHTML compare contre enquetes[nom] global (déjà correct).
  const { html, stats } = buildCompareHTML(src, tf('cmp_exists', { name: esc(nom) }));
  wrap.innerHTML = html;
  wrap.classList.remove('hidden');

  const totChanges = stats.add + stats.rem + stats.mod;
  btn.textContent = (totChanges
    ? tf('ip_btn_replace', { n: totChanges, word: tPlural('cmp_change', totChanges) })
    : t('ip_btn_replace0')) + suffixExcl;
}

export function renderImportApercu(s) {
  const chip = (txt, bg, fg) => `<span style="display:inline-block;padding:2px 9px;border-radius:11px;font-size:12px;font-weight:600;background:${bg};color:${fg};margin:2px 4px 2px 0;">${esc(txt)}</span>`;
  const recon = s.reconnues.length
    ? s.reconnues.map(k => chip('✓ '+champLabel(k), '#e8f5e9', '#2e7d32')).join('')
    : `<em style="color:#b71c1c;">${t('ip_none')}</em>`;
  const nonRecon = s.nonReconnues.length
    ? s.nonReconnues.map(c => chip(c, '#fff3e0', '#e65100')).join('')
    : `<span style="color:#2e7d32;">${t('ip_none_ok')}</span>`;
  return `
    <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px;">
      <div><div style="font-size:22px;font-weight:700;">${s.lues}</div><div style="font-size:11px;color:#888;">${t('ip_lines_read')}</div></div>
      <div><div style="font-size:22px;font-weight:700;color:#2e7d32;">${s.importees}</div><div style="font-size:11px;color:#888;">${t('ip_to_import')}</div></div>
      <div><div style="font-size:22px;font-weight:700;color:${s.rejetees?'#b71c1c':'#888'};">${s.rejetees}</div><div style="font-size:11px;color:#888;">${t('ip_rejected')}</div></div>
    </div>
    ${(() => {
      const m = s.motifs || {};
      const det = [];
      if (m.sansIdentite) det.push(`${m.sansIdentite} ${t('motif_no_identity')}`);
      if (m.adresseVide)  det.push(`${m.adresseVide} ${t('motif_no_address')}`);
      if (m.doublonOrdre) det.push(`${m.doublonOrdre} ${t('motif_dup_order')}`);
      return det.length ? `<div style="font-size:11px;color:#b71c1c;margin-bottom:8px;">${tf('ip_ignored', { det: esc(det.join(' · ')) })}</div>` : '';
    })()}
    ${(s.rejets && s.rejets.length) ? `
      <details style="margin-bottom:8px;">
        <summary style="font-size:12px;cursor:pointer;color:#b71c1c;">${tf('ip_detail', { n: s.rejets.length })}</summary>
        <div style="max-height:120px;overflow:auto;margin-top:4px;font-size:11px;">
          ${s.rejets.map(r => `<div>• ${t('ip_line')} ${r.ligne} — N° ${esc(String(r.ordre))} — ${esc(t(r.motif))}</div>`).join('')}
        </div>
      </details>` : ''}
    <div style="font-size:12px;margin-bottom:4px;"><strong>${t('ip_cols_ok')}</strong></div>
    <div style="margin-bottom:8px;">${recon}</div>
    <div style="font-size:12px;margin-bottom:4px;"><strong>${t('ip_cols_ko')}</strong></div>
    <div>${nonRecon}</div>
    ${renderNonTraduits(csvEnAttente)}
    ${renderCoherence(csvEnAttente)}`;
}

export function confirmerImport() {
  const nom = document.getElementById('inputNomEnquete').value.trim();
  if (!nom) { alert(t('al_enter_name')); return; }
  // Pas de confirm() natif ici : la comparaison détaillée (majComparaisonImport)
  // est déjà visible dans la modale avant que l'utilisateur ne clique sur ce bouton.
  // Fusion : préserve le suivi des contacts appariés ; exclut les erronés
  // (un erroné déjà présent est conservé tel quel, jamais supprimé).
  enquetes[nom] = preparerImport(csvEnAttente, nom).result;
  enqueteActive = nom;
  // Cache de coordonnées écrit MAINTENANT (après confirmation), pas au parse
  (coordsEnAttente || []).forEach(c => { try { saveCoords(c.adresse, c.lat, c.lng); } catch(e){} });
  csvEnAttente  = null;
  coordsEnAttente = null;
  fermerModal();
  sauver();
  refreshSelect();
  filtreActif = 'Tous';
  renderFilters();
  rendu();
}

export function fermerModal() {
  document.getElementById('modalNom').classList.remove('open');
  csvEnAttente = null;
  coordsEnAttente = null;   // annulation : ne pas écrire les coords en attente
}

// ── Comparaison données existantes vs fichier à restaurer ──────────────
// Identifie un contact par une clé stable : ordre + nom + prénom (fallback adresse)
export function _contactKey(c) {
  const ordre  = (c.ordre || '').toString().trim();
  const nom    = (c.nom || '').toString().trim().toLowerCase();
  const prenom = (c.prenom || '').toString().trim().toLowerCase();
  if (ordre || nom || prenom) return `${ordre}|${nom}|${prenom}`;
  return `adr:${(c.adresse || '').toString().trim().toLowerCase()}`;
}

// Appariement hiérarchique d'un nouveau contact avec un ancien, pour préserver
// le suivi (historique / statut / date / RDV) même si le nom/prénom a été
// corrigé, l'ordre changé, etc. Priorité :
//   1. numéro d'ordre (s'il existe et est UNIQUE côté ancien)
//   2. nom + prénom + date de naissance
//   3. nom + prénom + adresse normalisée
//   4. adresse seule (uniquement pour les contacts sans ordre ni nom ni prénom)
//   sinon → nouveau contact
// Chaque ancien contact ne peut être apparié qu'une seule fois.
// Retourne une fonction match(neu) → ancien|null, dotée de .restants().
export function apparieurAnciens(oldArr) {
  const used = new Set();
  const norm    = s => (s == null ? '' : String(s)).trim().toLowerCase();
  const normAdr = s => norm(s).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const byOrdre = new Map(), byNPB = new Map(), byNPA = new Map(), byAdr = new Map();
  const add = (m, k, c) => { if (!k) return; const l = m.get(k); if (l) l.push(c); else m.set(k, [c]); };
  (oldArr || []).forEach(c => {
    const ord = norm(c.ordre), nom = norm(c.nom), pre = norm(c.prenom);
    add(byOrdre, ord, c);
    if (nom || pre) {
      const np = nom + '' + pre;
      add(byNPB, np + '' + norm(c.birth_date), c);   // clé nulle ignorée par add() si naissance vide
      add(byNPA, np + '' + normAdr(c.adresse), c);
    } else {
      add(byAdr, normAdr(c.adresse), c);                   // ni ordre ni identité → adresse seule
    }
  });
  const firstFree = l => { if (l) for (const c of l) if (!used.has(c)) return c; return null; };
  const take = c => { if (c) used.add(c); return c; };
  const match = function (neu) {
    const ord = norm(neu.ordre), nom = norm(neu.nom), pre = norm(neu.prenom);
    if (ord) { const l = byOrdre.get(ord); if (l && l.length === 1 && !used.has(l[0])) return take(l[0]); }
    if (nom || pre) {
      const np = nom + '' + pre;
      const bd = norm(neu.birth_date);
      let c = bd ? firstFree(byNPB.get(np + '' + bd)) : null;
      if (c) return take(c);
      c = firstFree(byNPA.get(np + '' + normAdr(neu.adresse)));
      if (c) return take(c);
    } else {
      const c = firstFree(byAdr.get(normAdr(neu.adresse)));
      if (c) return take(c);
    }
    return null;
  };
  match.restants = () => (oldArr || []).filter(c => !used.has(c));
  return match;
}

// Champs comparés pour détecter une "modification" (les champs purement
// d'horodatage ou de cache ne sont pas pris en compte)
const _CHAMPS_COMPARES = [
  'prenom','nom','adresse','statut','date','gsm','email','notes',
  'sexe','birth_date','age','birth_country','nationality','marital_status',
  'taille_menage','rdv'
];


export function valeurIncoherente(champ, val) {
  const v = (val == null ? '' : val).toString().trim();
  if (!v) return false;
  if (champ === 'birth_country' || champ === 'nationality') return !PAYS_I18N[v.toUpperCase()];
  if (champ === 'sexe')   return v !== 'M' && v !== 'F';
  if (champ === 'statut') return !statutDefs().some(s => s.label === v);
  if (champ === 'birth_date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
    const [y, m, d] = v.split('-').map(Number);
    return !jourValide(y, m, d);
  }
  return false;
}

// Détail des changements d'historique : appariement par statut (ordre des dates),
// retourne { mod:[{statut,avant,apres}], add:[{statut,date}], rem:[{statut,date}] }.
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

// Vrai si l'enregistrement contient au moins une valeur incohérente (pays/date/sexe/statut)
export function recordEnErreur(c) {
  return valeurIncoherente('birth_country', c.birth_country)
    || valeurIncoherente('nationality', c.nationality)
    || valeurIncoherente('birth_date', c.birth_date)
    || valeurIncoherente('sexe', c.sexe)
    || valeurIncoherente('statut', c.statut);
}

// Liste lisible des raisons d'incohérence d'un enregistrement (avec la valeur fautive)
export function raisonsErreur(c) {
  const r = [];
  const add = (champ, val, label) => { if (valeurIncoherente(champ, val)) r.push(t(label) + ' « ' + val + ' »'); };
  add('birth_country', c.birth_country, 'cohr_country');
  add('nationality',   c.nationality,   'cohr_country');
  add('birth_date',    c.birth_date,    'cohr_date');
  add('sexe',          c.sexe,          'cohr_sex');
  add('statut',        c.statut,        'cohr_status');
  return r;
}

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

// Construit le HTML de comparaison entre les enquêtes existantes (enquetes)
// et celles du fichier importé (src). Retourne { html, stats } où stats
// contient les compteurs globaux (ajouts, suppressions, modifs, identiques).
export function buildCompareHTML(src, meta) {
  const noms = Object.keys(src);
  let html = '';
  if (meta) html += `<div class="backup-meta">${meta}</div>`;

  // Avertissements de cohérence sur les données entrantes (codes pays inconnus,
  // dates/sexe/statut invalides) — visibles aussi bien à l'import qu'à la restauration.
  const allNew = noms.reduce((a, n) => a.concat(src[n] || []), []);
  html += renderNonTraduits(allNew) + renderCoherence(allNew);

  // Légende : signification des 4 états
  html += `<div class="compare-legend">
    <span class="cs-add">➕ ${tPlural('cmp_w_add',1)}</span>
    <span class="cs-mod">✏️ ${tPlural('cmp_w_mod',1)}</span>
    <span class="cs-rem">➖ ${tPlural('cmp_w_rem',1)}</span>
    <span class="cs-unch">✅ ${tPlural('cmp_w_unch',1)}</span>
  </div>`;

  let totAdd = 0, totRem = 0, totMod = 0, totUnch = 0;

  noms.forEach(nom => {
    const arrNew = src[nom] || [];
    const arrOld = enquetes[nom] || null; // null = enquête entièrement nouvelle

    const match = apparieurAnciens(arrOld || []);
    const rowsAdd = [], rowsRem = [], rowsMod = [];
    let unch = 0;

    arrNew.forEach(c => {
      const old = arrOld ? match(c) : null;
      if (!old) { rowsAdd.push(c); return; }
      const diffs = _diffContacts(old, c);
      if (diffs.length) rowsMod.push({ c, old, diffs });
      else unch++;
    });
    if (arrOld) match.restants().forEach(c => rowsRem.push(c));

    totAdd += rowsAdd.length;
    totRem += rowsRem.length;
    totMod += rowsMod.length;
    totUnch += unch;

    const estNouvelle = !arrOld;
    const tagCls   = estNouvelle ? 'nouveau' : (rowsAdd.length || rowsRem.length || rowsMod.length) ? 'modifie' : 'identique';
    const tagLabel = estNouvelle ? t('cmp_new_survey') : (tagCls === 'modifie' ? t('cmp_modified') : t('cmp_identical'));

    const blockId = 'cmp_' + Math.random().toString(36).slice(2, 9);

    let rowsHtml = '';
    rowsAdd.forEach(c => {
      rowsHtml += `<div class="compare-row add">
        <span class="cr-nom">➕ ${esc((c.prenom||'')+' '+(c.nom||''))}</span>
        <span class="cr-detail">${t('cmp_new_word')}</span>
      </div>`;
    });
    rowsMod.forEach(({ c, old, diffs }) => {
      const champDiffs = diffs.filter(d => d.champ !== 'historique');
      const histDiff   = diffs.find(d => d.champ === 'historique');
      const detail = champDiffs.slice(0, 4).map(d => {
        const champLabel = t('field_' + d.champ) || d.champ;
        const tr = v => d.champ === 'statut' ? statutLabel(v) : v;
        const av = tr(d.avant), ap = tr(d.apres);
        // Nouvelle valeur incohérente → rouge barré
        const apTxt = esc(ap || '∅');
        const apHtml = valeurIncoherente(d.champ, d.apres) ? `<span class="cr-bad">${apTxt}</span>` : apTxt;
        return esc(champLabel) + ' : ' + esc(av || '∅') + ' → ' + apHtml;
      }).join(' · ') + (champDiffs.length > 4 ? '…' : '');
      // Sous-bloc détaillé de l'historique (date modifiée, ligne ajoutée/supprimée)
      let histHtml = '';
      if (histDiff) {
        const dh = diffHistorique(old.historique, c.historique);
        const lignes = [];
        dh.unch.forEach(u => lignes.push(`<span class="cr-hist-unch">✅ ${esc(statutLabel(u.statut))} : ${esc(u.date)}</span>`));
        dh.mod.forEach(m => lignes.push(`<span class="cr-hist-mod">✏️ ${esc(statutLabel(m.statut))} : ${esc(m.avant)} → ${esc(statutLabel(m.statut))} : ${esc(m.apres)}</span>`));
        dh.add.forEach(a => lignes.push(`<span class="cr-hist-add">➕ ${esc(statutLabel(a.statut))} : ${esc(a.date)}</span>`));
        dh.rem.forEach(r => lignes.push(`<span class="cr-hist-rem">➖ ${esc(statutLabel(r.statut))} : ${esc(r.date)}</span>`));
        if (lignes.length) histHtml = `<div class="cr-hist">${t('field_historique')} : ${histDiff.avant} → ${histDiff.apres}${lignes.map(l => '<span class="cr-hist-l">' + l + '</span>').join('')}</div>`;
      }
      rowsHtml += `<div class="compare-row changed">
        <span class="cr-nom">✏️ ${esc((c.prenom||'')+' '+(c.nom||''))}</span>
        ${detail ? `<span class="cr-detail">${detail}</span>` : ''}
        ${histHtml}
      </div>`;
    });
    rowsRem.forEach(c => {
      rowsHtml += `<div class="compare-row removed">
        <span class="cr-nom">➖ ${esc((c.prenom||'')+' '+(c.nom||''))}</span>
        <span class="cr-detail">${t('cmp_removed_word')}</span>
      </div>`;
    });

    const hasChanges = rowsAdd.length || rowsRem.length || rowsMod.length;

    html += `
      <div class="compare-block">
        <div class="compare-header">
          <span title="${esc(nom)}">${esc(nom)}</span>
          <span class="compare-tag ${tagCls}">${tagLabel}</span>
        </div>
        <div class="compare-summary">
          ${rowsAdd.length ? `<span class="cs-add">➕ ${rowsAdd.length} ${tPlural('cmp_w_add',rowsAdd.length)}</span>` : ''}
          ${rowsMod.length ? `<span class="cs-mod">✏️ ${rowsMod.length} ${tPlural('cmp_w_mod',rowsMod.length)}</span>` : ''}
          ${rowsRem.length ? `<span class="cs-rem">➖ ${rowsRem.length} ${tPlural('cmp_w_rem',rowsRem.length)}</span>` : ''}
          ${unch ? `<span class="cs-unch">✅ ${unch} ${tPlural('cmp_w_unch',unch)}</span>` : ''}
        </div>
        ${hasChanges ? `
          <div class="compare-toggle" onclick="document.getElementById('${blockId}').classList.toggle('hidden')">${t('cmp_toggle')}</div>
          <div class="compare-rows hidden" id="${blockId}">${rowsHtml}</div>
        ` : ''}
      </div>`;
  });

  const stats = { add: totAdd, rem: totRem, mod: totMod, unch: totUnch };
  const grandTotalLabel = `➕${stats.add} ✏️${stats.mod} ➖${stats.rem} ✅${stats.unch}`;
  html += `<div class="backup-grand-total">
    <span>${t('cmp_global')}</span>
    <span>${grandTotalLabel}</span>
  </div>`;

  return { html, stats };
}
