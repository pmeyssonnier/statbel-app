/*
 * js/converter/ui.js — Convertisseur : rendu & UI. AFFICHAGE (sources chargees, onglets
 * Aperçu/Statistiques, apparence, localisation, rapport), TABLES (lookup Pays/Communes, ecran
 * parametres ; table Aperçu / menage : rendu, tri, accordeon menage), STATISTIQUES (bascule
 * Cibles / tout le menage, majStats, blocs) et CHARTS (barres/donut/treemap/pyramide/Sankey).
 * Extrait verbatim du <script> du Convertisseur. Script CLASSIQUE : globales partagees ;
 * fonctions appelees via onclick= et par le bootstrap ÉVÉNEMENTS reste inline.
 */
// ════════════════════════════════════════════════════════════════════════
//  AFFICHAGE
// ════════════════════════════════════════════════════════════════════════

let _resultat = null;

// ── Multi-sources persistés (IndexedDB) ─────────────────────────────────
let sources = {};        // grpId → { res, fileName }
let sourceActive = '';

const DB_NAME = 'StatbelConverter', DB_VERSION = 1;
let _db = null;

function ouvrirDB() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, DB_VERSION);
    rq.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sources')) db.createObjectStore('sources', { keyPath: 'nom' });
    };
    rq.onsuccess = e => res(e.target.result);
    rq.onerror   = e => rej(e.target.error);
  });
}
function idbReq(r)  { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function idbTx(tx)  { return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }

// Enregistre l'ensemble des sources chargées
async function persister() {
  try {
    if (!_db) _db = await ouvrirDB();
    const tx = _db.transaction('sources', 'readwrite');
    const st = tx.objectStore('sources');
    await idbReq(st.clear());
    for (const [nom, v] of Object.entries(sources)) st.put({ nom, fileName: v.fileName, res: v.res });
    await idbTx(tx);
  } catch (e) { console.error('persister():', e); }
}

// Recharge les sources depuis IndexedDB
async function chargerSources() {
  _db = await ouvrirDB();
  const items = await idbReq(_db.transaction('sources', 'readonly').objectStore('sources').getAll());
  sources = {};
  items.forEach(it => { sources[it.nom] = { res: it.res, fileName: it.fileName }; });
}

// Retire le fichier source actif
function supprimerSource() {
  if (!sourceActive || !sources[sourceActive]) { alert(t('al_no_file_loaded')); return; }
  if (!confirm(tf('cf_remove_source', { name: nomEnquete(sources[sourceActive].res) }))) return;
  delete sources[sourceActive];
  const noms = Object.keys(sources);
  sourceActive = noms[0] || '';
  persister();
  refreshSourceSelect();
  if (sourceActive) {
    afficher(sources[sourceActive].res);
  } else {
    _resultat = null;
    document.getElementById('resultats').classList.add('hidden');
    document.getElementById('hdrTabs').style.display = 'flex';
    document.getElementById('dropzone').classList.remove('hidden');
  }
}

function refreshSourceSelect() {
  const sel = document.getElementById('sourceSelect');
  const noms = Object.keys(sources);
  sel.style.display = noms.length ? '' : 'none';
  sel.innerHTML = noms.map(n =>
    `<option value="${escHtml(n)}"${n === sourceActive ? ' selected' : ''}>${escHtml(nomEnquete(sources[n].res))}</option>`).join('');
}

// Met à jour la localisation de la source active (titre, libellés, sélecteur)
function majLocalisation(val) {
  if (!_resultat) return;
  _resultat.localisation = (val || '').trim();
  majLabels(_resultat);
  refreshSourceSelect();
  persister();                   // sauvegarder la localisation éditée
}

// Onglets Aperçu / Statistiques
function basculerTab(nom) {
  ['apercu', 'stats'].forEach(n => {
    document.getElementById('ong-' + n).classList.toggle('actif', n === nom);
  });
  // Le résumé (admin + KPI + planning) ne sert que dans Overview ; on l'enlève
  // des Statistiques où il faisait doublon.
  document.getElementById('resumeCard').style.display = (nom === 'stats') ? 'none' : '';
  // Overview / Statistics : nécessitent une source ; sinon on montre la zone de dépôt
  if (sourceActive) {
    document.getElementById('resultats').classList.remove('hidden');
    document.getElementById('dropzone').classList.add('hidden');
    // Recalcule l'annexe planning (un planning a pu être importé entre-temps)
    if (nom === 'apercu' && sources[sourceActive])
      afficherPlanning(sources[sourceActive].res.adminCols, sources[sourceActive].res);
  } else {
    document.getElementById('resultats').classList.add('hidden');
    document.getElementById('dropzone').classList.remove('hidden');
  }
  ['apercu', 'stats'].forEach(n =>
    document.getElementById('pan-' + n).classList.toggle('actif', n === nom));
}

// Libellés des boutons de téléchargement (basés sur le nom complet)
function majLabels(res) {
  const nom = nomEnquete(res);
  const a = res.adminCols;
  document.getElementById('lblCibles').textContent  = `${nom}.csv — ${res.outCibles.length} ${t('lbl_rows')}`;
  document.getElementById('lblMembres').textContent = `${nom}_membres.csv — ${res.outMembres.length} ${t('lbl_rows')}`;
  document.getElementById('lblEnquete').textContent = `${nom}_enquete.csv — NR_GRP:${a.NR_GRP} YEAR:${a.NR_YEAR} SEQ:${a.NR_SEQ} WAVE:${a.NR_WAVE} REF:${a.NR_REF_WK}`;
  document.getElementById('lblRapport').textContent = `${nom}_rapport.txt`;
}

function changerSource(nom) {
  if (!sources[nom]) return;
  sourceActive = nom;
  afficher(sources[nom].res);
}

function toggleMenu() {
  document.getElementById('menu').classList.toggle('open');
}

// ── Apparence : thème (clair/sombre/auto) + police + taille du texte ─────
const FONTS = {
  system:  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  arial:   'Arial, Helvetica, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma:  '"Segoe UI", Tahoma, Geneva, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  times:   '"Times New Roman", Times, serif',
  mono:    '"Courier New", monospace',
};
let _ui = { theme: 'auto', font: 'system', scale: 1, ageMinCible: 15 };
// Âge minimum des personnes « cibles » interrogées (LFS : 15 ans et +). Paramètre
// persisté du module (statbel_conv_ui).
function ageMinCible() { const n = parseInt(_ui.ageMinCible, 10); return isNaN(n) ? 15 : n; }
function setAgeMinCible(v) {
  let n = parseInt(v, 10); if (isNaN(n)) n = 15; n = Math.max(0, Math.min(120, n));
  _ui.ageMinCible = n;
  try { localStorage.setItem('statbel_conv_ui', JSON.stringify(_ui)); } catch (e) {}
  majLabelCible();
  // L'âge min affecte le scope « cible » ET les deux cartes ménage → toujours rafraîchir.
  if (_resultat) majStats(statsPourStats());
}
// Libellé du bouton « Cibles » = base traduite + seuil d'âge courant (≥ N).
function majLabelCible() {
  const b = document.getElementById('btnScopeCible');
  if (b) b.textContent = t('btn_target_15') + ' (' + ageMinCible() + '+)';
}
const _mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function chargerApparence() {
  try { _ui = Object.assign(_ui, JSON.parse(localStorage.getItem('statbel_conv_ui') || '{}')); } catch (e) {}
  appliquerApparence();
  if (_mqDark && _mqDark.addEventListener) _mqDark.addEventListener('change', () => { if (_ui.theme === 'auto') appliquerApparence(); });
}
function appliquerApparence() {
  const sombre = _ui.theme === 'dark' || (_ui.theme === 'auto' && _mqDark && _mqDark.matches);
  document.body.classList.toggle('theme-dark', sombre);
  document.body.style.zoom = _ui.scale || 1;
  document.body.style.fontFamily = FONTS[_ui.font] || FONTS.system;
  // états actifs des contrôles (si la modale est rendue)
  document.querySelectorAll('#themeToggle button').forEach(b => b.classList.toggle('actif', b.dataset.theme === _ui.theme));
  document.querySelectorAll('#scaleToggle button').forEach(b => b.classList.toggle('actif', Number(b.dataset.scale) === Number(_ui.scale)));
  const fsel = document.getElementById('fontSelect'); if (fsel) fsel.value = _ui.font;
  const am = document.getElementById('inpAgeMin'); if (am) am.value = ageMinCible();
  majLabelCible();
}
function setTheme(t) { _ui.theme = t; localStorage.setItem('statbel_conv_ui', JSON.stringify(_ui)); appliquerApparence(); }
function setFont(f) { _ui.font = f; localStorage.setItem('statbel_conv_ui', JSON.stringify(_ui)); appliquerApparence(); }
function setScale(s) { _ui.scale = s; localStorage.setItem('statbel_conv_ui', JSON.stringify(_ui)); appliquerApparence(); }
function ouvrirApparence() { appliquerApparence(); document.getElementById('modalApparence').classList.add('open'); }
function fermerApparence() { document.getElementById('modalApparence').classList.remove('open'); }
document.addEventListener('click', e => {
  const w = document.querySelector('.menu-wrap');
  if (w && !w.contains(e.target)) document.getElementById('menu').classList.remove('open');
});

// Affiche les infos de planification LFS du groupe (commune, quartier, 4 interrogations)
// à partir du NR_GRP (clé = forme vague-1 « 1·sem·groupe », derniers 5 chiffres).
function afficherPlanning(adminCols, res) {
  const el = document.getElementById('planningInfo');
  if (!el) return;
  const grp = String(adminCols.NR_GRP || '').trim();
  const code = grp.slice(-5);
  const wave = parseInt(adminCols.NR_WAVE, 10) || 1;
  const m = chercherPlanning(code, wave);
  if (!m) {
    el.innerHTML = grp ? `<div class="plan-box plan-none">📋 ${escHtml(code)} — ${escHtml(t('plan_not_found'))}</div>` : '';
    return;
  }
  const e = m.e;
  // Rattaché à un groupe INITIAL différent (fichier de vague ≥ 2) → on le signale.
  const viaHtml = (m.base && m.base !== code)
    ? ` <span class="plan-q" title="${escHtml(t('plan_via_base'))}">↩ ${escHtml(m.base)}</span>` : '';
  // Cohérence commune planning ↔ localisation détectée
  const locData = (res.localisation || '').toLowerCase();
  const planComm = (e.c || '').toLowerCase();
  const mismatch = locData && planComm && !planComm.includes(locData.split(' ')[0]);
  const interroHtml = e.i.map((it, k) => {
    const [sem, start, stop] = it;
    if (!sem && !start) return '';
    const actif = (k + 1) === wave ? ' plan-interro-actif' : '';
    return `<div class="plan-interro${actif}"><b>I${k + 1}</b> · wk ${escHtml(sem)} · ${escHtml(start)} → ${escHtml(stop)}${(k + 1) === wave ? ' ◄' : ''}</div>`;
  }).join('');
  el.innerHTML = `<div class="plan-box">
    <div class="plan-head">📋 ${escHtml(e.c)} <span class="plan-q">${escHtml(e.q)}</span>
      ${mismatch ? `<span class="plan-warn" title="Commune planning ≠ localisation détectée">⚠️</span>` : ''}${viaHtml}
      <span class="plan-q" style="margin-left:auto;opacity:.8">↪ ${escHtml(m.source)}</span></div>
    <div class="plan-interros">${interroHtml}</div>
  </div>`;
}

function afficher(res) {
  _resultat = res;
  const { grpId, outCibles, outMembres, outEnquete, tailleHH, srcRows, adminCols } = res;

  // Colonnes administratives
  // Extraire le "05" : 2 derniers chiffres de NR_GRP (ex: 202612305 → 05)
  // Numéro de groupe = 2 derniers chiffres du NR_GRP (NR_GRP = YEAR+WAVE+REF_WEEK+GROUP)
  const grpSuffix = String(adminCols.NR_GRP).slice(-2);

  document.getElementById('adminCols').innerHTML = [
    [t('admin_year'),     adminCols.NR_YEAR],
    [t('admin_wave'),     adminCols.NR_WAVE],
    [t('admin_sequence'), adminCols.NR_SEQ],
    [t('admin_refweek'),  adminCols.NR_REF_WK],
    [t('admin_group'),    grpSuffix],
  ].map(([desc, val]) =>
    `<div class="admin-col">
      <span class="ac-label">${desc}</span>
      <span class="ac-val">${val}</span>
    </div>`).join('');

  // KPI — le titre n'affiche que l'identifiant ; la localisation est dans le champ
  document.getElementById('grpTitre').textContent = '✅ ' + res.grpId;

  afficherPlanning(adminCols, res);

  // Alerte : codes inconnus (nationalité, pays de naissance, commune belge, statut matrimonial)
  const cm = res.codesManquants || { nlty: [], bth: [], commune: [], mrtl: [] };
  const elCM = document.getElementById('codesManquants');
  const aDesCodes = ['nlty','bth','commune','mrtl'].some(k => cm[k] && cm[k].length);
  if (aDesCodes) {
    // Pour chaque code inconnu : code ×N puis la liste des contacts (N° ordre — nom)
    const fmtList = arr => arr.map(x => {
      const gens = (x.gens || [])
        .map(g => `<span style="white-space:nowrap">N° ${escHtml(g.ordre)} — ${escHtml(g.nom)}</span>`)
        .join(', ');
      const detail = gens ? `<div style="margin:2px 0 4px 14px;color:var(--warn-text)">${gens}</div>` : '';
      return `<div style="margin-top:4px"><code style="background:var(--code-bg);padding:1px 5px;border-radius:4px">${escHtml(x.code)}</code> ×${x.count}${detail}</div>`;
    }).join('');
    let html = `⚠️ <strong>${escHtml(t('warn_unknown_codes_title').replace(/^⚠️\s*/, ''))}</strong> ${escHtml(t('warn_unknown_codes_suffix'))}`;
    if (cm.nlty    && cm.nlty.length)    html += `<div style="margin-top:6px"><u>${escHtml(t('field_nationality_code'))}</u> ${escHtml(t('txt_not_in'))} NLTY_ISO:${fmtList(cm.nlty)}</div>`;
    if (cm.bth     && cm.bth.length)     html += `<div style="margin-top:6px"><u>${escHtml(t('field_birthcountry_code'))}</u> ${escHtml(t('txt_not_in'))} NLTY_ISO:${fmtList(cm.bth)}</div>`;
    if (cm.commune && cm.commune.length) html += `<div style="margin-top:6px"><u>${escHtml(t('field_municipality_code'))}</u> ${escHtml(t('txt_not_in'))} REFNIS_COMMUNE:${fmtList(cm.commune)}</div>`;
    if (cm.mrtl    && cm.mrtl.length)    html += `<div style="margin-top:6px"><u>${escHtml(t('field_marital_code'))}</u> ${escHtml(t('txt_not_in'))} MRTL_FR:${fmtList(cm.mrtl)}</div>`;
    html += `<div style="margin-top:8px;color:var(--warn-text);font-size:11px">${escHtml(t('hint_add_codes'))}</div>`;
    elCM.innerHTML = html;
    elCM.classList.remove('hidden');
  } else {
    elCM.classList.add('hidden');
    elCM.innerHTML = '';
  }
  // Avertissement structure : colonnes recommandées absentes
  const elSW = document.getElementById('structureWarn');
  const sw = res.structureWarn || [];
  if (sw.length) {
    elSW.innerHTML = `⚠️ <strong>${escHtml(t('warn_missing_cols_title').replace(/^⚠️\s*/, ''))}</strong> ${escHtml(t('warn_missing_cols_suffix'))} `
      + sw.map(c => `<code style="background:var(--code-bg);padding:1px 5px;border-radius:4px">${escHtml(c)}</code>`).join(' ');
    elSW.classList.remove('hidden');
  } else {
    elSW.classList.add('hidden'); elSW.innerHTML = '';
  }
  // Garde-fou : une enquête MÉMORISÉE (restaurée depuis IndexedDB) analysée par une
  // version antérieure au correctif « cellTexte » (< v216) garde ses identifiants web
  // longs cassés en notation scientifique (« 2.02612E+11 ») — le correctif ne s'applique
  // qu'à l'import, pas aux résultats déjà stockés. On le signale ici (à l'affichage) pour
  // inviter à un vrai ré-import du .xlsx, plutôt que de re-télécharger un CSV avec des
  // logins CAWI inutilisables.
  const elSci = document.getElementById('idScientifiqueWarn');
  const champSci = r => RE_SCI_ID.test((r.web_user_id || '').trim()) ? r.web_user_id
                      : RE_SCI_ID.test((r.web_user_pwd || '').trim()) ? r.web_user_pwd : '';
  let nSci = 0, exSci = '';
  (outCibles || []).forEach(r => { const v = champSci(r); if (v) { nSci++; if (!exSci) exSci = v.trim(); } });
  if (nSci) {
    elSci.innerHTML = `<strong>${escHtml(t('warn_sci_id_title'))}</strong> `
      + escHtml(tf('warn_sci_id_body', { n: nSci, ex: exSci }));
    elSci.classList.remove('hidden');
  } else {
    elSci.classList.add('hidden'); elSci.innerHTML = '';
  }
  document.getElementById('locInput').value = res.localisation || '';


  // Graphiques statistiques (selon la portée Cibles / Ménage)
  majStats(statsPourStats());
  majScopeUI();
  majStatsEnqUI();

  // Compteur cibles
  document.getElementById('nbCibles').textContent = `(${outCibles.length})`;

  // Tableau cibles (avec accordéon ménage)
  _sortState = { cibles: { col: null, dir: 1 } };
  renderCibles(outCibles);

  // Labels boutons
  majLabels(res);

  // Afficher résultats
  document.getElementById('dropzone').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('resultats').classList.remove('hidden');
  document.getElementById('hdrTabs').style.display = 'flex';
  // On revient toujours sur l'aperçu
  document.getElementById('ong-apercu').classList.add('actif');
  document.getElementById('pan-apercu').classList.add('actif');
}

// ════════════════════════════════════════════════════════════════════════
//  ONGLETS
// ════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
//  RÉGION — TABLES · tables de correspondance (lookup Pays/Communes, écran paramètres)
// ════════════════════════════════════════════════════════════════════════

// ── Tables de correspondance triables ───────────────────────────────────
const _refState = {};   // elId → { col, dir }

// colonnes : [{ label, num? }] ; lignes : tableau de tableaux de cellules
function tableTriable(elId, colonnes, lignes) {
  const el = document.getElementById(elId);
  el._data = { colonnes, lignes };
  if (!_refState[elId]) _refState[elId] = { col: 0, dir: 1 };
  rendreRef(elId);
}

function rendreRef(elId) {
  const el = document.getElementById(elId);
  const { colonnes, lignes } = el._data;
  const st = _refState[elId];
  const tri = [...lignes].sort((a, b) => {
    const va = a[st.col], vb = b[st.col];
    if (colonnes[st.col].num) return st.dir * ((parseFloat(va) || 0) - (parseFloat(vb) || 0));
    return st.dir * String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' });
  });
  const thead = '<thead><tr>' + colonnes.map((c, i) =>
    `<th class="ref-sort${st.col === i ? (st.dir === 1 ? ' asc' : ' desc') : ''}" data-el="${elId}" data-i="${i}" scope="col" tabindex="0" aria-sort="${st.col === i ? (st.dir === 1 ? 'ascending' : 'descending') : 'none'}"${c.w ? ` style="min-width:${c.w}px"` : ''}>${escHtml(c.label)}</th>`
  ).join('') + '</tr></thead>';
  const tbody = '<tbody>' + tri.map(r =>
    '<tr>' + r.map((c, i) => `<td>${colonnes[i].render ? colonnes[i].render(c, r) : escHtml(c)}</td>`).join('') + '</tr>'
  ).join('') + '</tbody>';
  el.innerHTML = thead + tbody;
}

// Clic sur un en-tête triable de table de correspondance
document.addEventListener('click', e => {
  const th = e.target.closest('th.ref-sort');
  if (!th) return;
  const elId = th.dataset.el, i = +th.dataset.i;
  const st = _refState[elId] || (_refState[elId] = { col: i, dir: 1 });
  if (st.col === i) st.dir *= -1; else { st.col = i; st.dir = 1; }
  rendreRef(elId);
});

function ouvrirParametres() {
  tableTriable('refSexe',
    [{ label: t('col_code'), num: true, w: 56 }, { label: t('col_abbr'), w: 70, render: (v) => (sexeIcone(v) ? sexeIcone(v) + ' ' : '') + escHtml(v) }, { label: t('col_label'), w: 120 }],
    Object.entries(SEX_MAP).map(([c, a]) => [c, a, sexeLabel(a) || '']));

  tableTriable('refMrtl',
    [{ label: t('col_code'), num: true, w: 56 }, { label: t('col_label'), w: 180 }],
    Object.entries(MRTL_FR).map(([c, l]) => [c, l ? ((mrtlIcone(l) ? mrtlIcone(l) + ' ' : '') + mrtlLabel(l)) : '—']));

  initPays();

  initCommunes();
  lookupTab('sexe');   // onglet par défaut à l'ouverture

  document.getElementById('modalParams').classList.add('open');
}

// ── Pays : continent (déduit du 1er chiffre du NIS) + appartenance UE ────
function continentNIS(nis) {
  switch (String(nis)[0]) {
    case '1': return 'Europe';
    case '2': return 'Asia';
    case '3': return 'Africa';
    case '4': return 'America (North/Central)';
    case '5': return 'America (South)';
    case '6': return 'Oceania';
    default:  return '';
  }
}
// Libellé affiché (langue courante) pour un continent — la clé interne (continentNIS) reste en anglais
const CONTINENT_LBL_KEY = {
  'Europe': 'continent_europe', 'Asia': 'continent_asia', 'Africa': 'continent_africa',
  'America (North/Central)': 'continent_america_north', 'America (South)': 'continent_america_south',
  'Oceania': 'continent_oceania', 'Unknown': 'lbl_unknown',
};
function continentLabel(c) { return CONTINENT_LBL_KEY[c] ? t(CONTINENT_LBL_KEY[c]) : c; }
// 27 États membres de l'UE (ISO3) — liste statique (non déductible du code)
const EU_MEMBERS = new Set(['AUT','BEL','BGR','HRV','CYP','CZE','DNK','EST','FIN','FRA','DEU','GRC','HUN','IRL','ITA','LVA','LTU','LUX','MLT','NLD','POL','PRT','ROU','SVK','SVN','ESP','SWE']);
// Zone NUTS Eurostat hors UE : AELE + pays candidats (NUTS0 = code 2 lettres)
const EFTA = new Set(['ISL','LIE','NOR','CHE']);
const NUTS0_CANDIDATES = new Set(['ALB','MNE','MKD','SRB','TUR']);
// Codes NUTS différents de l'ISO2
const NUTS0_OVERRIDE = { GRC: 'EL' };
// NUTS0 (niveau pays) : code 2 lettres, uniquement pour la zone couverte par Eurostat
function nuts0Code(iso3, iso2) {
  if (!(EU_MEMBERS.has(iso3) || EFTA.has(iso3) || NUTS0_CANDIDATES.has(iso3))) return '';
  return NUTS0_OVERRIDE[iso3] || iso2 || '';
}

function PAYS_COLS() { return [{ label: t('col_nis'), num: true, w: 60 }, { label: t('col_iso3'), w: 56 }, { label: t('col_iso2'), w: 52 }, { label: t('col_nuts0'), w: 64 }, { label: t('col_country'), w: 180, render: (v, r) => (flagFromIso2(r[2]) ? '<span style="margin-right:4px">' + flagFromIso2(r[2]) + '</span>' : '') + escHtml(v) }, { label: t('col_continent'), w: 130 }, { label: t('col_eu'), w: 54 }]; }
let _paysAll = [];

function initPays() {
  _paysAll = Object.entries(NLTY_ISO).map(([code, iso]) => {
    const iso2 = (PAYS_I18N[iso] || {}).iso2 || '';
    return [code, iso, iso2, nuts0Code(iso, iso2), paysNom(iso), continentLabel(continentNIS(code)), EU_MEMBERS.has(iso) ? 'EU' : ''];
  });
  const conts = [...new Set(_paysAll.map(r => r[5]).filter(Boolean))].sort();
  document.getElementById('filtrePaysCont').innerHTML =
    `<option value="">${escHtml(t('opt_all_continents'))}</option>` + conts.map(c => `<option>${c}</option>`).join('');
  document.getElementById('filtrePaysUE').value = '';
  filtrerPays();
}

function effacerRecherchePays() {
  document.getElementById('filtrePays').value = '';
  filtrerPays();
  document.getElementById('filtrePays').focus();
}

function filtrerPays() {
  const cont = document.getElementById('filtrePaysCont').value;
  const ue   = document.getElementById('filtrePaysUE').value;
  const champ = document.getElementById('filtrePays');
  const q    = sansAccent((champ.value || '').trim());
  document.getElementById('filtrePaysClear').style.display = champ.value ? 'flex' : 'none';
  const rows = _paysAll.filter(r =>
    (!cont || r[5] === cont) &&
    (!ue || (ue === 'eu' ? r[6] === 'EU' : r[6] !== 'EU')) &&
    (!q || r[0].includes(q) || (r[1] || '').toLowerCase().includes(q) ||
      (r[2] || '').toLowerCase().includes(q) || (r[3] || '').toLowerCase().includes(q) ||
      sansAccent(r[4]).includes(q))
  );
  document.getElementById('paysCount').textContent = `${rows.length} / ${_paysAll.length}`;
  tableTriable('refNlty', PAYS_COLS(), rows);
}

// Bascule entre les tables de référence (sous-onglets de la modale Lookup)
function lookupTab(k) {
  ['sexe', 'mrtl', 'nlty', 'commune'].forEach(n => {
    document.querySelector('.lk-tab[data-lk="' + n + '"]').classList.toggle('actif', n === k);
    document.getElementById('lkpan-' + n).classList.toggle('actif', n === k);
  });
}

// ── Filtrage des communes belges par région / province / recherche ──────
// Colonnes : [REFNIS, Municipality, District, Province, Region, NUTS2, NUTS3]
// Colonnes : [REFNIS, FR, NL, District, Province, Region, NUTS2, NUTS3]
function COMMUNE_COLS() { return [{ label: t('col_refnis'), num: true, w: 72 }, { label: t('col_muni_fr'), w: 150 }, { label: t('col_muni_nl'), w: 150 }, { label: t('col_district'), w: 120 }, { label: t('col_province'), w: 120 }, { label: t('col_region'), w: 110 }, { label: t('col_nuts2'), w: 78 }, { label: t('col_nuts3'), w: 78 }]; }
let _communesAll = [];

function initCommunes() {
  _communesAll = Object.entries(REFNIS_COMMUNE).map(([code, nom]) => {
    const i = refnisInfo(code);
    return [code, nom.fr || '', nom.nl || '', i.district, i.province, i.region, i.nuts2, i.nuts3];
  });
  const regs = [...new Set(_communesAll.map(r => r[5]).filter(Boolean))].sort();
  document.getElementById('filtreRegion').innerHTML =
    `<option value="">${escHtml(t('opt_all_regions'))}</option>` + regs.map(r => `<option>${r}</option>`).join('');
  document.getElementById('filtreProvince').value = '';
  document.getElementById('filtreDistrict').value = '';
  majProvinces();
  filtrerCommunes();
}

// Efface la recherche par nom/REFNIS (croix dans le champ)
function effacerRechercheCommune() {
  document.getElementById('filtreCommune').value = '';
  filtrerCommunes();
  document.getElementById('filtreCommune').focus();
}

// Cascade Région → Province (puis enchaîne sur les arrondissements)
function majProvinces() {
  const reg = document.getElementById('filtreRegion').value;
  const sel = document.getElementById('filtreProvince');
  const cur = sel.value;
  const provs = [...new Set(_communesAll.filter(r => !reg || r[5] === reg).map(r => r[4]).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${escHtml(t('opt_all_provinces'))}</option>` +
    provs.map(p => `<option${p === cur ? ' selected' : ''}>${p}</option>`).join('');
  majDistricts();
}

// Cascade Région/Province → Arrondissement (district)
function majDistricts() {
  const reg  = document.getElementById('filtreRegion').value;
  const prov = document.getElementById('filtreProvince').value;
  const sel  = document.getElementById('filtreDistrict');
  const cur  = sel.value;
  const dists = [...new Set(_communesAll
    .filter(r => (!reg || r[5] === reg) && (!prov || r[4] === prov))
    .map(r => r[3]).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${escHtml(t('opt_all_districts'))}</option>` +
    dists.map(d => `<option${d === cur ? ' selected' : ''}>${d}</option>`).join('');
}

const sansAccent = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function filtrerCommunes() {
  const reg  = document.getElementById('filtreRegion').value;
  const prov = document.getElementById('filtreProvince').value;
  const dist = document.getElementById('filtreDistrict').value;
  const champ = document.getElementById('filtreCommune');
  const q    = sansAccent((champ.value || '').trim());
  document.getElementById('filtreCommuneClear').style.display = champ.value ? 'flex' : 'none';
  const rows = _communesAll.filter(r =>
    (!reg || r[5] === reg) && (!prov || r[4] === prov) && (!dist || r[3] === dist) &&
    (!q || r[0].includes(q) || sansAccent(r[1]).includes(q) || sansAccent(r[2]).includes(q))
  );
  document.getElementById('communeCount').textContent = `${rows.length} / ${_communesAll.length}`;
  tableTriable('refCommune', COMMUNE_COLS(), rows);
}

function fermerParametres() {
  document.getElementById('modalParams').classList.remove('open');
}

// ════════════════════════════════════════════════════════════════════════
//  REGISTRE DES PLANNINGS (lecture seule) — l'import et la gestion des plannings
//  ont été déplacés dans le Planner (statbel_planner.html). On conserve ici la
//  lecture du stockage partagé localStorage['plannings'] pour que l'annexe
//  « Aperçu » relie chaque GRP_2026xxxxx au planning LFS importé (index « grp »).
// ════════════════════════════════════════════════════════════════════════

// ── Registre des plannings : uniquement les plannings importés (persistés) ──
let _plannings = {}, _planActif = '';

function chargerRegistrePlannings() {
  _plannings = {};
  let imp = [];
  try { imp = JSON.parse(localStorage.getItem('plannings') || '[]'); } catch (e) { imp = []; }
  imp.forEach(p => { if (p && p.id) _plannings[p.id] = p; });
  if (!_plannings[_planActif]) _planActif = Object.keys(_plannings)[0] || '';
}


// Pyramide filtrée par nationalité (sélecteur #pyrNlty)
let _pyrPop = [];
function majPyramide() {
  const iso = (document.getElementById('pyrNlty') || {}).value || '';
  const pop = iso ? _pyrPop.filter(r => r.nationality === iso) : _pyrPop;
  const ageData = TRANCHES_AGE.map(([min, max, lbl]) => ({ min, max, lbl, h: 0, f: 0 }));
  pop.forEach(r => {
    const a = parseInt(r.age); if (isNaN(a)) return;
    const t = ageData.find(d => a >= d.min && a <= d.max); if (!t) return;
    if (r.sexe === 'M') t.h++; else if (r.sexe === 'F') t.f++;
  });
  renderPyramide('statsAge', ageData);
  const det = document.getElementById('statsAgeDetail'); if (det) det.innerHTML = '';   // reset détail
}

// Clic sur une tranche d'âge → répartition par nationalité (treemap) de cette tranche
function zoomTranche(min, max, lbl) {
  const sub = _pyrPop.filter(r => { const a = parseInt(r.age); return !isNaN(a) && a >= min && a <= max; });
  natTreemapInto('statsAgeDetail', tf('txt_bracket', { lbl }), sub, { personUnit: true });
}

// Clic sur un sexe (donut) → répartition par nationalité (treemap)
let _genderPop = [];
function zoomGender(sx) {
  const lbl = sx === 'M' ? t('gender_men') : sx === 'F' ? t('gender_women') : t('gender_other');
  const sub = _genderPop.filter(r => (r.sexe || 'X') === sx || (sx === 'X' && r.sexe !== 'M' && r.sexe !== 'F'));
  natTreemapInto('statsSexeDetail', lbl, sub);
}

// Clic sur un statut matrimonial → répartition par nationalité (treemap)
let _maritalPop = [];
function zoomMarital(lib) {
  const sub = _maritalPop.filter(r => String(r.marital_status || '') === String(lib));
  natTreemapInto('statsMrtlDetail', lib ? mrtlLabel(lib) : '—', sub);
}

// Clic sur une taille de ménage → répartition par nationalité (treemap) des ménages de cette taille
let _menagePop = [];
function zoomMenage(taille) {
  const sub = _menagePop.filter(r => String(r.taille_menage) === String(taille));
  natTreemapInto('statsTailleDetail', tf('txt_households_of_size', { n: taille }), sub, { hh: true });
}

// Drill-down des tranches d'âge : au clic, treemap des nationalités de la tranche
// (même principe que la répartition par taille de ménage).
let _ageLFSPop = [];
function zoomAgeLFS(key) {
  const p = String(key).split('_').map(Number), lo = p[0], hi = p[1];
  const sub = (_ageLFSPop || []).filter(r => { const a = parseInt(r.age, 10); return !isNaN(a) && a >= lo && a <= hi; });
  const brLabel = hi >= 999 ? (lo + '+') : (lo + '–' + hi);
  natTreemapInto('statsAgeLFSDetail', brLabel, sub);
}

// Drill-down « Personnes à interroger par ménage » : au clic sur une barre,
// treemap des nationalités (référent) des ménages ayant ce nombre de cibles.
let _ciblesMenages = [];
function zoomCibles(key) {
  const sub = _ciblesMenages.filter(h => key === '4+' ? h.cibles >= 4 : h.cibles === Number(key));
  natTreemapInto('statsCiblesHHDetail', key + ' ' + t('word_targets_unit'), sub);
}

// Puces de catégorie cliquables → treemap par nationalité. Utilisées par le Ratio
// de dépendance, dont le donut (lib partagée) affiche le ratio au centre et n'est
// donc pas cliquable (la Composition, elle, utilise le donut cliquable renderDonut).
function natDrillChips(cats, fn) {
  return '<div style="font-size:10.5px;color:var(--text3);margin:0 0 5px">' + escHtml(t('txt_drill_hint')) + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">'
    + cats.filter(c => c.value > 0).map(c =>
        `<button type="button" onclick="${fn}('${c.key}')" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 9px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text2);cursor:pointer">`
        + `<span style="width:9px;height:9px;border-radius:50%;background:${c.color};flex:none"></span>${escHtml(c.label)} (${c.value})</button>`).join('')
    + '</div>';
}
// Rendu commun d'un treemap de nationalités (en-tête + compte + ✕) dans un conteneur
// donné, suivi de renderTreemapNlty. Mutualise le drill-down de TOUS les blocs Stats
// (âge, sexe, statut matrimonial, taille/composition de ménage, tranches LFS, cibles,
// dépendance). Les items acceptent .nationality (personnes) ou .nat (ménages : réf.).
// opts.personUnit : insère « N personnes » dans le sous-titre (tranches d'âge) ;
// opts.hh : sous-titre « par nationalité (réf. du ménage) » au lieu du générique.
function natTreemapInto(tmId, titre, sub, opts) {
  const el = document.getElementById(tmId); if (!el) return;
  if (!sub.length) { el.innerHTML = ''; return; }
  opts = opts || {};
  const cnt = {};
  sub.forEach(x => { const v = x.nationality != null ? x.nationality : x.nat; const n = paysNom(v) || v || '—'; cnt[n] = (cnt[n] || 0) + 1; });
  const items = Object.entries(cnt).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const unit = opts.personUnit ? ' ' + escHtml(tPlural('word_person', sub.length)) : '';
  const natTxt = escHtml(t(opts.hh ? 'txt_by_nationality_hh' : 'txt_by_nationality'));
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);margin:2px 0 4px">
      <b style="color:var(--text)">${escHtml(titre)}</b> — ${sub.length}${unit}${natTxt}
      <button class="btn-reset" style="margin:0 0 0 auto;padding:1px 7px" aria-label="${escHtml(t('btn_clear'))}" title="${escHtml(t('btn_clear'))}" onclick="document.getElementById('${tmId}').innerHTML=''">✕</button>
    </div><div id="${tmId}-tm"></div>`;
  renderTreemapNlty(tmId + '-tm', items);
}

// Ratio de dépendance : clic sur une tranche → nationalités des personnes de la tranche.
let _dependPop = [];
function zoomDepend(key) {
  const rng = { young: [0, 14], active: [15, 64], old: [65, 999] }[key] || [0, 999];
  const lbl = { young: t('lbl_dep_young'), active: t('lbl_dep_active'), old: t('lbl_dep_old') }[key] || '';
  const sub = _dependPop.filter(r => { const a = parseInt(r.age, 10); return !isNaN(a) && a >= rng[0] && a <= rng[1]; });
  natTreemapInto('statsDependTM', lbl, sub);
}
// Composition des ménages : clic sur un type → nationalités (du référent) des ménages du type.
function zoomCompo(key) {
  const pred = { mono: h => h.total === 1, withminor: h => h.total > 1 && h.minors > 0, nominor: h => h.total > 1 && h.minors === 0 }[key] || (() => false);
  const lbl = { mono: t('lbl_hh_mono'), withminor: t('lbl_hh_with_minor'), nominor: t('lbl_hh_no_minor') }[key] || '';
  natTreemapInto('statsCompoTM', lbl, _ciblesMenages.filter(pred));
}

// ════════════════════════════════════════════════════════════════════════
//  STATISTIQUES (bascule Cibles / Tout le ménage)
// ════════════════════════════════════════════════════════════════════════

let statsScope = 'referent';   // 'referent' (FL=1) | 'cible' (≥ âge min) | 'membres' (ménage complet)
let statsEnq   = 'active';    // 'active' (enquête en cours) | 'all' (toutes les sources chargées)

// Population utilisée pour les stats : enquête active ou agrégat de toutes les sources
function statsPourStats() {
  if (statsEnq === 'all') {
    const outCibles = [], outMembres = [];
    Object.values(sources).forEach(v => { outCibles.push(...v.res.outCibles); outMembres.push(...v.res.outMembres); });
    return { outCibles, outMembres };
  }
  return _resultat;
}

function setStatsEnq(s) {
  if (s === statsEnq) return;
  statsEnq = s;
  majStatsEnqUI();
  if (_resultat) majStats(statsPourStats());
}

function majStatsEnqUI() {
  document.querySelectorAll('#enqToggle button').forEach(b =>
    b.classList.toggle('actif', b.dataset.enq === statsEnq));
}

const TRANCHES_AGE = [
  [0, 17, '0 – 17 yrs'], [18, 24, '18 – 24 yrs'], [25, 34, '25 – 34 yrs'],
  [35, 44, '35 – 44 yrs'], [45, 54, '45 – 54 yrs'], [55, 64, '55 – 64 yrs'],
  [65, 74, '65 – 74 yrs'], [75, 999, '75 yrs and +'],
];

function setScope(s) {
  if (s === statsScope) return;
  statsScope = s;
  majScopeUI();
  if (_resultat) majStats(statsPourStats());
}

function majScopeUI() {
  document.querySelectorAll('#popToggle button').forEach(b =>
    b.classList.toggle('actif', b.dataset.scope === statsScope));
}

// Composition des ménages, calculée PAR SOURCE (nr_hh est unique dans un groupe,
// mais peut se répéter d'un groupe à l'autre → on ne fusionne jamais entre sources).
// Respecte le périmètre (enquête active / toutes). Retourne [{total, cibles, minors}].
function menagesComposition() {
  const min = ageMinCible();
  const srcs = statsEnq === 'all'
    ? Object.values(sources).map(v => v.res).filter(Boolean)
    : (_resultat ? [_resultat] : []);
  const out = [];
  srcs.forEach(res => {
    const hh = {};
    (res.outMembres || []).forEach(r => {
      const h = hh[r.nr_hh] || (hh[r.nr_hh] = { total: 0, cibles: 0, minors: 0, nat: '' });
      h.total++;
      if (r.fl_cntct === '1') h.nat = r.nationality || '';   // nationalité du référent (drill-down)
      const a = parseInt(r.age, 10);
      if (!isNaN(a) && a >= min) h.cibles++;
      else if (!isNaN(a)) h.minors++;
    });
    out.push(...Object.values(hh));
  });
  return out;
}

// Rendu des deux cartes ménage : cibles (≥ âge min) par ménage + composition.
function majMenagesCartes() {
  const menages = menagesComposition();
  const nbMen = menages.length;
  const elMoy = document.getElementById('kpiCiblesMoy');
  const elDist = document.getElementById('statsCiblesHH');
  const elCompo = document.getElementById('statsCompoHH');
  const elDetail = document.getElementById('statsCompoHHDetail');
  if (!nbMen) {
    if (elMoy) elMoy.textContent = '';
    if (elDist) elDist.innerHTML = '';
    if (elCompo) elCompo.innerHTML = '';
    if (elDetail) elDetail.textContent = '';
    return;
  }
  // 1) Personnes à interroger (≥ âge min) par ménage : moyenne + distribution
  _ciblesMenages = menages;   // pour le drill-down par nationalité
  const tt = document.getElementById('titreCiblesHH');
  if (tt) tt.textContent = tf('card_targets_per_hh_dyn', { n: ageMinCible() });
  const totCibles = menages.reduce((s, h) => s + h.cibles, 0);
  if (elMoy) elMoy.textContent = 'Ø ' + (totCibles / nbMen).toFixed(1) + ' ' + t('word_targets_per_hh_unit');
  const dist = {};
  menages.forEach(h => { const k = h.cibles >= 4 ? '4+' : String(h.cibles); dist[k] = (dist[k] || 0) + 1; });
  const ord = k => k === '4+' ? 4 : Number(k);
  renderBarres('statsCiblesHH', Object.keys(dist).sort((a, b) => ord(a) - ord(b))
    .map(k => ({ label: k + ' ' + t('word_targets_unit'), count: dist[k], color: '#3949ab', key: k })), '#3949ab', 'zoomCibles');
  // 2) Composition : mono-personne / multi avec mineur (<min) / multi sans mineur (≥min)
  const min = ageMinCible();
  let mono = 0, avecMin = 0, sansMin = 0;
  menages.forEach(h => { if (h.total === 1) mono++; else if (h.minors > 0) avecMin++; else sansMin++; });
  // Donut cliquable (renderDonut local, comme la carte Sexe) : un clic sur un segment
  // ou sa ligne de légende ouvre le treemap des nationalités (référent du ménage) dans
  // #statsCompoTM. La clé de chaque item pilote le drill (zoomCompo).
  const compoItems = [
    { key: 'mono',      label: t('lbl_hh_mono'),                            value: mono,    color: '#0277bd' },
    { key: 'withminor', label: t('lbl_hh_with_minor') + ' (<' + min + ')',  value: avecMin, color: '#f9a825' },
    { key: 'nominor',   label: t('lbl_hh_no_minor') + ' (≥' + min + ')',    value: sansMin, color: '#2e7d32' },
  ];
  renderDonut('statsCompoHH', compoItems, 'zoomCompo');
  if (elDetail) elDetail.innerHTML = '<div id="statsCompoTM"></div>';
}

// ════════════════════════════════════════════════════════════════════════
//  KPI — registre, config personnalisable (afficher/masquer + ordre), rendu
// ════════════════════════════════════════════════════════════════════════
let _kpiCtx = null;   // dernières mesures calculées (pour re-rendu à la volée)

function median(a) {
  if (!a || !a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Quotas de paiement Statbel repris des PARAMÈTRES du module Interviews (même
// localStorage['statbel_settings'] que la langue — lu à chaque rendu, pas mis en
// cache dans _kpiCtx : un changement de quotas doit apparaître sans réimporter).
// Absents ou nuls → { menage:0, personne:0 } (KPI « — » avec repli explicatif).
function paieQuotas() {
  const s = lireSettings();
  return { menage: Number(s.paieMenage) || 0, personne: Number(s.paiePersonne) || 0 };
}
// Calcul de l'indemnité potentielle, factorisé pour que `val` et `tip` (appelés
// séparément par renderKPIs) ne redérivent pas chacun leur « a-t-on un quota ? ».
function paieCalc(c) {
  const q = paieQuotas();
  return { q, has: !!(q.menage || q.personne), montant: c.nbHH * q.menage + c.nbCibles15 * q.personne };
}
function eurFmt(n) {
  try { return new Intl.NumberFormat(uiLang || 'fr', { style: 'currency', currency: 'EUR' }).format(n); }
  catch (e) { return (Math.round(n * 100) / 100) + ' €'; }
}

// Registre des indicateurs disponibles : libellé (i18n), couleur de bordure,
// teinte éventuelle de la valeur, et fonction de calcul depuis le contexte.
const KPI_DEFS = {
  // Accent unique (indigo de marque) pour toutes les tuiles : la couleur ne code
  // un sens que là où elle porte de l'information — le genre (h/f). Toute autre
  // teinte serait décorative (cf. DESIGN.md : le sémantique est réservé à un état).
  men:  { i18n: 'kpi_households',  color: 'var(--bleu)', val: c => c.nbHH },
  pop:  { i18n: 'kpi_pop_total',   color: 'var(--bleu)', val: c => c.popN },
  size: { i18n: 'kpi_avg_hh_size', color: 'var(--bleu)', val: c => c.nbHH ? (c.membres / c.nbHH).toFixed(1) : '—' },
  age:  { i18n: 'kpi_avg_age',     color: 'var(--bleu)', val: c => c.ageMoy != null ? c.ageMoy + ' ' + t('age_years') : '—' },
  h:    { i18n: 'kpi_pct_men',     color: 'var(--bar-h)', tint: 'var(--bar-h)', val: c => c.popN ? Math.round(c.kM / c.popN * 100) + ' %' : '—' },
  f:    { i18n: 'kpi_pct_women',   color: 'var(--bar-f)', tint: 'var(--bar-f)', val: c => c.popN ? Math.round(c.kF / c.popN * 100) + ' %' : '—' },
  cib:  { i18n: 'kpi_targets_min', color: 'var(--bleu)', val: c => c.nbCibles15, dyn: () => tf('kpi_targets_min', { n: ageMinCible() }) },
  etr:  { i18n: 'kpi_pct_foreign', color: 'var(--bleu)', val: c => c.popN ? Math.round(c.nEtr / c.popN * 100) + ' %' : '—' },
  min:  { i18n: 'kpi_pct_minors',  color: 'var(--bleu)', val: c => c.membres ? Math.round(c.nMin / c.membres * 100) + ' %' : '—', dyn: () => tf('kpi_pct_minors_dyn', { n: ageMinCible() }) },
  med:  { i18n: 'kpi_age_median',  color: 'var(--bleu)', val: c => c.ageMed != null ? c.ageMed + ' ' + t('age_years') : '—' },
  // Indemnité POTENTIELLE : montant maximal payé par Statbel si toute l'enquête
  // est réalisée. Même règle que le Résumé d'Interviews (ménages × quota ménage
  // + cibles ≥ âge min × quota personne), mais sur la totalité du groupe (rien
  // n'est encore réalisé au stade Convertisseur). Quotas repris des paramètres
  // du module Interviews ; absents → « — » + titre explicatif.
  paie: { i18n: 'kpi_pay_potential', color: 'var(--bleu)',
          val: c => { const { has, montant } = paieCalc(c); return has ? eurFmt(montant) : '—'; },
          tip: c => { const { has, q } = paieCalc(c); return has
            ? tf('kpi_pay_potential_tip', { hh: c.nbHH, qm: eurFmt(q.menage), cib: c.nbCibles15, qp: eurFmt(q.personne) })
            : t('kpi_pay_no_quota'); } },
};
const KPI_ALL = ['men', 'pop', 'size', 'age', 'h', 'f', 'cib', 'etr', 'min', 'med', 'paie'];
const KPI_ON_DEFAUT = ['men', 'pop', 'size', 'age', 'h', 'f', 'paie'];   // affichés par défaut, dans cet ordre

// Registre des blocs d'analyse (cartes de la vue Stats) — tous affichés par défaut.
const BLOC_DEFS = {
  // Blocs déclaratifs : data(ctx)=>items + type de graphe (chart) + drill/detailEl éventuels.
  nat:    { i18n: 'card_nationalities', el: 'statsTreemap', chart: 'treemap',
            data: ctx => { const nlty = {}; ctx.pop.forEach(r => { const s = ctx.sx(r); (nlty[r.nationality] = nlty[r.nationality] || { h: 0, f: 0 }); if (s) nlty[r.nationality][s]++; });
              return Object.entries(nlty).map(([iso, v]) => ({ label: paysNom(iso) || iso || '—', value: v.h + v.f })).filter(d => d.value > 0).sort((a, b) => b.value - a.value); } },
  cont:   { i18n: 'card_by_continent', el: 'statsCont', chart: 'barStack',
            data: ctx => { const cont = {}; ctx.pop.forEach(r => { const s = ctx.sx(r); const ck = ctx.contOf(r.nationality); (cont[ck] = cont[ck] || { h: 0, f: 0 }); if (s) cont[ck][s]++; });
              return Object.entries(cont).sort((a, b) => (b[1].h + b[1].f) - (a[1].h + a[1].f)).map(([c, v]) => ({ label: continentLabel(c), h: v.h, f: v.f })); } },
  eu:     { i18n: 'card_eu_noneu', el: 'statsEU', chart: 'donut',
            data: ctx => { const eu = {}; ctx.pop.forEach(r => { const s = ctx.sx(r); const ek = ctx.euOf(r.nationality); (eu[ek] = eu[ek] || { h: 0, f: 0 }); if (s) eu[ek][s]++; });
              const ord = { 'EU': 0, 'Non-EU': 1, 'Unknown': 2 }, coul = { 'EU': '#1a237e', 'Non-EU': '#f9a825', 'Unknown': '#9e9e9e' }, lbl = { 'EU': t('lbl_eu_short'), 'Non-EU': t('lbl_noneu_short'), 'Unknown': t('lbl_unknown') };
              return Object.entries(eu).sort((a, b) => (ord[a[0]] ?? 9) - (ord[b[0]] ?? 9)).map(([k, v]) => ({ label: lbl[k] || k, value: v.h + v.f, color: coul[k] })); } },
  mrtl:   { i18n: 'card_marital', el: 'statsMrtl', chart: 'bar100', drill: 'zoomMarital', detailEl: 'statsMrtlDetail',
            data: ctx => { _maritalPop = ctx.pop; const mrtl = {}; ctx.pop.forEach(r => { const s = ctx.sx(r); (mrtl[r.marital_status] = mrtl[r.marital_status] || { h: 0, f: 0 }); if (s) mrtl[r.marital_status][s]++; });
              return Object.entries(mrtl).sort((a, b) => (b[1].h + b[1].f) - (a[1].h + a[1].f)).map(([lib, v]) => ({ key: lib, label: lib ? mrtlLabel(lib) : '—', value: v.h + v.f })); } },
  sexe:   { i18n: 'card_gender', el: 'statsSexe', chart: 'donut', drill: 'zoomGender', detailEl: 'statsSexeDetail',
            data: ctx => { _genderPop = ctx.pop; const nbM = ctx.pop.filter(m => m.sexe === 'M').length, nbF = ctx.pop.filter(m => m.sexe === 'F').length, nbX = ctx.pop.length - nbM - nbF;
              const items = [{ key: 'M', label: t('gender_men'), value: nbM, color: 'var(--bar-h)' }, { key: 'F', label: t('gender_women'), value: nbF, color: 'var(--bar-f)' }];
              if (nbX) items.push({ key: 'X', label: '—', value: nbX, color: '#9e9e9e' }); return items; } },
  birth:  { i18n: 'card_birthplace',
            render: ctx => { _birthPopBE = ctx.pop.filter(r => r.birth_country === 'BEL' && r.birth_region); _birthDrill = { level: 'region', region: '', province: '', district: '' }; renderBirthDrill(); } },
  age:    { i18n: 'card_age_pyramid',
            render: ctx => { _pyrPop = ctx.pop; const selPyr = document.getElementById('pyrNlty'); const cur = selPyr ? selPyr.value : '';
              const natCnt = {}; ctx.pop.forEach(r => { if (r.nationality) natCnt[r.nationality] = (natCnt[r.nationality] || 0) + 1; });
              const opts = '<option value="">Toutes nationalités (' + ctx.pop.length + ')</option>' + Object.entries(natCnt).sort((a, b) => b[1] - a[1]).map(([iso, n]) => `<option value="${iso}"${iso === cur ? ' selected' : ''}>${escHtml(paysNom(iso) || iso)} (${n})</option>`).join('');
              if (selPyr) selPyr.innerHTML = opts; majPyramide(); } },
  size:   { i18n: 'card_household_dist', el: 'statsTaille', chart: 'barStack', drill: 'zoomMenage', detailEl: 'statsTailleDetail',
            data: ctx => { _menagePop = ctx.res.outCibles; const taille = {}; ctx.res.outCibles.forEach(r => { const s = ctx.sx(r); (taille[r.taille_menage] = taille[r.taille_menage] || { h: 0, f: 0 }); if (s) taille[r.taille_menage][s]++; });
              return Object.entries(taille).sort((a, b) => Number(a[0]) - Number(b[0])).map(([sz, v]) => ({ key: sz, label: `${sz} membre${sz > 1 ? 's' : ''}`, h: v.h, f: v.f })); } },
  chh:    { i18n: 'card_targets_per_hh' },   // rendu hors boucle (majMenagesCartes : chh + compo en une passe)
  compo:  { i18n: 'card_hh_composition' },   // idem chh
  ageLFS: { i18n: 'card_age_lfs', el: 'statsAgeLFS', chart: 'barStack', drill: 'zoomAgeLFS',
            data: ctx => { const brLFS = [[0, 14, '0–14'], [15, 24, '15–24'], [25, 54, '25–54'], [55, 64, '55–64'], [65, 999, '65+']];
              const ageLFS = brLFS.map(([lo, hi, lbl]) => ({ label: lbl, h: 0, f: 0, key: lo + '_' + hi }));
              ctx.pop.forEach(r => { const a = parseInt(r.age, 10); if (isNaN(a)) return; const bi = brLFS.findIndex(([lo, hi]) => a >= lo && a <= hi); if (bi < 0) return; if (r.sexe === 'M') ageLFS[bi].h++; else if (r.sexe === 'F') ageLFS[bi].f++; });
              _ageLFSPop = ctx.pop; return ageLFS; } },
  depend: { i18n: 'card_dependency',
            render: ctx => { const memD = ctx.res.outMembres; const inBr = (r, lo, hi) => { const a = parseInt(r.age, 10); return !isNaN(a) && a >= lo && a <= hi; };
              const dJeune = memD.filter(r => inBr(r, 0, 14)).length, dActif = memD.filter(r => inBr(r, 15, 64)).length, dAge = memD.filter(r => inBr(r, 65, 999)).length;
              const dRatio = dActif ? Math.round((dJeune + dAge) / dActif * 100) : null;
              const depItems = [{ label: t('lbl_dep_young'), value: dJeune, color: '#f9a825' }, { label: t('lbl_dep_active'), value: dActif, color: '#2e7d32' }, { label: t('lbl_dep_old'), value: dAge, color: '#8d6e63' }];
              const elDep = document.getElementById('statsDepend');
              if (window.Charts) elDep.innerHTML = Charts.donut(depItems, { total: dRatio != null ? dRatio : '—', unitLabel: t('lbl_dep_ratio'), ariaLabel: t('card_dependency'), size: DONUT_SIZE, thick: DONUT_THICK });
              else renderDonut('statsDepend', depItems.filter(d => d.value > 0));
              _dependPop = memD;   // pour le drill-down par nationalité
              const elDepD = document.getElementById('statsDependDetail');
              if (elDepD) {
                const ratioTxt = dRatio != null ? `<div style="margin-bottom:6px">${escHtml(tf('txt_dep_ratio', { n: dRatio }))}</div>` : '';
                elDepD.innerHTML = ratioTxt + natDrillChips([
                  { key: 'young',  label: t('lbl_dep_young'),  value: dJeune, color: '#f9a825' },
                  { key: 'active', label: t('lbl_dep_active'), value: dActif, color: '#2e7d32' },
                  { key: 'old',    label: t('lbl_dep_old'),    value: dAge,   color: '#8d6e63' },
                ], 'zoomDepend') + '<div id="statsDependTM"></div>';
              } } },
  contact:{ i18n: 'card_contactability', el: 'statsContact', chart: 'bar',
            data: ctx => { const hhc = ctx.res.outCibles || []; const nHHc = hhc.length || 1; const aTel = r => r.gsm && String(r.gsm).trim(), aMail = r => r.email && String(r.email).trim();
              const cTel = hhc.filter(aTel).length, cMail = hhc.filter(aMail).length, cJoin = hhc.filter(r => aTel(r) || aMail(r)).length; const pctL = (key, n) => `${t(key)} — ${Math.round(n / nHHc * 100)} %`;
              return [{ label: pctL('lbl_has_phone', cTel), count: cTel, color: '#2e7d32' }, { label: pctL('lbl_has_email', cMail), count: cMail, color: '#0277bd' }, { label: pctL('lbl_reachable', cJoin), count: cJoin, color: '#1a237e' }]; } },
  sankey: { i18n: 'card_sankey', render: ctx => renderSankeyNSA('statsSankey', ctx.pop) },
  sankeyHH: { i18n: 'card_sankey_hh', render: ctx => renderSankeyMenage('statsSankeyHH', ctx.res) },
};
const BLOC_ALL = ['nat', 'cont', 'eu', 'mrtl', 'sexe', 'birth', 'age', 'ageLFS', 'depend', 'size', 'chh', 'compo', 'contact', 'sankey', 'sankeyHH'];
// Défaut allégé (nouveaux utilisateurs) : 6 blocs cœur affichés d'emblée ; le reste
// reste activable via « Personnaliser ». Les préférences déjà enregistrées priment.
const BLOC_ON_DEFAUT = ['nat', 'sexe', 'age', 'size', 'mrtl', 'eu'];

// Aiguilleur de rendu : type de graphe → primitive, sur la forme d'item native du graphe.
const RENDERERS = {
  treemap:  (el, items) => renderTreemapNlty(el, items),
  barStack: (el, items, drill) => renderBarresStack(el, items, drill),
  bar:      (el, items, drill) => renderBarres(el, items, '#1a237e', drill),
  bar100:   (el, items, drill) => renderBarres100(el, items, drill),
  donut:    (el, items, drill) => renderDonut(el, items, drill),
};

// Rend un bloc d'analyse depuis son descripteur : render() sur-mesure, ou
// data()→graphe déclaratif (avec reset du détail de drill éventuel).
function renderBloc(id, ctx) {
  const def = BLOC_DEFS[id];
  if (!def) return;
  if (def.render) { def.render(ctx); return; }
  if (!def.data) return;   // chh/compo : rendus hors boucle par majMenagesCartes()
  if (def.detailEl) { const d = document.getElementById(def.detailEl); if (d) d.innerHTML = ''; }
  const fn = RENDERERS[def.chart]; if (fn) fn(def.el, def.data(ctx), def.drill);
}

// Cellule d'un identifiant/mot de passe web CAWI. Une valeur restée en notation
// scientifique (« 2.02612E+11 ») est CORROMPUE et inutilisable (Excel a écrasé les
// chiffres) : on la marque d'un ⚠ + info-bulle plutôt que de l'afficher comme un login
// valide. Sinon : valeur telle quelle (ou tiret si vide).
function cawiCellule(v) {
  const s = (v || '').trim();
  if (!s) return '<span class="vide">—</span>';
  if (RE_SCI_ID.test(s))
    return `<span class="id-sci" title="${escHtml(t('cawi_sci_tip'))}">⚠ ${escHtml(s)}</span>`;
  return escHtml(s);
}

// Colonnes du tableau de contacts de l'Aperçu — {libellé i18n, <th>, cellule(r)}.
// La colonne d'expansion (▸) est structurelle : toujours présente, hors config.
const COL_DEFS = {
  ordre:   { i18n: 'col_num',      th: '<th class="sortable" data-col="ordre" data-table="cibles" style="min-width:36px">#</th>',
             cell: r => `<td class="ordre">${escHtml(r.ordre)}</td>` },
  contact: { i18n: 'th_contact',   th: '<th class="sortable" data-col="prenom" data-table="cibles" style="min-width:150px" data-i18n="th_contact">Contact</th>',
             cell: r => `<td>${escHtml(r.prenom)} ${escHtml(r.nom)}</td>` },
  adresse: { i18n: 'th_address',   th: '<th class="sortable" data-col="adresse" data-table="cibles" style="min-width:240px" data-i18n="th_address">Address</th>',
             cell: r => `<td style="font-size:11px;color:var(--text2)">${escHtml(r.adresse)}</td>` },
  gsm:     { i18n: 'th_phone',     th: '<th class="sortable" data-col="gsm" data-table="cibles" style="min-width:150px" data-i18n="th_phone">📞 Phone</th>',
             cell: r => { const tp = telBE(r.gsm);
               return `<td style="white-space:nowrap">${tp
                 ? `<a class="lien-nu" href="tel:${escHtml(tp.e164)}" title="${escHtml(t('tip_call'))}">${escHtml(tp.disp)}</a>`
                   + ` <a class="lien-nu" href="sms:${escHtml(tp.e164)}" title="${escHtml(t('tip_sms'))}">💬</a>`
                 : '<span class="vide">—</span>'}</td>`; } },
  email:   { i18n: 'th_email',     th: '<th class="sortable" data-col="email" data-table="cibles" style="min-width:160px" data-i18n="th_email">✉️ Email</th>',
             cell: r => { const e = (r.email || '').trim().toLowerCase();
               return `<td style="font-size:11px">${e
                 ? `<a class="lien-nu" href="mailto:${escHtml(e)}" title="${escHtml(t('tip_email'))}">${escHtml(e)}</a>`
                 : '<span class="vide">—</span>'}</td>`; } },
  menage:  { i18n: 'th_household', th: '<th class="sortable" data-col="taille_menage" data-table="cibles" style="min-width:96px" data-i18n="th_household">Household</th>',
             cell: r => `<td style="text-align:center">${escHtml(r.taille_menage)}${parseInt(r.nb_cibles, 10) > 1 ? ` <span style="color:var(--text3);font-size:11px">(${escHtml(r.nb_cibles)} ≥15)</span>` : ''}</td>` },
  collect: { i18n: 'th_collect',   th: '<th class="sortable" data-col="collect_method" data-table="cibles" style="min-width:120px" data-i18n="th_collect">Collection method</th>',
             cell: r => { const s = (r.collect_method || '').trim(); if (!s) return '<td><span class="vide">—</span></td>';
               const info = collecteInfo(s);
               return `<td style="white-space:nowrap">${info
                 ? `<span style="display:inline-block;padding:1px 9px;border-radius:10px;font-size:11px;font-weight:600;background:${info.bg};color:${info.fg}">${escHtml(t(info.key))}</span>`
                 : escHtml(s)}</td>`; } },
  // Colonnes optionnelles (désactivées par défaut) — tous les champs importés du référent,
  // activables via « Personnaliser l'affichage → Colonnes ». Démographie reprise des mêmes
  // rendus que le détail ménage ; accès web CAWI (identifiant / mot de passe).
  sexe:        { i18n: 'hh_gender',             th: '<th class="sortable" data-col="sexe" data-table="cibles" style="min-width:90px" data-i18n="hh_gender">Gender</th>',
                 cell: r => `<td style="white-space:nowrap">${r.sexe ? sexeIcone(r.sexe) + ' ' + escHtml(SEXE_LBL[r.sexe] || r.sexe) : '<span class="vide">—</span>'}</td>` },
  age:         { i18n: 'hh_age',                th: '<th class="sortable" data-col="age" data-table="cibles" style="min-width:50px" data-i18n="hh_age">Age</th>',
                 cell: r => `<td style="text-align:center">${r.age !== '' ? escHtml(r.age) : '<span class="vide">—</span>'}</td>` },
  birth_date:  { i18n: 'hh_birthdate',          th: '<th class="sortable" data-col="birth_date" data-table="cibles" style="min-width:96px" data-i18n="hh_birthdate">Birth date</th>',
                 cell: r => `<td style="white-space:nowrap">${escHtml(fmtDateNaiss(r.birth_date)) || '<span class="vide">—</span>'}</td>` },
  birth_country:{ i18n: 'hh_country_birth',     th: '<th class="sortable" data-col="birth_country" data-table="cibles" style="min-width:120px" data-i18n="hh_country_birth">Country birth</th>',
                 cell: r => `<td>${r.birth_country ? paysDrapeau(r.birth_country) : '<span class="vide">—</span>'}</td>` },
  birth_commune:{ i18n: 'hh_municipality_birth', th: '<th class="sortable" data-col="birth_commune" data-table="cibles" style="min-width:130px" data-i18n="hh_municipality_birth">Municipality birth</th>',
                 cell: r => `<td>${escHtml(r.birth_commune) || '<span class="vide">—</span>'}</td>` },
  nationality: { i18n: 'hh_nationality',        th: '<th class="sortable" data-col="nationality" data-table="cibles" style="min-width:120px" data-i18n="hh_nationality">Nationality</th>',
                 cell: r => `<td>${r.nationality ? paysDrapeau(r.nationality) : '<span class="vide">—</span>'}</td>` },
  marital:     { i18n: 'hh_marital',            th: '<th class="sortable" data-col="marital_status" data-table="cibles" style="min-width:130px" data-i18n="hh_marital">Marital status</th>',
                 cell: r => `<td>${r.marital_status ? mrtlIcone(r.marital_status) + ' ' + escHtml(r.marital_status) : '<span class="vide">—</span>'}</td>` },
  cawi_id:     { i18n: 'th_cawi_id',            th: '<th class="sortable" data-col="web_user_id" data-table="cibles" style="min-width:130px" data-i18n="th_cawi_id">CAWI user ID</th>',
                 cell: r => `<td style="font-family:monospace;font-size:11px">${cawiCellule(r.web_user_id)}</td>` },
  cawi_pwd:    { i18n: 'th_cawi_pwd',            th: '<th class="sortable" data-col="web_user_pwd" data-table="cibles" style="min-width:120px" data-i18n="th_cawi_pwd">CAWI password</th>',
                 cell: r => `<td style="font-family:monospace;font-size:11px">${cawiCellule(r.web_user_pwd)}</td>` },
};
const COL_ALL = ['ordre', 'contact', 'adresse', 'gsm', 'email', 'menage', 'collect',
                 'sexe', 'age', 'birth_date', 'birth_country', 'birth_commune', 'nationality', 'marital', 'cawi_id', 'cawi_pwd'];
// Colonnes affichées par défaut ; les autres (méthode de collecte, démographie, accès CAWI…)
// sont optionnelles, à activer via Personnaliser.
const COL_ON_DEFAUT = ['ordre', 'contact', 'adresse', 'gsm', 'email', 'menage'];

// Colonnes du détail du ménage (accordéon déplié). Chaque cellule reçoit un
// membre `m` ; drapeaux/icônes réutilisent paysDrapeau/sexeIcone/mrtlIcone.
const HH_COL_DEFS = {
  num:           { i18n: 'col_num',               th: '<th style="min-width:34px;padding:3px 6px" data-i18n="col_num">#</th>',
                   cell: m => `<td style="padding:3px 6px;text-align:center">${escHtml(m.nr_membre)}${m.fl_cntct === '1' ? ' ★' : ''}</td>` },
  prenom:        { i18n: 'hh_firstname',           th: '<th style="min-width:90px;text-align:left;padding:3px 6px" data-i18n="hh_firstname">First name</th>',
                   cell: m => `<td style="padding:3px 6px">${escHtml(m.prenom)}</td>` },
  nom:           { i18n: 'hh_lastname',            th: '<th style="min-width:90px;text-align:left;padding:3px 6px" data-i18n="hh_lastname">Last name</th>',
                   cell: m => `<td style="padding:3px 6px">${escHtml(m.nom)}</td>` },
  age:           { i18n: 'hh_age',                 th: '<th style="min-width:44px;padding:3px 6px" data-i18n="hh_age">Age</th>',
                   cell: m => `<td style="padding:3px 6px;text-align:center">${escHtml(m.age)}</td>` },
  birth_date:    { i18n: 'hh_birthdate',           th: '<th style="min-width:82px;padding:3px 6px" data-i18n="hh_birthdate">Birth date</th>',
                   cell: m => `<td style="padding:3px 6px;text-align:center;white-space:nowrap">${escHtml(fmtDateNaiss(m.birth_date)) || '—'}</td>` },
  sexe:          { i18n: 'hh_gender',              th: '<th style="min-width:82px;padding:3px 6px" data-i18n="hh_gender">Gender</th>',
                   cell: m => `<td style="padding:3px 6px;text-align:center">${sexeIcone(m.sexe)} ${escHtml(SEXE_LBL[m.sexe] || m.sexe)}</td>` },
  birth_country: { i18n: 'hh_country_birth',       th: '<th style="min-width:110px;padding:3px 6px" data-i18n="hh_country_birth">Country birth</th>',
                   cell: m => `<td style="padding:3px 6px">${paysDrapeau(m.birth_country)}</td>` },
  birth_commune: { i18n: 'hh_municipality_birth',  th: '<th style="min-width:120px;text-align:left;padding:3px 6px" data-i18n="hh_municipality_birth">Municipality birth</th>',
                   cell: m => `<td style="padding:3px 6px">${escHtml(m.birth_commune) || '—'}</td>` },
  nationality:   { i18n: 'hh_nationality',         th: '<th style="min-width:110px;padding:3px 6px" data-i18n="hh_nationality">Nationality</th>',
                   cell: m => `<td style="padding:3px 6px">${paysDrapeau(m.nationality)}</td>` },
  marital_status:{ i18n: 'hh_marital',             th: '<th style="min-width:130px;text-align:left;padding:3px 6px" data-i18n="hh_marital">Marital status</th>',
                   cell: m => `<td style="padding:3px 6px">${m.marital_status ? (mrtlIcone(m.marital_status) + ' ' + escHtml(m.marital_status)) : '—'}</td>` },
};
const HH_COL_ALL = ['num', 'prenom', 'nom', 'age', 'birth_date', 'sexe', 'birth_country', 'birth_commune', 'nationality', 'marital_status'];

// Registres exposés au panneau générique (config = liste ordonnée {id, on}).
const PERSO = {
  kpi:   { defs: KPI_DEFS,     all: KPI_ALL,     onDef: KPI_ON_DEFAUT, key: 'statbel_conv_kpi',    hint: 'perso_hint',       apply: () => renderKPIs(_kpiCtx) },
  blocs: { defs: BLOC_DEFS,    all: BLOC_ALL,    onDef: BLOC_ON_DEFAUT, key: 'statbel_conv_blocs',  hint: 'perso_hint_blocs', apply: () => renderBlocsOrder() },
  cols:  { defs: COL_DEFS,     all: COL_ALL,     onDef: COL_ON_DEFAUT, key: 'statbel_conv_cols',   hint: 'perso_hint_cols',  sub: 'perso_sub_apercu',  apply: () => rerenderCibles() },
  hh:    { defs: HH_COL_DEFS,  all: HH_COL_ALL,  onDef: HH_COL_ALL,    key: 'statbel_conv_hhcols', hint: 'perso_hint_hh',    sub: 'perso_sub_menage',  apply: () => rerenderCibles() },
};

// Config générique (afficher/masquer + ordre), persistée par appareil.
function getCfg(kind) {
  const P = PERSO[kind];
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(P.key) || 'null'); } catch (e) { /* ignore */ }
  if (!Array.isArray(saved) || !saved.length) return P.all.map(id => ({ id, on: P.onDef.includes(id) }));
  const known = saved.filter(x => x && P.defs[x.id]).map(x => ({ id: x.id, on: !!x.on }));
  const seen = new Set(known.map(x => x.id));
  P.all.forEach(id => { if (!seen.has(id)) known.push({ id, on: P.onDef.includes(id) }); });   // futurs éléments → suivent le défaut
  return known;
}
function saveCfg(kind, cfg) { try { localStorage.setItem(PERSO[kind].key, JSON.stringify(cfg)); } catch (e) { /* ignore */ } }
function getKpiCfg() { return getCfg('kpi'); }   // conservé pour les tests
// Libellé d'un élément : dynamique (ex. « Cibles ≥16 ») si `dyn`, sinon traduit.
function persoLabel(def) { return def.dyn ? def.dyn() : t(def.i18n); }

// Rend les tuiles KPI activées, dans l'ordre configuré, depuis le contexte c.
function renderKPIs(c) {
  const grid = document.getElementById('kpiGrid');
  if (!grid) return;
  grid.innerHTML = getCfg('kpi').filter(x => x.on).map(({ id }) => {
    const d = KPI_DEFS[id];
    const v = c ? d.val(c) : '—';
    const tint = d.tint ? ` style="color:${d.tint}"` : '';
    // Titre (survol) éventuel — ex. formule/source de l'indemnité potentielle.
    const tip = (d.tip && c) ? ` title="${escHtml(d.tip(c))}"` : '';
    // Libellé dynamique (ex. « Cibles ≥16 ») → pas de data-i18n (re-rendu via
    // afficher() au changement de langue) ; sinon data-i18n traduit à la volée.
    const di18n = d.dyn ? '' : ` data-i18n="${d.i18n}"`;
    return `<div class="compteur" style="border-top-color:${d.color}"${tip}>`
      + `<div class="val"${tint}>${escHtml(String(v))}</div>`
      + `<div class="label"${di18n}>${escHtml(persoLabel(d))}</div></div>`;
  }).join('');
}

// Applique ordre + visibilité des blocs : réordonne les cartes, masque les autres.
function renderBlocsOrder() {
  const cont = document.getElementById('statsBlocks');
  if (!cont) return;
  getCfg('blocs').forEach(({ id, on }) => {
    const card = cont.querySelector(`[data-block="${id}"]`);
    if (!card) return;
    card.style.display = on ? '' : 'none';
    cont.appendChild(card);   // appendChild déplace en fin → réordonne dans l'ordre de la config
  });
}

// Injecte une croix ✕ (une fois) dans chaque carte de bloc → masquage direct à
// l'écran, équivalent à décocher le bloc dans Personnaliser (réversible).
function initBlocClose() {
  document.querySelectorAll('#statsBlocks .card[data-block]').forEach(card => {
    if (card.querySelector('.blk-x')) return;
    const id = card.getAttribute('data-block');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'blk-x';
    b.textContent = '✕';
    b.title = t('bloc_hide');
    b.setAttribute('aria-label', t('bloc_hide'));
    b.setAttribute('data-i18n-title', 'bloc_hide');   // titre + aria suivent le changement de langue
    b.setAttribute('data-i18n-aria', 'bloc_hide');
    b.setAttribute('onclick', `masquerBloc('${id}')`);
    card.appendChild(b);
  });
}

// Masque un bloc depuis sa croix ✕ : bascule sa config 'blocs' à off, persiste,
// réapplique l'ordre/visibilité, et rafraîchit le panneau s'il est ouvert.
function masquerBloc(id) {
  const cfg = getCfg('blocs');
  const it = cfg.find(x => x.id === id);
  if (!it || !it.on) return;
  it.on = false;
  saveCfg('blocs', cfg);
  renderBlocsOrder();
  if (document.getElementById('modalPerso').classList.contains('open') && _persoTab === 'blocs') renderPersoList();
}

// Panneau « Personnaliser l'affichage » — onglets KPI / Blocs / Colonnes.
// Un onglet regroupe un ou plusieurs registres (« kinds ») ; l'onglet Colonnes
// réunit les colonnes de l'Aperçu et celles du détail du ménage en sous-groupes.
const PERSO_GROUPS = { kpi: ['kpi'], blocs: ['blocs'], cols: ['cols', 'hh'] };
const PERSO_HINT   = { kpi: 'perso_hint', blocs: 'perso_hint_blocs', cols: 'perso_hint_cols_group' };
let _persoTab = 'kpi';
function ouvrirPerso() { persoTab(_persoTab); document.getElementById('modalPerso').classList.add('open'); }
function fermerPerso() { document.getElementById('modalPerso').classList.remove('open'); }
function persoTab(tab) {
  if (!PERSO_GROUPS[tab]) tab = 'kpi';
  _persoTab = tab;
  document.querySelectorAll('.perso-tab').forEach(b => b.classList.toggle('actif', b.dataset.ptab === tab));
  const h = document.getElementById('persoHint'); if (h) h.textContent = t(PERSO_HINT[tab]);
  renderPersoList();
}
function renderPersoList() {
  const kinds = PERSO_GROUPS[_persoTab] || [_persoTab];
  const grouped = kinds.length > 1;   // affiche un sous-titre par registre si l'onglet en regroupe plusieurs
  document.getElementById('persoList').innerHTML = kinds.map(kind => {
    const P = PERSO[kind], cfg = getCfg(kind);
    const rows = cfg.map((x, i) => {
      const lb = escHtml(persoLabel(P.defs[x.id]));
      return `<li class="${x.on ? '' : 'off'}">`
        + `<input type="checkbox" ${x.on ? 'checked' : ''} onchange="persoToggle('${kind}',${i})" aria-label="${lb}">`
        + `<span class="pl-lb">${lb}</span>`
        + `<span class="pl-mv"><button onclick="persoMove('${kind}',${i},-1)" ${i === 0 ? 'disabled' : ''} aria-label="${escHtml(t('pl_move_up'))}">↑</button>`
        + `<button onclick="persoMove('${kind}',${i},1)" ${i === cfg.length - 1 ? 'disabled' : ''} aria-label="${escHtml(t('pl_move_down'))}">↓</button></span></li>`;
    }).join('');
    return (grouped && P.sub ? `<li class="perso-sub">${escHtml(t(P.sub))}</li>` : '') + rows;
  }).join('');
}
function persoToggle(kind, i) { const cfg = getCfg(kind); if (!cfg[i]) return; cfg[i].on = !cfg[i].on; saveCfg(kind, cfg); renderPersoList(); PERSO[kind].apply(); }
function persoMove(kind, i, d) { const cfg = getCfg(kind); const j = i + d; if (j < 0 || j >= cfg.length) return; [cfg[i], cfg[j]] = [cfg[j], cfg[i]]; saveCfg(kind, cfg); renderPersoList(); PERSO[kind].apply(); }
// Réinitialise tous les registres de l'onglet courant (l'onglet Colonnes réinitialise Aperçu + Ménage).
function resetPerso() { (PERSO_GROUPS[_persoTab] || [_persoTab]).forEach(kind => { const P = PERSO[kind]; saveCfg(kind, P.all.map(id => ({ id, on: P.onDef.includes(id) }))); PERSO[kind].apply(); }); renderPersoList(); }

// (Re)calcule et affiche tous les graphiques selon la portée active :
//  - 'referent' : la personne de contact (FL_MB_CNTCT=1), 1 par ménage
//  - 'cible'    : tous les membres du ménage âgés d'au moins ageMinCible (LFS 15+)
//  - 'membres'  : ménage complet
function majStats(res) {
  let pop;
  if (statsScope === 'membres') pop = res.outMembres;
  else if (statsScope === 'cible') {
    const min = ageMinCible();
    pop = res.outMembres.filter(r => { const a = parseInt(r.age, 10); return !isNaN(a) && a >= min; });
  } else pop = res.outCibles;   // référent (FL=1)

  // KPI : on assemble un contexte de mesures, puis on rend les tuiles activées
  // dans l'ordre choisi (registre KPI_DEFS + config perso). Certaines mesures
  // dépendent du périmètre (pop, %H/F, âges), d'autres sont des propriétés du
  // ménage complet (nb ménages, taille moyenne, cibles ≥ âge min).
  const min = ageMinCible();
  const ages = pop.map(r => parseInt(r.age, 10)).filter(a => !isNaN(a));
  _kpiCtx = {
    popN:       pop.length,
    kM:         pop.filter(r => r.sexe === 'M').length,
    kF:         pop.filter(r => r.sexe === 'F').length,
    ageMoy:     ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null,
    ageMed:     median(ages),
    nEtr:       pop.filter(r => r.birth_country && r.birth_country !== 'BEL').length,
    // % mineurs : sur le MÉNAGE COMPLET, seuil = âge min de la cible (donc
    // « non interrogeables par l'âge »). Suit inpAgeMin, comme « Cibles ≥N ».
    nMin:       res.outMembres.filter(r => { const a = parseInt(r.age, 10); return !isNaN(a) && a < min; }).length,
    nbHH:       (res.outCibles || []).length,
    membres:    res.outMembres.length,
    nbCibles15: res.outMembres.filter(r => { const a = parseInt(r.age, 10); return !isNaN(a) && a >= min; }).length,
  };
  renderKPIs(_kpiCtx);
  renderBlocsOrder();   // applique l'ordre + la visibilité des blocs d'analyse

  // Blocs d'analyse : chaque bloc se décrit dans BLOC_DEFS (data+chart+drill, ou
  // render sur-mesure) et renderBloc aiguille vers la bonne primitive. Le contexte
  // partagé (population du périmètre + agrégateurs) est calculé une seule fois.
  const ctxBloc = {
    res, pop,
    sx: r => r.sexe === 'M' ? 'h' : r.sexe === 'F' ? 'f' : null,
    contOf: iso => continentNIS((PAYS_I18N[iso] || {}).nis || '') || 'Unknown',
    euOf: iso => !iso ? 'Unknown' : (EU_MEMBERS.has(iso) ? 'EU' : 'Non-EU'),
  };
  BLOC_ALL.forEach(id => renderBloc(id, ctxBloc));

  // « Personnes à interroger par ménage » + « Composition » : une seule passe
  // (dépend de l'âge min, indépendante de la portée d'affichage).
  majMenagesCartes();
}

// ════════════════════════════════════════════════════════════════════════
//  RÉGION — CHARTS · primitives de rendu (données préparées → SVG/HTML)
//  barres · barres empilées · pyramide · donut · 100 % · treemap · Sankey
//  Ne recalculent pas de données métier : ANALYTICS prépare, CHARTS dessine.
// ════════════════════════════════════════════════════════════════════════

// Gabarit commun des donuts de la lib partagée (Charts.donut) sur cette page :
// taille compacte et homogène avec les donuts locaux (renderDonut), pour éviter
// qu'un anneau ne prenne toute la largeur — donc toute la hauteur — sur mobile.
const DONUT_SIZE = 132, DONUT_THICK = 18;

// items : [{ label, count, title?, color? }]
function renderBarres(elId, items, defaultColor, clickFn) {
  const max = Math.max(1, ...items.map(i => i.count));
  document.getElementById(elId).innerHTML = items.map(i => {
    const clic = clickFn ? ` style="cursor:pointer" onclick="${clickFn}('${String(i.key != null ? i.key : i.label).replace(/['\\]/g, '')}')"` : '';
    return `
    <div class="bar-row"${clic} title="${escHtml((i.title || i.label) + ' : ' + i.count)}">
      <div class="bar-lbl">${escHtml(i.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(i.count / max * 100).toFixed(1)}%;background:${i.color || defaultColor}"></div></div>
      <div class="bar-val">${i.count}</div>
    </div>`;
  }).join('');
}

// Barres empilées par sexe — items : [{ label, h, f, title? }]
const COUL_H = 'var(--bar-h)';   // hommes (bleu)
const COUL_F = 'var(--bar-f)';   // femmes (rouge)
function renderBarresStack(elId, items, clickFn) {
  const max = Math.max(1, ...items.map(i => i.h + i.f));
  document.getElementById(elId).innerHTML = items.map(i => {
    const tot = i.h + i.f;
    const clic = clickFn ? ` style="cursor:pointer" onclick="${clickFn}('${String(i.key != null ? i.key : i.label).replace(/['\\]/g, '')}')"` : '';
    return `
    <div class="bar-row"${clic} title="${escHtml((i.title || i.label) + ' : ' + tot + ' (H ' + i.h + ' / F ' + i.f + ')')}">
      <div class="bar-lbl">${escHtml(i.label)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(i.h / max * 100).toFixed(1)}%;background:${COUL_H};border-radius:0"></div>
        <div class="bar-fill" style="width:${(i.f / max * 100).toFixed(1)}%;background:${COUL_F};border-radius:0"></div>
      </div>
      <div class="bar-val">${tot}</div>
    </div>`;
  }).join('');
}

// Pyramide des âges
function renderPyramide(elId, data) {
  const max  = Math.max(1, ...data.map(d => Math.max(d.h, d.f)));
  const totH = data.reduce((s, d) => s + d.h, 0);
  const totF = data.reduce((s, d) => s + d.f, 0);
  // De la tranche la plus âgée (haut) à la plus jeune (bas)
  const rows = data.slice().reverse().map(d => {
    const wh = (d.h / max * 100).toFixed(1);
    const wf = (d.f / max * 100).toFixed(1);
    const lblJS = String(d.lbl).replace(/['\\]/g, '');
    return `<div class="pyr-row" style="cursor:pointer" title="${escHtml(t('title_zoom_bracket'))}" onclick="zoomTranche(${d.min},${d.max},'${lblJS}')">
      <div class="pyr-left">
        <span class="pyr-cnt" style="text-align:right">${d.h || ''}</span>
        <div class="pyr-bar pyr-bar-h" style="width:${wh}%" title="${d.h} ${escHtml(tPlural('word_men_unit', d.h))}"></div>
      </div>
      <div class="pyr-lbl">${escHtml(d.lbl)}</div>
      <div class="pyr-right">
        <div class="pyr-bar pyr-bar-f" style="width:${wf}%" title="${d.f} ${escHtml(tPlural('word_women_unit', d.f))}"></div>
        <span class="pyr-cnt">${d.f || ''}</span>
      </div>
    </div>`;
  }).join('');
  document.getElementById(elId).innerHTML =
    `<div class="pyramide">
       <div class="pyr-head"><span class="h">${escHtml(tf('pyr_men_tpl', { n: totH }))}</span><span class="f">${escHtml(tf('pyr_women_tpl', { n: totF }))}</span></div>
       ${rows}
     </div>`;
}

// Palette catégorielle stable
const PALETTE = ['#1a237e', '#00897b', '#f9a825', '#6a1b9a', '#c62828', '#2e7d32', '#0277bd',
  '#ef6c00', '#5d4037', '#ad1457', '#558b2f', '#4527a0', '#00838f', '#9e9d24', '#d84315'];

// Donut (anneau) en SVG — items: [{ label, value, color?, key? }] ; total au centre + légende ; clickFn optionnel
function renderDonut(elId, items, clickFn) {
  const el = document.getElementById(elId);
  const data = items.filter(i => i.value > 0);
  const total = data.reduce((s, i) => s + i.value, 0);
  if (!total) { el.innerHTML = '<div style="color:var(--text2);font-size:12px">—</div>'; return; }
  const onc = it => clickFn ? ` onclick="${clickFn}('${String(it.key != null ? it.key : it.label).replace(/['\\]/g, '')}')"` : '';
  const cur = clickFn ? 'cursor:pointer;' : '';
  let cum = 0, segs = '';
  data.forEach((it, k) => {
    const pct = it.value / total * 100, col = it.color || PALETTE[k % PALETTE.length];
    segs += `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${col}" stroke-width="6" style="${cur}"`
      + ` stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${(25 - cum).toFixed(2)}"${onc(it)}>`
      + `<title>${escHtml(it.label)} : ${it.value} (${pct.toFixed(0)}%)</title></circle>`;
    cum += pct;
  });
  const leg = data.map((it, k) => {
    const pct = it.value / total * 100, col = it.color || PALETTE[k % PALETTE.length];
    return `<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0;${cur}"${onc(it)}>`
      + `<span style="width:11px;height:11px;border-radius:2px;background:${col};display:inline-block"></span>`
      + `${escHtml(it.label)} — <b>${it.value}</b> (${pct.toFixed(0)}%)</div>`;
  }).join('');
  el.innerHTML = `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">`
    + `<svg viewBox="0 0 42 42" style="width:118px;height:118px;flex:none" role="img" aria-label="${escHtml(tf('aria_donut',{n:total}))}">${segs}`
    + `<text x="21" y="20" text-anchor="middle" font-size="6" font-weight="bold" fill="var(--text)">${total}</text>`
    + `<text x="21" y="26" text-anchor="middle" font-size="2.6" fill="var(--text2)">total</text></svg>`
    + `<div>${leg}</div></div>`;
}

// Barres 100 % (part de chaque catégorie sur le total) — items: [{ label, value, color? }]
function renderBarres100(elId, items, clickFn) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  document.getElementById(elId).innerHTML = items.map((i, k) => {
    const pct = i.value / total * 100, col = i.color || PALETTE[k % PALETTE.length];
    const clic = clickFn ? ` style="cursor:pointer" onclick="${clickFn}('${String(i.key != null ? i.key : i.label).replace(/['\\]/g, '')}')"` : '';
    return `<div class="bar-row"${clic} title="${escHtml(i.label)} : ${i.value} (${pct.toFixed(1)}%)">`
      + `<div class="bar-lbl">${escHtml(i.label)}</div>`
      + `<div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${col}"></div></div>`
      + `<div class="bar-val">${pct.toFixed(0)}%</div></div>`;
  }).join('');
}

// Treemap (squarified) en SVG — items: [{ label, value }]
// Encre lisible sur une tuile de couleur : blanc sur fond foncé, encre foncée sur
// fond clair (ex. ambre #f9a825 où le blanc échouait le contraste AA).
function inkOn(hex) {
  const c = String(hex).replace('#', '');
  if (c.length < 6) return '#fff';
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;   // luminance approx (0–255)
  return L > 150 ? '#1a1a1a' : '#fff';
}
function renderTreemapNlty(elId, items) {
  const el = document.getElementById(elId);
  if (!items.length) { el.innerHTML = '<div style="color:var(--text2);font-size:12px">—</div>'; return; }
  const W = 100, H = 56;                  // viewBox (ratio large) ; le SVG est responsive
  const total = items.length;
  const data = items.slice();             // déjà triés desc
  const somme = data.reduce((s, d) => s + d.value, 0);
  // squarify
  const rects = [];
  let x = 0, y = 0, w = W, h = H, i = 0;
  const aire = v => v / somme * (W * H);
  while (i < data.length) {
    const libre = Math.min(w, h);
    let row = [], best = Infinity, rowSum = 0;
    let j = i;
    while (j < data.length) {
      const test = row.concat(data[j]);
      const ts = rowSum + data[j].value;
      const areas = test.map(d => aire(d.value));
      const max = Math.max(...areas), min = Math.min(...areas);
      const s2 = ts ? aire(ts) : 0;
      const cote = s2 / libre;
      const ratio = Math.max((libre * libre * max) / (s2 * s2 || 1), (s2 * s2) / (libre * libre * min || 1));
      if (ratio <= best) { best = ratio; row = test; rowSum = ts; j++; } else break;
    }
    // place la rangée
    const rowArea = aire(rowSum), cote = rowArea / libre;
    let off = 0;
    const horizontal = (w >= h);
    row.forEach(d => {
      const a = aire(d.value), len = a / cote;
      if (horizontal) rects.push({ x, y: y + off, w: cote, h: len, d });
      else rects.push({ x: x + off, y, w: len, h: cote, d });
      off += len;
    });
    if (horizontal) { x += cote; w -= cote; } else { y += cote; h -= cote; }
    i = j;
  }
  const svg = rects.map((r) => {
    const col = PALETTE[data.indexOf(r.d) % PALETTE.length];
    const ink = inkOn(col);
    const inkStroke = ink === '#fff' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)';
    const cx = (r.x + r.w / 2).toFixed(2), cy = r.y + r.h / 2;
    const name = String(r.d.label), val = '(' + r.d.value + ')';
    // police adaptée à la tuile ; largeur de texte estimée ≈ 0,5·fs·nbCar
    const fs = Math.max(1.1, Math.min(2.1, Math.min(r.h * 0.3, r.w * 1.4 / Math.max(name.length, 4))));
    const fitName = (name.length * fs * 0.5) <= r.w * 0.92 && r.h >= fs * 2.3;     // nom + effectif (2 lignes)
    let txt = '';
    if (fitName) {
      txt = `<text x="${cx}" y="${(cy - fs * 0.45).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="${fs.toFixed(2)}">${escHtml(name)}</text>`
        + `<text x="${cx}" y="${(cy + fs * 0.75).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="${(fs * 0.85).toFixed(2)}" opacity="0.9">${escHtml(val)}</text>`;
    } else {
      // tuile trop petite : on force au moins l'effectif (léger débordement accepté), police >= 1
      const num = '' + r.d.value;
      const fsv = Math.max(1, Math.min(fs, r.w * 1.7 / num.length));
      txt = `<text x="${cx}" y="${cy.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="${fsv.toFixed(2)}" style="paint-order:stroke" stroke="${inkStroke}" stroke-width="0.15">${escHtml(num)}</text>`;
    }
    return `<g><rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" fill="${col}" stroke="#fff" stroke-width="0.4"><title>${escHtml(name)} : ${r.d.value}</title></rect>${txt}</g>`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" font-family="inherit" role="img" aria-label="${escHtml(t('aria_treemap'))}">${svg}</svg>`;
}

// Sankey Nationalité → Sexe → Âge (SVG). pop : enregistrements { nationality, sexe, age }
// Hauteur commune (viewBox) des deux diagrammes de Sankey, pour un rendu de même taille.
const SANKEY_H = 55;
function renderSankeyNSA(elId, pop) {
  const el = document.getElementById(elId);
  const sexLbl = s => s === 'M' ? 'Hommes' : s === 'F' ? 'Femmes' : 'Autre';
  const ageLbl = a => { const t = TRANCHES_AGE.find(([mn, mx]) => a >= mn && a <= mx); return t ? t[2] : '?'; };
  // top 8 nationalités + « Autres »
  const cnt = {};
  pop.forEach(r => { const n = paysNom(r.nationality) || r.nationality || '—'; cnt[n] = (cnt[n] || 0) + 1; });
  const topN = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  const natOf = r => { const n = paysNom(r.nationality) || r.nationality || '—'; return topN.includes(n) ? n : 'Autres'; };
  // flux niveau 1 (nat→sexe) et niveau 2 (sexe→âge)
  const f1 = {}, f2 = {}, colA = {}, colB = {}, colC = {};
  pop.forEach(r => {
    const a = parseInt(r.age); if (isNaN(a) || !r.sexe) return;
    const N = natOf(r), S = sexLbl(r.sexe), A = ageLbl(a);
    f1[N + '|' + S] = (f1[N + '|' + S] || 0) + 1;
    f2[S + '|' + A] = (f2[S + '|' + A] || 0) + 1;
    colA[N] = (colA[N] || 0) + 1; colB[S] = (colB[S] || 0) + 1; colC[A] = (colC[A] || 0) + 1;
  });
  if (!Object.keys(colA).length) { el.innerHTML = '<div style="color:var(--text2);font-size:12px">—</div>'; return; }
  const ordreNat = Object.keys(colA).sort((a, b) => (a === 'Autres') - (b === 'Autres') || colA[b] - colA[a]);
  const ordreSex = ['Hommes', 'Femmes', 'Autre'].filter(s => colB[s]);
  const ordreAge = TRANCHES_AGE.map(t => t[2]).filter(a => colC[a]);
  const W = 100, H = SANKEY_H, GAP = 1.4, NW = 3.2;
  const colX = [2, W / 2 - NW / 2, W - 2 - NW];
  // positions Y des nœuds d'une colonne (empilés, proportionnels)
  const layout = (ordre, counts, totalPop) => {
    const tot = ordre.reduce((s, k) => s + counts[k], 0) || 1;
    const usable = H - (ordre.length - 1) * GAP;
    let y = 0; const pos = {};
    ordre.forEach(k => { const hh = counts[k] / tot * usable; pos[k] = { y, h: hh, count: counts[k] }; y += hh + GAP; });
    return pos;
  };
  const pa = layout(ordreNat, colA), pb = layout(ordreSex, colB), pc = layout(ordreAge, colC);
  const colIdx = {}; ordreNat.forEach((k, i) => colIdx[k] = i);
  // rubans : on consomme la hauteur de chaque nœud au fur et à mesure
  const usedA = {}, usedB_in = {}, usedB_out = {}, usedC = {};
  const ruban = (x1, y1, x2, y2, ht, col) => {
    const xm = (x1 + x2) / 2;
    return `<path d="M${x1},${y1} C${xm},${y1} ${xm},${y2} ${x2},${y2} L${x2},${y2 + ht} C${xm},${y2 + ht} ${xm},${y1 + ht} ${x1},${y1 + ht} Z" fill="${col}" fill-opacity="0.35"/>`;
  };
  let flows = '';
  // niveau 1 : nat (droite de colA) → sexe (gauche de colB)
  ordreNat.forEach(N => ordreSex.forEach(S => {
    const v = f1[N + '|' + S]; if (!v) return;
    const ht = v / (pa[N].count || 1) * pa[N].h;
    const y1 = pa[N].y + (usedA[N] || 0); usedA[N] = (usedA[N] || 0) + ht;
    const ht2 = v / (pb[S].count || 1) * pb[S].h;
    const y2 = pb[S].y + (usedB_in[S] || 0); usedB_in[S] = (usedB_in[S] || 0) + ht2;
    flows += ruban(colX[0] + NW, y1, colX[1], y2, ht, PALETTE[colIdx[N] % PALETTE.length]);
  }));
  // niveau 2 : sexe (droite de colB) → âge (gauche de colC)
  ordreSex.forEach(S => ordreAge.forEach(A => {
    const v = f2[S + '|' + A]; if (!v) return;
    const ht = v / (pb[S].count || 1) * pb[S].h;
    const y1 = pb[S].y + (usedB_out[S] || 0); usedB_out[S] = (usedB_out[S] || 0) + ht;
    const ht2 = v / (pc[A].count || 1) * pc[A].h;
    const y2 = pc[A].y + (usedC[A] || 0); usedC[A] = (usedC[A] || 0) + ht2;
    flows += ruban(colX[1] + NW, y1, colX[2], y2, ht, S === 'Femmes' ? 'var(--bar-f)' : 'var(--bar-h)');
  }));
  // nœuds + libellés
  const noeuds = (ordre, pos, x, ancre, coul) => ordre.map((k, i) => {
    const p = pos[k]; const c = coul ? coul(k, i) : PALETTE[i % PALETTE.length];
    const tx = ancre === 'end' ? x - 0.6 : (ancre === 'start' ? x + NW + 0.6 : x + NW / 2);
    return `<rect x="${x}" y="${p.y.toFixed(2)}" width="${NW}" height="${Math.max(0.4, p.h).toFixed(2)}" fill="${c}"><title>${escHtml(k)} : ${p.count}</title></rect>`
      + `<text x="${tx.toFixed(2)}" y="${(p.y + p.h / 2).toFixed(2)}" text-anchor="${ancre}" dominant-baseline="middle" font-size="2.1" fill="var(--text)">${escHtml(k)}</text>`;
  }).join('');
  const nodesA = noeuds(ordreNat, pa, colX[0], 'start', (k, i) => PALETTE[i % PALETTE.length]);
  const nodesB = noeuds(ordreSex, pb, colX[1], 'middle', k => k === 'Femmes' ? 'var(--bar-f)' : 'var(--bar-h)');
  const nodesC = noeuds(ordreAge, pc, colX[2], 'end', () => '#90a4ae');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" font-family="inherit" role="img" aria-label="${escHtml(t('aria_sankey_nat'))}">${flows}${nodesA}${nodesB}${nodesC}</svg>`;
}

// Sankey ménages : taille du ménage → nombre de personnes à interroger (≥ âge min)
// → tranche d'âge dominante du ménage. Une unité de flux = un ménage.
function renderSankeyMenage(elId, res) {
  const el = document.getElementById(elId);
  if (!el) return;
  const min = ageMinCible();
  const BR = [[0, 14, '0–14'], [15, 24, '15–24'], [25, 54, '25–54'], [55, 64, '55–64'], [65, 999, '65+']];
  const brOf = a => { const t = BR.find(([lo, hi]) => a >= lo && a <= hi); return t ? t[2] : null; };
  const hh = {};
  (res.outMembres || []).forEach(r => {
    const h = hh[r.nr_hh] || (hh[r.nr_hh] = { total: 0, cibles: 0, br: {} });
    h.total++;
    const a = parseInt(r.age, 10);
    if (!isNaN(a)) { if (a >= min) h.cibles++; const b = brOf(a); if (b) h.br[b] = (h.br[b] || 0) + 1; }
  });
  const menages = Object.values(hh).filter(h => h.total > 0);
  if (!menages.length) { el.innerHTML = '<div style="color:var(--text2);font-size:12px">—</div>'; return; }
  const sizeLbl = n => (n >= 5 ? '5+' : String(n)) + ' p.';
  const cibLbl  = n => (n >= 3 ? '3+' : String(n)) + ' ≥' + min;
  const domBr = h => { let best = '?', bv = 0; BR.forEach(([, , lbl]) => { const v = h.br[lbl] || 0; if (v > bv) { bv = v; best = lbl; } }); return best; };
  const f1 = {}, f2 = {}, colA = {}, colB = {}, colC = {};
  menages.forEach(h => {
    const A = sizeLbl(h.total), B = cibLbl(h.cibles), C = domBr(h);
    f1[A + '|' + B] = (f1[A + '|' + B] || 0) + 1;
    f2[B + '|' + C] = (f2[B + '|' + C] || 0) + 1;
    colA[A] = (colA[A] || 0) + 1; colB[B] = (colB[B] || 0) + 1; colC[C] = (colC[C] || 0) + 1;
  });
  const ordreA = ['1', '2', '3', '4', '5+'].map(n => n + ' p.').filter(k => colA[k]);
  const ordreB = ['0', '1', '2', '3+'].map(n => n + ' ≥' + min).filter(k => colB[k]);
  const ordreC = BR.map(b => b[2]).filter(k => colC[k]);
  const W = 100, H = SANKEY_H, GAP = 1.4, NW = 3.2;
  const colX = [2, W / 2 - NW / 2, W - 2 - NW];
  const layout = (ordre, counts) => {
    const tot = ordre.reduce((s, k) => s + counts[k], 0) || 1;
    const usable = H - (ordre.length - 1) * GAP;
    let y = 0; const pos = {};
    ordre.forEach(k => { const ht = counts[k] / tot * usable; pos[k] = { y, h: ht, count: counts[k] }; y += ht + GAP; });
    return pos;
  };
  const pa = layout(ordreA, colA), pb = layout(ordreB, colB), pc = layout(ordreC, colC);
  const idxA = {}; ordreA.forEach((k, i) => idxA[k] = i);
  const idxB = {}; ordreB.forEach((k, i) => idxB[k] = i);
  const usedA = {}, usedBin = {}, usedBout = {}, usedC = {};
  const ruban = (x1, y1, x2, y2, ht, col) => {
    const xm = (x1 + x2) / 2;
    return `<path d="M${x1},${y1} C${xm},${y1} ${xm},${y2} ${x2},${y2} L${x2},${y2 + ht} C${xm},${y2 + ht} ${xm},${y1 + ht} ${x1},${y1 + ht} Z" fill="${col}" fill-opacity="0.35"/>`;
  };
  let flows = '';
  ordreA.forEach(A => ordreB.forEach(B => {
    const v = f1[A + '|' + B]; if (!v) return;
    const ht = v / (pa[A].count || 1) * pa[A].h;
    const y1 = pa[A].y + (usedA[A] || 0); usedA[A] = (usedA[A] || 0) + ht;
    const ht2 = v / (pb[B].count || 1) * pb[B].h;
    const y2 = pb[B].y + (usedBin[B] || 0); usedBin[B] = (usedBin[B] || 0) + ht2;
    flows += ruban(colX[0] + NW, y1, colX[1], y2, ht, PALETTE[idxA[A] % PALETTE.length]);
  }));
  ordreB.forEach(B => ordreC.forEach(C => {
    const v = f2[B + '|' + C]; if (!v) return;
    const ht = v / (pb[B].count || 1) * pb[B].h;
    const y1 = pb[B].y + (usedBout[B] || 0); usedBout[B] = (usedBout[B] || 0) + ht;
    const ht2 = v / (pc[C].count || 1) * pc[C].h;
    const y2 = pc[C].y + (usedC[C] || 0); usedC[C] = (usedC[C] || 0) + ht2;
    flows += ruban(colX[1] + NW, y1, colX[2], y2, ht, PALETTE[idxB[B] % PALETTE.length]);
  }));
  const noeuds = (ordre, pos, x, ancre, coul) => ordre.map((k, i) => {
    const p = pos[k]; const c = coul(k, i);
    const tx = ancre === 'end' ? x - 0.6 : (ancre === 'start' ? x + NW + 0.6 : x + NW / 2);
    return `<rect x="${x}" y="${p.y.toFixed(2)}" width="${NW}" height="${Math.max(0.4, p.h).toFixed(2)}" fill="${c}"><title>${escHtml(k)} : ${p.count}</title></rect>`
      + `<text x="${tx.toFixed(2)}" y="${(p.y + p.h / 2).toFixed(2)}" text-anchor="${ancre}" dominant-baseline="middle" font-size="2.1" fill="var(--text)">${escHtml(k)}</text>`;
  }).join('');
  const nodesA = noeuds(ordreA, pa, colX[0], 'start', (k, i) => PALETTE[i % PALETTE.length]);
  const nodesB = noeuds(ordreB, pb, colX[1], 'middle', (k, i) => PALETTE[i % PALETTE.length]);
  const nodesC = noeuds(ordreC, pc, colX[2], 'end', () => '#90a4ae');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" font-family="inherit" role="img" aria-label="${escHtml(t('aria_sankey_hh'))}">${flows}${nodesA}${nodesB}${nodesC}</svg>`;
}

// ── Drill-down commune de naissance (Belges) : Région → Province → Arr. → Commune ──
let _birthPopBE = [];
let _birthDrill = { level: 'region', region: '', province: '', district: '' };
const BIRTH_FIELD = { region: 'birth_region', province: 'birth_province', district: 'birth_district', commune: 'birth_commune' };

function birthDrillInto(value) {
  const d = _birthDrill;
  if (d.level === 'region')   { d.region = value;   d.level = 'province'; }
  else if (d.level === 'province') { d.province = value; d.level = 'district'; }
  else if (d.level === 'district') { d.district = value; d.level = 'commune'; }
  else return;
  renderBirthDrill();
}
function birthDrillTo(level) {
  const d = _birthDrill;
  if (level === 'region')   { d.region = d.province = d.district = ''; }
  else if (level === 'province') { d.province = d.district = ''; }
  else if (level === 'district') { d.district = ''; }
  d.level = level;
  renderBirthDrill();
}

function renderBirthDrill() {
  const el = document.getElementById('statsCommune');
  if (!el) return;
  const d = _birthDrill;
  const pop = _birthPopBE.filter(r =>
    (!d.region   || r.birth_region   === d.region) &&
    (!d.province || r.birth_province === d.province) &&
    (!d.district || r.birth_district === d.district));

  // Fil d'Ariane (chaque segment clique pour revenir à ce niveau)
  const crumbs = [`<span class="bd-crumb" onclick="birthDrillTo('region')">🇧🇪 Belgium</span>`];
  if (d.region)   crumbs.push(`<span class="bd-crumb" onclick="birthDrillTo('province')">${escHtml(d.region)}</span>`);
  if (d.province) crumbs.push(`<span class="bd-crumb" onclick="birthDrillTo('district')">${escHtml(d.province)}</span>`);
  if (d.district) crumbs.push(`<span class="bd-crumb" onclick="birthDrillTo('commune')">${escHtml(d.district)}</span>`);
  const crumbsHtml = `<div class="bd-crumbs">${crumbs.join(' <span style="color:#bbb">›</span> ')}</div>`;

  if (!pop.length) { el.innerHTML = crumbsHtml + '<div style="font-size:11px;color:var(--text3);padding:6px 0">Nobody born in Belgium in this scope.</div>'; return; }

  // Regroupement au niveau courant, ventilé par sexe
  const field = BIRTH_FIELD[d.level];
  const g = {};
  pop.forEach(r => {
    const k = r[field] || '—';
    (g[k] = g[k] || { h: 0, f: 0 });
    const s = r.sexe === 'M' ? 'h' : r.sexe === 'F' ? 'f' : null;
    if (s) g[k][s]++;
  });
  const items = Object.entries(g).sort((a, b) => (b[1].h + b[1].f) - (a[1].h + a[1].f));
  const leaf = d.level === 'commune';
  const max = Math.max(1, ...items.map(([, v]) => v.h + v.f));

  const bars = items.map(([label, v]) => {
    const tot = v.h + v.f;
    const esc = String(label).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const clic = leaf ? '' : ` onclick="birthDrillInto('${esc}')"`;
    return `<div class="bar-row${leaf ? '' : ' bd-clic'}"${clic} title="${escHtml(label + ' : ' + tot + ' (H ' + v.h + ' / F ' + v.f + ')')}">
      <div class="bar-lbl">${escHtml(label)}${leaf ? '' : ' <span style="color:var(--accent)">▸</span>'}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(v.h / max * 100).toFixed(1)}%;background:${COUL_H};border-radius:0"></div>
        <div class="bar-fill" style="width:${(v.f / max * 100).toFixed(1)}%;background:${COUL_F};border-radius:0"></div>
      </div>
      <div class="bar-val">${tot}</div>
    </div>`;
  }).join('');

  el.innerHTML = crumbsHtml + bars;
}

// ════════════════════════════════════════════════════════════════════════
//  RÉGION — TABLES · table Aperçu / ménage (rendu, tri, accordéon ménage)
//  Registres de colonnes COL_DEFS/HH_COL_DEFS : voir PERSONNALISATION (PERSO s'en sert).
// ════════════════════════════════════════════════════════════════════════

let _sortState = { cibles: { col: null, dir: 1 }, membres: { col: null, dir: 1 } };

// En-tête du tableau de contacts : colonne d'expansion (fixe) + colonnes activées,
// dans l'ordre configuré. Réapplique l'indicateur de tri courant.
function renderCiblesHead() {
  const tr = document.querySelector('#tableCibles thead tr');
  if (!tr) return;
  const ths = getCfg('cols').filter(x => x.on).map(({ id }) => COL_DEFS[id].th).join('');
  tr.innerHTML = '<th style="width:22px"></th>' + ths;
  const st = _sortState.cibles;
  if (st && st.col) {
    const t = tr.querySelector(`th.sortable[data-col="${st.col}"]`);
    if (t) { t.classList.add(st.dir === 1 ? 'asc' : 'desc'); t.setAttribute('aria-sort', st.dir === 1 ? 'ascending' : 'descending'); }
  }
}
// Re-rend le tableau de contacts avec le tri courant (après changement de colonnes).
function rerenderCibles() {
  if (!_resultat) { renderCiblesHead(); return; }
  const st = _sortState.cibles;
  renderCibles(st && st.col ? sortRows(_resultat.outCibles, st.col, st.dir) : _resultat.outCibles);
}

// Valeur de tri par colonne : par défaut le champ brut (data-col), sauf pour les
// colonnes pays où l'on trie sur le NOM affiché (traduit) plutôt que sur le code ISO3.
const SORT_ACCESSOR = {
  birth_country: r => paysNom(r.birth_country) || '',
  nationality:   r => paysNom(r.nationality)   || '',
};
function sortRows(rows, col, dir) {
  const acc = SORT_ACCESSOR[col] || (r => r[col]);
  return [...rows].sort((a, b) => {
    const va = acc(a) || ''; const vb = acc(b) || '';
    // Numérique si les deux valeurs sont des nombres (âge, taille ménage, ID web…)
    const na = parseFloat(va); const nb = parseFloat(vb);   // parseFloat('') = NaN → non numérique
    if (!isNaN(na) && !isNaN(nb)) return dir * (na - nb);
    return dir * String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' });
  });
}

function renderCibles(rows) {
  renderCiblesHead();   // colonnes activées + ordre + indicateur de tri

  // Membres regroupés par ménage (pour l'accordéon)
  const parHh = {};
  (_resultat && _resultat.outMembres || []).forEach(m => {
    (parHh[m.nr_hh] = parHh[m.nr_hh] || []).push(m);
  });

  // Colonnes activées, dans l'ordre choisi (colonne d'expansion ▸ en plus → +1)
  const colsOn = getCfg('cols').filter(x => x.on).map(x => x.id);
  const colspan = 1 + colsOn.length;

  document.getElementById('bodyCibles').innerHTML = rows.map((r, i) => {
    // Tout le ménage (cible incluse), trié par numéro de membre
    const menage = (parHh[r.ordre] || []).slice()
      .sort((a, b) => Number(a.nr_membre) - Number(b.nr_membre));

    const cellules = colsOn.map(id => COL_DEFS[id].cell(r)).join('');
    const ligne = `
    <tr class="cible-row" onclick="toggleMenage(${i})" style="cursor:pointer">
      <td style="text-align:center;color:var(--accent);font-weight:bold"><span id="tg-${i}">▸</span></td>
      ${cellules}
    </tr>`;

    const hhCols = getCfg('hh').filter(x => x.on).map(x => x.id);
    const hhHead = hhCols.map(id => HH_COL_DEFS[id].th).join('');
    const sousLigne = `
    <tr id="men-${i}" style="display:none">
      <td colspan="${colspan}" style="padding:0;background:var(--card2)">
        <div style="padding:8px 12px">
          <div style="font-size:11px;color:var(--text2);margin-bottom:5px">👥 Household (${menage.length})</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr style="color:var(--accent)">${hhHead}</tr></thead>
            <tbody>
              ${menage.map(m => `<tr${m.fl_cntct === '1' ? ' style="font-weight:bold;background:var(--hover)"' : ''}>${hhCols.map(id => HH_COL_DEFS[id].cell(m)).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      </td>
    </tr>`;

    return ligne + sousLigne;
  }).join('');
}

// Événements de tri sur les en-têtes
document.addEventListener('click', e => {
  const th = e.target.closest('th.sortable');
  if (!th) return;
  if (!_resultat) return;   // pas de données importées → rien à trier
  const col   = th.dataset.col;
  const table = th.dataset.table;
  const state = _sortState[table];

  // Direction : même colonne → inverser, sinon → ascendant
  if (state.col === col) state.dir *= -1;
  else { state.col = col; state.dir = 1; }

  // Réinitialiser les classes
  th.closest('thead').querySelectorAll('th.sortable').forEach(t => {
    t.classList.remove('asc','desc'); t.setAttribute('aria-sort','none');
  });
  th.classList.add(state.dir === 1 ? 'asc' : 'desc');
  th.setAttribute('aria-sort', state.dir === 1 ? 'ascending' : 'descending');

  // Trier et re-rendre les cibles (l'accordéon ménage se reconstruit)
  renderCibles(sortRows(_resultat.outCibles, col, state.dir));
});
