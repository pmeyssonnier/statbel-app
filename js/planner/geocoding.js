/*
 * js/planner/geocoding.js — Planner : geocodage hierarchique (province->commune->
 * quartier), carte Leaflet des groupes, et gestion des plannings importes (onglet Planning :
 * import LFS GRP_APPEL, tableau groupe, marqueurs). Extrait verbatim du <script> du Planner
 * (statbel_planner.html) pour la lisibilite. Script CLASSIQUE : depend des globales definies
 * avant lui (esc, t, allRows...) et expose ses propres fonctions/globales (fonctionne en file://).
 * Charge APRES le coeur agenda et AVANT la candidature — l'ordre est preserve.
 */
// ══════════════════════════════════════════════════════════════════════
//  ONGLET PLANNING LFS — déplacé du Convertisseur (import + gestion + carte +
//  vérificateur d'adresse). Écrit localStorage['plannings'] avec l'index « grp »
//  → le Convertisseur garde le lien GRP_2026xxxxx ↔ LFS_IESS_GRP_APPEL.
//  Textes traduits via t()/tf() (fr/nl/en/de) — voir « RÉGION — I18N ».
// ══════════════════════════════════════════════════════════════════════

const sansAccent = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const PROV_REGION = {
  BRU: 'bruxelles',
  BWA: 'wallonie', HAI: 'wallonie', LIE: 'wallonie', LUX: 'wallonie', NAM: 'wallonie',
  ANT: 'flandre', LIM: 'flandre', OVL: 'flandre', VBR: 'flandre', WVL: 'flandre',
};
const PLAN_COLS = [
  { label: 'Group' }, { label: 'Commune' }, { label: 'Quartier' },
  { label: 'Wave', num: true }, { label: 'Week', num: true }, { label: 'Start' }, { label: 'Stop' },
];
let _planRows = [];          // une ligne par mission/interrogation (planning actif)
let _planMap = null, _planLayer = null, _planInit = false;
let _geoCache = {};
try { _geoCache = JSON.parse(localStorage.getItem('planGeoCacheV27') || '{}'); } catch (e) { _geoCache = {}; }
try { localStorage.removeItem('planGeoCache'); try{localStorage.removeItem('planGeoCacheV2');localStorage.removeItem('planGeoCacheV3');localStorage.removeItem('planGeoCacheV4');localStorage.removeItem('planGeoCacheV5');localStorage.removeItem('planGeoCacheV6');localStorage.removeItem('planGeoCacheV7');localStorage.removeItem('planGeoCacheV8');localStorage.removeItem('planGeoCacheV9');localStorage.removeItem('planGeoCacheV10');localStorage.removeItem('planGeoCacheV11');localStorage.removeItem('planGeoCacheV12');localStorage.removeItem('planGeoCacheV13');localStorage.removeItem('planGeoCacheV14');localStorage.removeItem('planGeoCacheV15');localStorage.removeItem('planGeoCacheV16');localStorage.removeItem('planGeoCacheV17');localStorage.removeItem('planGeoCacheV18');localStorage.removeItem('planGeoCacheV19');localStorage.removeItem('planGeoCacheV20');localStorage.removeItem('planGeoCacheV21');localStorage.removeItem('planGeoCacheV22');localStorage.removeItem('planGeoCacheV23');localStorage.removeItem('planGeoCacheV24');localStorage.removeItem('planGeoCacheV25');localStorage.removeItem('planGeoCacheV26')}catch(e){} } catch (e) {}   // purge ancien cache (géocodage moins précis)

function parseDateFR(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

// Région de géocodage d'une commune — version allégée (Planner) : le code province
// LFS suffit (PROV_REGION) ; repli nom-Bruxelles via BRU_CENTROIDS ; sinon Nominatim.
function regionPourCommune(commune, prov) {
  if (PROV_REGION[prov]) return PROV_REGION[prov];
  const noms = String(commune || '').split('/').map(x => sansAccent(x.trim())).filter(Boolean);
  for (const n of noms) if (BRU_CENTROIDS[n]) return 'bruxelles';
  return 'osm';
}

// ── Registre des plannings : uniquement les plannings importés (persistés) ──
let _plannings = {}, _planActif = '';

function chargerRegistrePlannings() {
  _plannings = {};
  let imp = [];
  try { imp = JSON.parse(localStorage.getItem('plannings') || '[]'); } catch (e) { imp = []; }
  imp.forEach(p => { if (p && p.id) _plannings[p.id] = p; });
  // Garder l'agrégat « Tout » (__ALL__) tel quel ; sinon retomber sur le 1er planning.
  if (_planActif !== '__ALL__' && !_plannings[_planActif]) _planActif = Object.keys(_plannings)[0] || '';
}

function sauverPlanningsImportes() {
  try { localStorage.setItem('plannings', JSON.stringify(Object.values(_plannings))); } catch (e) {}
}

// Le sélecteur dédié #planSelect a été retiré (le sélecteur du header pilote tout).
// Fonction conservée en no-op pour les appelants historiques (import/rename/delete).
function remplirSelecteurPlanning() {
  const el = document.getElementById('planSelect');
  if (!el) return;
  const vals = Object.values(_plannings);
  el.innerHTML = vals.length
    ? vals.map(p => `<option value="${p.id}"${p.id === _planActif ? ' selected' : ''}>${esc(p.nom)}</option>`).join('')
    : `<option value="">${esc('(aucun planning — importez-en un)')}</option>`;
}

// Construit _planRows depuis le trimestre actif (ou l'agrégat « Tout ») + (re)remplit province/commune.
function appliquerPlanningActif() {
  const tout = _planActif === '__ALL__';
  const actif = (!tout && _plannings[_planActif]) ? _plannings[_planActif] : null;
  const plans = tout ? Object.values(_plannings) : (actif ? [actif] : []);
  // Renommer / Supprimer : seulement sur un trimestre unique réel (masqués si « Tout » ou aucun).
  document.getElementById('planDelBtn').style.display = actif ? '' : 'none';
  document.getElementById('planRenBtn').style.display = actif ? '' : 'none';
  if (!plans.length) {
    _planRows = [];
    document.getElementById('planProvince').innerHTML = `<option value="">${esc(t('pl_all_provinces'))}</option>`;
    majCommunesPlan();
    return;
  }
  _planRows = plans.flatMap(pl => pl.rows || []).map(r => ({
    code: r.code || '', prov: r.prov || '', commune: r.commune || '',
    communeFR: r.communeFR || (r.commune || '').split('/')[0].trim(),
    quartier: r.quartier || '', wave: r.wave || '', sem: r.sem || '',
    start: r.start || '', stop: r.stop || '',
    region: regionPourCommune(r.commune, r.prov), d: parseDateFR(r.start),
  }));
  const provs = [...new Set(_planRows.map(r => r.prov).filter(Boolean))].sort();
  // Préserver la province déjà choisie (ex. lors d'un simple changement de langue) ;
  // sinon défaut Bruxelles si présent.
  const prevProv = document.getElementById('planProvince').value;
  const defProv = (prevProv && provs.includes(prevProv)) ? prevProv : (provs.includes('BRU') ? 'BRU' : '');
  document.getElementById('planProvince').innerHTML =
    `<option value="">${esc(t('pl_all_provinces'))}</option>` +
    provs.map(p2 => `<option value="${esc(p2)}"${p2 === defProv ? ' selected' : ''}>${esc(provLabel(p2))}</option>`).join('');
  majCommunesPlan();
}

// Renomme le libellé du planning actif (le contenu/les codes sont inchangés).
function renommerPlanningImporte() {
  const p = _plannings[_planActif];
  if (!p) return;
  const nouveau = (prompt('Nouveau nom du planning :', p.nom) || '').trim();
  if (!nouveau || nouveau === p.nom) return;
  p.nom = nouveau;
  sauverPlanningsImportes();
  rafraichirAnnexesPlanning();   // reconstruit header + agenda + carte
}

function supprimerPlanningImporte() {
  const p = _plannings[_planActif];
  if (!p) return;
  if (!confirm(tf('js_confirm_del_plan',{nom:p.nom}))) return;
  delete _plannings[_planActif];
  sauverPlanningsImportes();
  _planActif = Object.keys(_plannings)[0] || '';
  rafraichirAnnexesPlanning();   // reconstruit header + agenda + carte
}

function initPlanning() {
  if (!_planInit) {
    chargerRegistrePlannings();
    appliquerPlanningActif();
    _planInit = true;
  }
  setTimeout(() => {
    if (!_planMap && window.L) {
      _planMap = L.map('planMap').setView([50.85, 4.35], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '© OpenStreetMap · géocodage UrbIS/SPW/Geopunt' }).addTo(_planMap);
      _planLayer = L.layerGroup().addTo(_planMap);
      _planAdrLayer = L.layerGroup().addTo(_planMap);   // marqueur de vérification d'adresse
    }
    if (_planMap) _planMap.invalidateSize();
    filtrerPlanning();
  }, 60);
}

// Vérification manuelle d'une adresse : géocode + marqueur distinct + zoom
let _planAdrLayer = null;
function regionSelectionPlan() {
  const comm = document.getElementById('planCommune').value;
  if (comm) { const r = _planRows.find(x => x.commune === comm); if (r) return { region: r.region, communeFR: r.communeFR }; }
  const prov = document.getElementById('planProvince').value;
  return { region: PROV_REGION[prov] || 'bruxelles', communeFR: '' };
}
function effacerAdresseCheck() {
  document.getElementById('planAdrCheck').value = '';
  document.getElementById('planAdrStatus').textContent = '';
  if (_planAdrLayer) _planAdrLayer.clearLayers();
}
// (labels de vérification d'adresse traduits dans verifierAdresse())

// Vide le cache de géocodage des quartiers actuellement affichés, puis recalcule leur position
function rafraichirGeocodage() {
  planRowsFiltres().forEach(r => { delete _geoCache[cleGeo(r)]; });
  try { localStorage.setItem('planGeoCacheV27', JSON.stringify(_geoCache)); } catch (e) {}
  filtrerPlanning();   // re-géocode le jeu affiché
}
function verifierAdresse() {
  const adr = (document.getElementById('planAdrCheck').value || '').trim();
  const stat = document.getElementById('planAdrStatus');
  if (!adr) { stat.textContent = ''; return; }
  if (!_planMap || !_planAdrLayer) { stat.textContent = t('js_map_not_ready'); return; }
  stat.textContent = t('js_searching');
  const { region, communeFR } = regionSelectionPlan();
  const ctx = (communeFR && !sansAccent(adr).includes(sansAccent(communeFR))) ? adr + ', ' + communeFR : adr;
  const toks = tokensSignificatifs(adr);
  // la voie renvoyée doit contenir un mot significatif de l'adresse saisie (évite Pagodes→Pâquerettes)
  const nomOk = res => res && (!res.label || !toks.length || toks.some(t => sansAccent(res.label).includes(t)));
  const centreP = communeFR ? centreCommune({ region, communeFR, commune: communeFR }) : Promise.resolve(null);
  centreP.then(centre => {
    // si une commune est choisie, le résultat doit être DANS/PRÈS d'elle
    //  → évite « Ancienne Barrière » qui matche la Place de Saint-Gilles au lieu du lieu-dit de Jette
    const seuil = region === 'bruxelles' ? 4 : 10;
    const proche = pt => pt && (!centre || distanceKm(pt, centre) <= seuil);
    const viaUrbis = () => geocodeAdresseRegion(region, ctx).then(res => (nomOk(res) && proche(res)) ? res : null);
    const viaNomi = () => geocodeNominatim(ctx + ', Belgique').then(n => proche(n) ? Object.assign({ source: 'osm' }, n) : null);
    // Adresse précise (rue + numéro) → UrbIS d'abord ; libellé de quartier (sans numéro)
    //  → lieu-dit OSM d'abord (point stable, identique pour la variante FR ou NL).
    const precis = /\d/.test(adr);
    const sources = precis ? [viaUrbis, viaNomi] : [viaNomi, viaUrbis];
    let k = 0;
    const run = () => k >= sources.length ? Promise.resolve(null) : sources[k++]().then(r => r || run());
    return run().then(pt => pt || geocodeAdresseRegion(region, ctx).then(r => r ? Object.assign({ approx: true }, r) : null));
  }).then(pt => {
    if (!pt) { stat.textContent = '❌ adresse introuvable'; return; }
    _planAdrLayer.clearLayers();
    const voie = pt.label ? ` — ${esc(pt.label)}` : '';
    const srcTxt = pt.source ? ' · via ' + SRC_LBL(pt.source) : '';
    const svcTxt = (typeof pt.svc === 'number') ? ' (' + Math.round(pt.svc) + ')' : '';
    L.circleMarker([pt.lat, pt.lng], { radius: 9, color: '#c62828', weight: 3, fillColor: '#e53935', fillOpacity: 0.6 })
      .addTo(_planAdrLayer)
      .bindPopup(`📍 ${esc(adr)}${voie}${svcTxt}<br>${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`
        + (pt.approx ? `<br><span style="color:#c62828">${esc(t('js_approx_full'))}</span>` : (srcTxt ? `<br><span style="color:var(--text2)">●${srcTxt}</span>` : ''))).openPopup();
    _planMap.setView([pt.lat, pt.lng], 17);
    stat.textContent = (pt.approx ? t('js_approx_prefix') : '✓ ') + (pt.label ? pt.label + ' · ' : '') + `${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}` + srcTxt;
  });
}

// ── Import d'un planning : fichier → modale de mapping → registre ──────────
let _mapHeaders = [], _mapData = [];

function importerPlanningFichier(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      const rows = aoa.filter(r => r.some(c => c !== '' && c != null));
      if (rows.length < 2) { alert(t('js_file_empty')); return; }
      _mapHeaders = rows[0].map(h => String(h).trim());
      _mapData = rows.slice(1);
      // Format officiel LFS GRP_APPEL (large, 4 interrogations) → parsing direct
      if (estFichierLFS(_mapHeaders)) { importerPlanningLFS(file.name); return; }
      ouvrirMappingPlanning(file.name);
    } catch (err) { alert(`Lecture impossible : ${err}`); }
  };
  reader.readAsArrayBuffer(file);
}

// Détecte le format officiel LFS_IESS_GRP_APPEL (colonnes groupe + interrogations)
function estFichierLFS(headers) {
  const h = headers.map(x => sansAccent(x));
  return h.some(x => x.includes('numero_du_groupe') || x.includes('numero du groupe'))
      && h.some(x => x.includes('start_interrogation_1') || x.includes('start_interro_1'));
}

// Signature de CONTENU d'un planning = ensemble trié de ses codes de groupes.
// Permet de reconnaître un même planning même si le fichier a été renommé.
function signaturePlanning(rows) {
  return [...new Set((rows || []).map(r => String(r.code || '').trim()).filter(Boolean))].sort().join(',');
}

// Anti-doublon : on reconnaît un planning déjà importé PAR SON CONTENU (mêmes codes
// de groupes) — insensible au renommage du fichier. À défaut de codes (import
// générique sans colonne groupe), repli sur l'égalité du nom. Si trouvé, on réutilise
// son id → les données (et le libellé) sont REMPLACÉES, pas dupliquées ; sinon id neuf.
function idPourPlanning(nom, rows) {
  const sig = signaturePlanning(rows);
  const existant = Object.values(_plannings).find(p =>
    sig ? signaturePlanning(p.rows) === sig
        : p.nom === nom);
  return existant ? existant.id : 'plan_' + Date.now();
}

// Parse un fichier LFS GRP_APPEL → index .grp (code → {p,c,q,i:[[sem,start,stop]…]}) + lignes longues
function importerPlanningLFS(nomFichier) {
  const idx = {}; _mapHeaders.forEach((h, i) => { idx[sansAccent(h)] = i; });
  const col = k => idx[sansAccent(k)];
  const grp = {}, rows = [];
  _mapData.forEach(r => {
    const code = String(r[col('Numero_du_groupe')] || '').trim();
    if (!code) return;
    const p = String(r[col('Province')] || '').trim();
    const c = String(r[col('Commune')] || '').trim();
    const q = String(r[col('Quartier_central')] || '').trim();
    const i = [];
    for (let k = 1; k <= 4; k++) {
      const sem = String(r[col('Semaine_ref_Interro_' + k)] || '').trim();
      const start = fmtDateCell(r[col('Start_Interrogation_' + k)]);
      const stop = fmtDateCell(r[col('Stop_Interrogation_' + k)]);
      if (!sem && !start) continue;
      i.push([sem, start, stop]);
      rows.push({ code, prov: p, commune: c, communeFR: c.split('/')[0].trim(), quartier: q, wave: k, sem, start, stop });
    }
    grp[code] = { p, c, q, i };
  });
  if (!rows.length) { alert(t('js_no_readable_lfs')); return; }
  const nomComplet = nomFichier.replace(/\.[^.]+$/, '') + ' — EFT / LFS';
  const id = idPourPlanning(nomComplet, rows);      // reconnu par contenu → pas de doublon
  const remplace = !!_plannings[id];
  _plannings[id] = { id, nom: nomComplet, type: 'EFT / LFS', rows, grp, embedded: false };
  sauverPlanningsImportes();
  _planActif = id;
  rafraichirAnnexesPlanning();                 // reconstruit header + agenda + carte
  const sel = document.getElementById('selPlanning');
  if (sel && [...sel.options].some(o => o.value === id)) { sel.value = id; onChangePlanning(); }  // focalise le planning importé
  if (remplace && typeof afficherToast === 'function') afficherToast(t('js_plan_updated'));
}

// Après import/suppression : le Planner (et, via le stockage partagé, l'annexe
// Aperçu du Convertisseur) se rafraîchit en relisant localStorage['plannings'].
function rafraichirAnnexesPlanning() {
  chargerPlanningsConvertisseur();
}

function ouvrirMappingPlanning(nomFichier) {
  document.getElementById('mapFichier').textContent = nomFichier;
  document.getElementById('mapNbLignes').textContent = _mapData.length;
  document.getElementById('mapNom').value = nomFichier.replace(/\.[^.]+$/, '');
  document.getElementById('mapErreur').style.display = 'none';
  const opts = `<option value="">— (${esc('aucune')}) —</option>` +
    _mapHeaders.map((h, i) => `<option value="${i}">${esc(h)}</option>`).join('');
  const devine = (selId, motifs) => {
    const el = document.getElementById(selId);
    el.innerHTML = opts;
    const i = _mapHeaders.findIndex(h => motifs.some(m => sansAccent(h).includes(m)));
    if (i >= 0) el.value = String(i);
  };
  devine('mapCommune',  ['commune', 'gemeente', 'municipal']);
  devine('mapQuartier', ['quartier', 'wijk', 'adresse', 'adres', 'rue', 'straat', 'central']);
  devine('mapProvince', ['province', 'provincie']);
  devine('mapGroup',    ['groupe', 'group', 'numero', 'nr_grp', 'code']);
  devine('mapWave',     ['vague', 'wave', 'interro']);
  devine('mapWeek',     ['semaine', 'week', 'ref']);
  devine('mapStart',    ['debut', 'start', 'begin']);
  devine('mapStop',     ['fin', 'stop', 'eind']);
  document.getElementById('modalPlanMap').classList.add('open');
}
function fermerMappingPlanning() { document.getElementById('modalPlanMap').classList.remove('open'); }

function valCol(row, selId) {
  const i = document.getElementById(selId).value;
  if (i === '') return '';
  const v = row[+i];
  return v == null ? '' : v;
}
function fmtDateCell(v) {
  if (v instanceof Date && !isNaN(v)) {
    const p = n => String(n).padStart(2, '0');
    return p(v.getDate()) + '/' + p(v.getMonth() + 1) + '/' + v.getFullYear();
  }
  const s = String(v || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : s;
}

function confirmerMappingPlanning() {
  const err = document.getElementById('mapErreur');
  if (document.getElementById('mapCommune').value === '') {
    err.textContent = t('js_col_commune_required'); err.style.display = 'block'; return;
  }
  const nom = (document.getElementById('mapNom').value || 'Planning').trim();
  const type = document.getElementById('mapType').value;
  const rows = _mapData.map(r => {
    const commune = String(valCol(r, 'mapCommune')).trim();
    if (!commune) return null;
    return {
      code: String(valCol(r, 'mapGroup')).trim(),
      prov: String(valCol(r, 'mapProvince')).trim(),
      commune, communeFR: commune.split('/')[0].trim(),
      quartier: String(valCol(r, 'mapQuartier')).trim(),
      wave: String(valCol(r, 'mapWave')).trim(),
      sem: String(valCol(r, 'mapWeek')).trim(),
      start: fmtDateCell(valCol(r, 'mapStart')),
      stop: fmtDateCell(valCol(r, 'mapStop')),
    };
  }).filter(Boolean);
  if (!rows.length) { err.textContent = t('js_no_line_commune'); err.style.display = 'block'; return; }
  const nomComplet = nom + ' — ' + type;
  const id = idPourPlanning(nomComplet, rows);      // reconnu par contenu → pas de doublon
  const remplace = !!_plannings[id];
  _plannings[id] = { id, nom: nomComplet, type, rows, embedded: false };
  sauverPlanningsImportes();
  _planActif = id;
  fermerMappingPlanning();
  rafraichirAnnexesPlanning();                 // reconstruit header + agenda + carte
  const selp = document.getElementById('selPlanning');
  if (selp && [...selp.options].some(o => o.value === id)) { selp.value = id; onChangePlanning(); }  // focalise le planning importé
  if (remplace && typeof afficherToast === 'function') afficherToast(t('js_plan_updated'));
}

function majCommunesPlan() {
  const prov = document.getElementById('planProvince').value;
  const sel = document.getElementById('planCommune');
  const cur = sel.value;
  const communes = [...new Set(_planRows.filter(r => !prov || r.prov === prov).map(r => r.commune))].sort();
  sel.innerHTML = `<option value="">${esc(t('pl_all_communes'))}</option>` +
    communes.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(communeLabel(c))}</option>`).join('');
  majQuartiersPlan();
}

// Cascade Province/Commune → Quartier
function majQuartiersPlan() {
  const prov = document.getElementById('planProvince').value;
  const comm = document.getElementById('planCommune').value;
  const sel = document.getElementById('planQuartier');
  const cur = sel ? sel.value : '';
  if (!sel) return;
  const quartiers = [...new Set(_planRows
    .filter(r => (!prov || r.prov === prov) && (!comm || r.commune === comm) && r.quartier)
    .map(r => r.quartier))].sort();
  sel.innerHTML = `<option value="">${esc(t('pl_all_quartiers'))}</option>` +
    quartiers.map(qq => `<option value="${esc(qq)}"${qq === cur ? ' selected' : ''}>${esc(qq)}</option>`).join('');
}

function effacerRecherchePlan() {
  document.getElementById('planSearch').value = '';
  filtrerPlanning();
  document.getElementById('planSearch').focus();
}

function planRowsFiltres() {
  const prov = document.getElementById('planProvince').value;
  const comm = document.getElementById('planCommune').value;
  const quar = document.getElementById('planQuartier').value;
  const aVenir = document.getElementById('planAVenir').checked;
  const champ = document.getElementById('planSearch');
  const q = sansAccent((champ.value || '').trim());
  document.getElementById('planSearchClear').style.display = champ.value ? 'flex' : 'none';
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return _planRows.filter(r =>
    (!prov || r.prov === prov) && (!comm || r.commune === comm) && (!quar || r.quartier === quar) &&
    (!aVenir || (parseDateFR(r.stop) && parseDateFR(r.stop) >= now)) &&
    (!q || sansAccent(r.code).includes(q) || sansAccent(r.commune).includes(q) || sansAccent(r.quartier).includes(q))
  );
}

function filtrerPlanning() {
  const rows = planRowsFiltres().sort((a, b) => (a.d && b.d) ? a.d - b.d : 0);
  const grp = new Set(rows.map(r => r.code));
  document.getElementById('planCount').textContent = tf('js_plan_count',{g:grp.size,i:rows.length});
  renderPlanningTable(rows);
  majMarqueursPlan(rows);
}

// Tableau groupé : 1 ligne par groupe (Group/Commune/Quartier/Prochaine) + accordéon des 4 vagues
let _planGroupes = [], _planTri = { col: 'prochaine', dir: 1 };
function renderPlanningTable(rows) {
  const order = [], byCode = {};
  rows.forEach(r => { if (!byCode[r.code]) { byCode[r.code] = r; order.push(r.code); } });
  const now = new Date(); now.setHours(0, 0, 0, 0);
  _planGroupes = order.map(code => {
    const rep = byCode[code];
    const vagues = _planRows.filter(x => x.code === code).slice().sort((a, b) => (+a.wave || 0) - (+b.wave || 0));
    const fut = vagues.map(x => ({ x, d: parseDateFR(x.start) })).filter(o => o.d).sort((a, b) => a.d - b.d);
    const nx = fut.find(o => o.d >= now) || fut[0];
    return { code, commune: rep.commune, communeFR: rep.communeFR, quartier: rep.quartier, vagues, nx: nx ? nx.x : null, nxD: nx ? nx.d : null };
  });
  rendrePlanGroupes();
}

// Tri cliquable des colonnes
function triPlanning(col) {
  if (_planTri.col === col) _planTri.dir *= -1; else _planTri = { col, dir: 1 };
  rendrePlanGroupes();
}

// Précision du géocodage d'un groupe (depuis le cache) → { sc, txt, col }
function precisionGroupe(g) {
  const c = _geoCache[(g.communeFR || '') + '|' + g.quartier];
  if (!c) return { sc: -1, txt: '…', col: 'var(--text2)' };          // pas encore géocodé
  if (c.lat == null) return { sc: 0, txt: t('js_prec_fail'), col: '#c62828' };
  const sc = c.score || 0;
  const ecart = (c.ecart != null) ? ' · Δ' + c.ecart + ' m' : '';
  const src = c.source ? ' · ' + SRC_LBL(c.source) : '';
  const txt = (sc >= 80 ? t('js_prec_high') : sc >= 60 ? t('js_prec_mid') : t('js_prec_commune')) + ' (' + sc + ')' + src + ecart;
  return { sc, txt, col: sc >= 80 ? '#2e7d32' : sc >= 60 ? '#f9a825' : '#c62828' };
}
// Libellé lisible de la source de géocodage
function SRC_LBL(s) {
  return { urbis: 'UrbIS', spw: 'SPW', geopunt: 'Geopunt', osm: 'OSM', centre: t('js_src_centre') }[s] || s;
}

function rendrePlanGroupes() {
  const { col, dir } = _planTri;
  const arr = _planGroupes.slice().sort((a, b) => {
    if (col === 'prochaine') {
      const va = a.nxD ? a.nxD.getTime() : Infinity, vb = b.nxD ? b.nxD.getTime() : Infinity;
      return dir * (va - vb);
    }
    if (col === 'precision') return dir * (precisionGroupe(a).sc - precisionGroupe(b).sc);
    const va = col === 'group' ? a.code : a[col], vb = col === 'group' ? b.code : b[col];
    return dir * sansAccent(String(va)).localeCompare(sansAccent(String(vb)), undefined, { numeric: true });
  });
  const ind = c => _planTri.col === c ? (_planTri.dir > 0 ? ' ▲' : ' ▼') : '';
  const th = (c, lbl) => `<th style="cursor:pointer" onclick="triPlanning('${c}')">${lbl}${ind(c)}</th>`;
  let h = '<thead><tr><th style="width:22px"></th>' + th('group', esc(t('th_group_short'))) + th('commune', esc(t('f_commune')))
    + th('quartier', esc(t('th_quartier'))) + th('precision', esc(t('js_precision'))) + th('prochaine', esc(t('js_next'))) + '</tr></thead><tbody>';
  arr.forEach(g => {
    const id = 'pd-' + String(g.code).replace(/[^a-z0-9]/gi, '_');
    const prochaine = g.nx ? `I${g.nx.wave} · ${esc(g.nx.start)}` : '';
    const p = precisionGroupe(g);
    const codeJS = String(g.code).replace(/['\\]/g, '');
    h += `<tr class="plan-grp" style="cursor:pointer" onclick="togglePlanDetail('${id}',this);centrerSurGroupe('${codeJS}')">`
      + `<td class="plan-arrow">▸</td><td>${esc(g.code)}</td><td>${esc(g.commune)}</td>`
      + `<td>${esc(g.quartier)}</td>`
      + `<td style="color:${p.col};white-space:nowrap;cursor:help" title="${esc(t('js_debug_geo_tip'))}" onclick="event.stopPropagation();debugGroupe('${codeJS}')">● ${esc(p.txt)} 🐞</td>`
      + `<td>${esc(prochaine)}</td></tr>`;
    const det = g.vagues.map(x => `<div style="padding:2px 0"><b>I${x.wave}</b> · wk ${esc(x.sem)} · ${esc(x.start)} → ${esc(x.stop)}</div>`).join('');
    h += `<tr id="${id}" style="display:none"><td></td><td colspan="5">${det}</td></tr>`;
  });
  h += '</tbody>';
  document.getElementById('refPlanning').innerHTML = h;
}

function togglePlanDetail(id, tr) {
  const d = document.getElementById(id);
  if (!d) return;
  const open = d.style.display === 'none';
  d.style.display = open ? '' : 'none';
  const ar = tr && tr.querySelector('.plan-arrow');
  if (ar) ar.textContent = open ? '▾' : '▸';
}

// Carte : un marqueur par groupe (quartier central), géocodé selon la région
let _planMarkers = {};   // code → marqueur Leaflet (pour centrer depuis le tableau)
function majMarqueursPlan(rows) {
  if (!_planMap) return;
  _planLayer.clearLayers();
  _planMarkers = {};
  // groupes uniques
  const groupes = {};
  rows.forEach(r => { if (!groupes[r.code]) groupes[r.code] = r; });
  const liste = Object.values(groupes);
  const bounds = [];
  let aGeocoder = liste.filter(g => !_geoCache[cleGeo(g)]);
  const stat = document.getElementById('planGeoStatus');
  // Cadrage : on zoome d'autant plus que la sélection est fine (quartier > commune > région)
  const maxZ = document.getElementById('planQuartier').value ? 16
    : document.getElementById('planCommune').value ? 15 : 14;
  const recadrer = () => {
    if (!bounds.length) return;
    if (bounds.length === 1) _planMap.setView(bounds[0], maxZ);
    else _planMap.fitBounds(bounds, { padding: [30, 30], maxZoom: maxZ });
  };
  // place d'abord ce qui est en cache
  liste.forEach(g => { const c = _geoCache[cleGeo(g)]; if (c && c.lat) { ajoutMarqueur(g, c); bounds.push([c.lat, c.lng]); } });
  recadrer();

  if (!aGeocoder.length) { stat.textContent = liste.length ? tf('js_quartiers_located',{n:liste.length}) : ''; return; }
  let i = 0;
  stat.textContent = tf('js_geocoding_progress',{i:0,n:aGeocoder.length});
  (function suivant() {
    if (i >= aGeocoder.length) {
      try { localStorage.setItem('planGeoCacheV27', JSON.stringify(_geoCache)); } catch (e) {}
      stat.textContent = tf('js_geocoding_done',{n:liste.length});
      recadrer();
      rendrePlanGroupes();   // met à jour la colonne « Précision » une fois le géocodage fini
      return;
    }
    const g = aGeocoder[i];
    stat.textContent = tf('js_geocoding_progress',{i:i+1,n:aGeocoder.length});
    geocodeQuartier(g).then(pt => {
      _geoCache[cleGeo(g)] = pt || { lat: null };   // mémorise même l'échec (évite de re-tenter)
      if (pt) { ajoutMarqueur(g, pt); bounds.push([pt.lat, pt.lng]); }
      i++; setTimeout(suivant, 500);
    });
  })();
}
const cleGeo = g => g.communeFR + '|' + g.quartier;

function ajoutMarqueur(g, pt) {
  const interros = _planRows.filter(r => r.code === g.code)
    .map(r => `I${r.wave} · wk ${esc(r.sem)} · ${esc(r.start)}→${esc(r.stop)}`).join('<br>');
  const sc = pt.score || 0;
  const conf = sc >= 80 ? 'élevée' : sc >= 60 ? 'moyenne' : 'commune (approx.)';
  const col = sc >= 80 ? '#2e7d32' : sc >= 60 ? '#f9a825' : '#c62828';
  const src = pt.source ? ' · via ' + SRC_LBL(pt.source) : '';
  _planMarkers[g.code] = L.marker([pt.lat, pt.lng]).addTo(_planLayer)
    .bindPopup(`<b>${esc(g.code)}</b> — ${esc(g.commune)}<br><i>${esc(g.quartier)}</i><br>${interros}`
      + `<br><span style="color:${col}">● ${esc('localisation')} ${conf}${sc ? ' (' + sc + ')' : ''}${src}</span>`);
}

// Centre la carte sur le marqueur d'un groupe (clic depuis le tableau)
function centrerSurGroupe(code) {
  const m = _planMarkers[code];
  if (!m || !_planMap) return;
  _planMap.setView(m.getLatLng(), Math.max(_planMap.getZoom(), 16));
  m.openPopup();
}

// Debug du géocodage d'un quartier (clic sur la cellule Précision) : essais + forme retenue
function debugGroupe(code) {
  const g = _planGroupes.find(x => x.code === code);
  if (!g) return;
  const row = _planRows.find(x => x.code === code);
  const region = row ? row.region : 'bruxelles';
  const stat = document.getElementById('planGeoStatus');
  stat.textContent = `🐞 ${code} — analyse en cours…`;
  geocodeQuartier({ region, commune: g.commune, communeFR: g.communeFR, quartier: g.quartier, debug: true }).then(r => {
    console.group('🐞 ' + code + ' — « ' + g.quartier + ' » (' + g.communeFR + ')');
    console.log('Retenu :', r.retenu, '| score :', r.score, '| source :', r.source, '| écart :', r.ecart != null ? r.ecart + ' m' : '—');
    console.table((r.essais || []).map((e, i) => ({ '#': i + 1, essai: e })));
    console.groupEnd();
    stat.innerHTML = '🐞 <b>' + esc(code) + '</b> → ' + esc(r.retenu || '—')
      + ' (score ' + (r.score || 0) + (r.source ? ', ' + esc(SRC_LBL(r.source)) : '') + ') — '
      + `${r.essais ? r.essais.length : 0} essai(s) (détail dans la console F12)`;
  });
}

// Distance (km) entre deux points WGS84
function distanceKm(a, b) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Centres des 19 communes bruxelloises (ancrage fiable, indépendant du quartier)
const BRU_CENTROIDS = {
  'anderlecht': { lat: 50.8364, lng: 4.3134 },
  'auderghem': { lat: 50.8160, lng: 4.4330 }, 'oudergem': { lat: 50.8160, lng: 4.4330 },
  'berchem-sainte-agathe': { lat: 50.8650, lng: 4.2930 }, 'sint-agatha-berchem': { lat: 50.8650, lng: 4.2930 },
  'bruxelles': { lat: 50.8466, lng: 4.3528 }, 'brussel': { lat: 50.8466, lng: 4.3528 },
  'etterbeek': { lat: 50.8360, lng: 4.3890 },
  'evere': { lat: 50.8710, lng: 4.4020 },
  'forest': { lat: 50.8120, lng: 4.3180 }, 'vorst': { lat: 50.8120, lng: 4.3180 },
  'ganshoren': { lat: 50.8710, lng: 4.3140 },
  'ixelles': { lat: 50.8230, lng: 4.3670 }, 'elsene': { lat: 50.8230, lng: 4.3670 },
  'jette': { lat: 50.8780, lng: 4.3260 },
  'koekelberg': { lat: 50.8620, lng: 4.3270 },
  'molenbeek-saint-jean': { lat: 50.8550, lng: 4.3280 }, 'sint-jans-molenbeek': { lat: 50.8550, lng: 4.3280 },
  'saint-gilles': { lat: 50.8270, lng: 4.3450 }, 'sint-gillis': { lat: 50.8270, lng: 4.3450 },
  'saint-josse-ten-noode': { lat: 50.8520, lng: 4.3710 }, 'sint-joost-ten-node': { lat: 50.8520, lng: 4.3710 },
  'saint-josse-ten-node': { lat: 50.8520, lng: 4.3710 },
  'schaerbeek': { lat: 50.8670, lng: 4.3780 }, 'schaarbeek': { lat: 50.8670, lng: 4.3780 },
  'uccle': { lat: 50.8000, lng: 4.3380 }, 'ukkel': { lat: 50.8000, lng: 4.3380 },
  'watermael-boitsfort': { lat: 50.7950, lng: 4.4120 }, 'watermaal-bosvoorde': { lat: 50.7950, lng: 4.4120 },
  'woluwe-saint-lambert': { lat: 50.8460, lng: 4.4300 }, 'sint-lambrechts-woluwe': { lat: 50.8460, lng: 4.4300 },
  'woluwe-saint-pierre': { lat: 50.8360, lng: 4.4520 }, 'sint-pieters-woluwe': { lat: 50.8360, lng: 4.4520 },
};

// Géocode une adresse libre via le service public de la région.
// Renvoie { lat, lng, label (voie renvoyée), muni, svc (score 0–100 du service) } ou null.
function geocodeAdresseRegion(region, adr) {
  if (region === 'bruxelles') {
    const base = 'https://geoservices.irisnet.be/localization/Rest/Localize/getaddresses?language=fr&spatialReference=4326&address=';
    const sa = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const variantes = [...new Set([adr, sa(adr)])];
    const essai = i => i >= variantes.length ? Promise.resolve(null) :
      fetch(base + encodeURIComponent(variantes[i])).then(r => r.json()).then(d => {
        const r0 = d && !d.error && d.result && d.result[0];
        const st = r0 && r0.address && r0.address.street;
        return (r0 && r0.point) ? { lat: r0.point.y, lng: r0.point.x, label: st ? st.name : '', muni: st ? st.municipality : '', svc: r0.score, src: 'urbis' } : essai(i + 1);
      }).catch(() => essai(i + 1));
    return essai(0);
  }
  if (region === 'flandre') {
    return fetch('https://geo.api.vlaanderen.be/geolocation/v4/Location?c=1&q=' + encodeURIComponent(adr))
      .then(r => r.json()).then(d => {
        const r0 = d && d.LocationResult && d.LocationResult[0];
        const loc = r0 && r0.Location;
        return (loc && loc.Lat_WGS84) ? { lat: loc.Lat_WGS84, lng: loc.Lon_WGS84, label: r0.FormattedAddress || '', muni: r0.Municipality || '', svc: undefined, src: 'geopunt' } : null;
      }).catch(() => null);
  }
  // wallonie (et défaut)
  return fetch('https://geoservices.wallonie.be/geocodeWS/geocode?geom=true&crs=EPSG:4326&address=' + encodeURIComponent(adr))
    .then(r => r.json()).then(d => {
      const cand = d && d.candidates && d.candidates[0];
      const geo = cand && ((cand.house && cand.house.geometry) || (cand.street && cand.street.geometry) || cand.geometry);
      const label = cand ? (cand.address || (cand.street && cand.street.name) || '') : '';
      return (geo && geo.coordinates) ? { lat: geo.coordinates[1], lng: geo.coordinates[0], label: label, muni: '', svc: cand.score, src: 'spw' } : null;
    }).catch(() => null);
}

// Tokens significatifs d'un libellé quartier (pour valider la voie renvoyée par le géocodeur)
const STOP_TOK = new Set([
  'rue', 'avenue', 'chaussee', 'place', 'boulevard', 'square', 'allee', 'dreve', 'clos', 'impasse', 'quai', 'galerie',  // voies FR
  'saint', 'sainte', 'des', 'les', 'aux',                                                                              // connecteurs / qualificatifs
  'straat', 'laan', 'plein', 'steenweg', 'sint', 'dreef', 'gangpad', 'gang', 'baan', 'kaai', 'plaats', 'weg', 'pad']); // voies NL
function tokensSignificatifs(q) {
  return String(q).replace(/\([^)]*\)/g, '').replace(/[-\/.]+/g, ' ').split(/\s+/)
    .map(t => sansAccent(t)).filter(t => t.length >= 4 && !STOP_TOK.has(t));
}

// Centre de la commune (ancrage hiérarchique province→commune) : table BXL, sinon service régional
const _centreCache = {};
function centreCommune(g) {
  if (g.region === 'bruxelles') {
    for (const n of String(g.commune || '').split('/').map(s => sansAccent(s.trim())))
      if (BRU_CENTROIDS[n]) return Promise.resolve(BRU_CENTROIDS[n]);
  }
  const cle = sansAccent(g.communeFR || '');
  if (_centreCache[cle]) return Promise.resolve(_centreCache[cle]);
  // SPW/Geopunt ne géocodent pas un nom de commune seul → repli Nominatim (fiable pour les communes)
  return geocodeAdresseRegion(g.region, g.communeFR + ', Belgique')
    .then(pt => pt || geocodeNominatim(g.communeFR + ', Belgium'))
    .then(pt => { if (pt) _centreCache[cle] = { lat: pt.lat, lng: pt.lng }; return _centreCache[cle] || null; });
}

// Abréviations de voies FR courantes (1er mot du libellé quartier)
const VOIE_ABBR = {
  CH: 'Chaussée de', CHEE: 'Chaussée de', CHSEE: 'Chaussée de', AV: 'Avenue', BD: 'Boulevard',
  BLD: 'Boulevard', BLVD: 'Boulevard', R: 'Rue', PL: 'Place', SQ: 'Square', ALL: 'Allée',
  DR: 'Drève', CLOS: 'Clos', RPT: 'Rond-Point', GAL: 'Galerie', IMP: 'Impasse', QU: 'Quai',
};

// Génère des requêtes candidates (avec score de confiance) depuis un libellé
// quartier bilingue FR/NL collé. Stratégie :
//  - 1er mot = abréviation de voie (CH./AV./…) → expansion + préfixes décroissants ;
//  - sinon nom nu → types de voie FR (Rue/Avenue/Chaussée/Place) × connecteurs (d'/de/de l'/de la/du)
//    sur la partie FR (préfixes), ET formes NL (…straat/laan/plein/steenweg) sur la partie NL (suffixes).
// geocodeQuartier essaie dans l'ordre et retient le 1er candidat qui tombe DANS la commune.
// Variantes orthographiques d'un nom : i↔y sur le dernier mot (Henri/Henry, …)
function variantesNom(nom) {
  const w = nom.split(' '), last = w[w.length - 1];
  let alt = null;
  if (/i$/i.test(last)) alt = last.replace(/i$/i, 'y');
  else if (/y$/i.test(last)) alt = last.replace(/y$/i, 'i');
  if (!alt) return [nom];
  return [nom, w.slice(0, -1).concat(alt).join(' ')];
}

// Abréviations d'adjectifs/qualificatifs courants (n'importe où dans le libellé)
const TOKEN_ABBR = { GDE: 'Grande', GD: 'Grand', PTE: 'Petite', PT: 'Petit', STE: 'Sainte', ST: 'Saint', ANC: 'Ancienne', ANCIENE: 'Ancienne', ANCIEN: 'Ancien', AFSPAN: 'Afspanning', AFSPANNI: 'Afspanning' };
const TYPES_VOIE = ['Rue', 'Avenue', 'Chaussée', 'Place', 'Boulevard'];
// Suffixes de voie NL (pour reconstruire les formes néerlandaises : Xstraat, Xlaan…)
const SUFFIXES_NL = ['straat', 'laan', 'plein', 'steenweg', 'dreef', 'baan', 'kaai', 'plaats', 'weg'];
// Normalise un mot : abréviation d'adjectif (GDE→Grande, ST→Saint…) puis abréviation NL collée
//  en suffixe (STOKKELSESTWG→Stokkelsesteenweg, …STRT→…straat, …LN→…laan)
function normToken(t) {
  const u = t.toUpperCase();
  if (TOKEN_ABBR[u]) return TOKEN_ABBR[u];
  return t.replace(/(stwg|stweg)$/i, 'steenweg').replace(/strt$/i, 'straat');
}
// Expansion d'un mot pouvant donner PLUSIEURS formes (Bruxelles bilingue) :
//  ST → Saint | Sint, STE → Sainte | Sint (ex. ST-ROCH, ST-PAUL, ST-JOSSE).
function expandToken(t) {
  const u = t.toUpperCase();
  if (u === 'ST') return ['Saint', 'Sint'];
  if (u === 'STE') return ['Sainte', 'Sint'];
  return [normToken(t)];
}
// Produit cartésien : [[a,b],[c]] → [[a,c],[b,c]]
function produitTokens(arrs) {
  return arrs.reduce((acc, opts) => acc.flatMap(seq => opts.map(o => seq.concat(o))), [[]]);
}

// Dictionnaire FR/NL pour les libellés bilingues juxtaposés SANS séparateur, que le parsing
// générique ne peut pas découper (clé = libellé normalisé sans accents). Extensible à la main.
const DICO_FR_NL = {
  'paix vrede': ['Paix', 'Vrede'],
  'resistance verzet': ['Résistance', 'Verzet'],
  'angleterre engeland': ['Angleterre', 'Engeland'],
  'europe europa': ['Europe', 'Europa'],
  'duchesse brabant hertogin': ['Duchesse de Brabant', 'Hertogin van Brabant'],
};
// Enrichir le dictionnaire FR/NL à la volée (sans toucher au parseur) :
//   ajouterAliasFRNL('SAINTE CATHERINE STE KATELIJNE', ['Sainte-Catherine', 'Sint-Katelijne'])
function ajouterAliasFRNL(label, formes) {
  const cle = sansAccent(label).replace(/[-\/.()]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (cle && Array.isArray(formes) && formes.length) DICO_FR_NL[cle] = formes.slice();
}

// Bases possibles d'un libellé : dictionnaire FR/NL prioritaire, puis variantes de parenthèses
// (LA(E)KENVELD → LAKENVELD + LAEKENVELD), variante de lettre « MOT/x », découpage bilingue « / ».
function basesQuartier(q) {
  const norm = s => s.replace(/[-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  // 0) dictionnaire FR/NL explicite (avant le parsing générique)
  const cle = sansAccent(q).replace(/[-\/.()]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (DICO_FR_NL[cle]) return DICO_FR_NL[cle].slice();
  // Variante de lettre finale collée « MOT/x » (x ≤ 2 lettres). On génère plusieurs formes
  //  plausibles (le bon est filtré ensuite par validation du nom) :
  //   MARIE/A      → MARIE | MARIA            (dernière lettre remplacée)
  //   CHRISTINE/A  → CHRISTINE | CHRISTINA
  //   ROOSENDAA/EL → ROOSENDAA | ROOSENDAEL (lettre remplacée) | ROOSENDAAL (dernière lettre de x ajoutée)
  const rx = /([A-Za-zÀ-ÿ]+)\s*\/\s*([A-Za-zÀ-ÿ]{1,2})(?![A-Za-zÀ-ÿ])/g;   // tolère « MARIE / A »
  const variants = rx.test(q) ? [...new Set([
    q.replace(rx, '$1'),                                   // mot de base
    q.replace(rx, (m, w, x) => w.slice(0, -1) + x),        // dernière lettre remplacée par x
    q.replace(rx, (m, w, x) => w + x.slice(-1)),           // dernière lettre de x ajoutée
  ])] : [q];
  const set = [];
  variants.forEach(qq =>
    [qq.replace(/\([^)]*\)/g, ''), qq.replace(/[()]/g, '')].forEach(v =>
      v.split('/').forEach(part => { const p = norm(part); if (p) set.push(p); })));
  return [...new Set(set.filter(Boolean))];
}

function candidatsQuartier(q) {
  const out = [];
  const perBase = [];
  basesQuartier(q).forEach(b => {
    const opts = b.split(' ').filter(Boolean).map(expandToken);   // [[Saint,Sint],[Roch]]
    produitTokens(opts).forEach(seq => { if (seq.length) perBase.push(seq); });
  });
  // 1) formes directes + NL (toutes bases d'abord — prioritaires vu la limite de 24 requêtes)
  perBase.forEach(toks => {
    const tete = toks[0].toUpperCase();
    if (VOIE_ABBR[tete]) {
      const exp = VOIE_ABBR[tete].split(' ').concat(toks.slice(1));
      for (let n = Math.min(exp.length, 4); n >= 2; n--) out.push({ req: exp.slice(0, n).join(' '), score: 90 });
    } else {
      for (let n = Math.min(toks.length, 5); n >= 1; n--) out.push({ req: toks.slice(0, n).join(' '), score: 87 });
      const nl = toks[toks.length - 1];
      SUFFIXES_NL.forEach(s => out.push({ req: nl + s, score: 85 }));
    }
  });
  // 2) types de voie préfixés (noms nus : Angleterre → Rue d'Angleterre…)
  //    cœur FR à 1 mot d'abord (cas le plus fréquent : « Place de la Résistance »)
  perBase.forEach(toks => {
    if (VOIE_ABBR[toks[0].toUpperCase()]) return;
    for (let n = 1; n <= Math.min(toks.length, 2); n++) {
      const cores = variantesNom(toks.slice(0, n).join(' '));
      const voy = /^[aeiouyéèêàâh]/i.test(cores[0]);
      const conns = voy ? ["d'", "de l'"] : ['de ', 'de la ', 'du '];
      cores.forEach(cc => TYPES_VOIE.forEach(t => out.push({ req: t + ' ' + cc, score: 88 })));
      cores.forEach(cc => TYPES_VOIE.forEach(t => {
        if (t === 'Chaussée') out.push({ req: 'Chaussée de ' + cc, score: 86 });
        else conns.forEach(cn => out.push({ req: t + ' ' + cn + cc, score: 84 }));
      }));
    }
  });
  out.push({ req: q, score: 60 });   // libellé brut
  const seen = new Set();
  return out.filter(o => { const k = o.req.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

// POI (maison communale, gare…) résolu via Nominatim (UrbIS ne gère pas ces lieux),
// validé par distance au centre ; sinon repli sur le centre de la commune.
function geocodePOI(reqs, centre, seuil, scoreOk) {
  const fb = () => centre ? { lat: centre.lat, lng: centre.lng, score: 60, source: 'centre' } : null;
  let i = 0;
  const nx = () => i >= reqs.length ? Promise.resolve(fb()) :
    geocodeNominatim(reqs[i++]).then(pt =>
      (pt && (!centre || distanceKm(pt, centre) <= seuil)) ? { lat: pt.lat, lng: pt.lng, score: scoreOk, source: 'osm' } : nx());
  return nx();
}
function geocodeMaisonCommunale(g, centre, seuil) {
  const ville = g.region === 'bruxelles' ? 'Bruxelles' : 'Belgium';
  return geocodePOI(['Hôtel de Ville ' + g.communeFR + ', ' + ville,
                     'Maison communale ' + g.communeFR + ', ' + ville,
                     'Stadhuis ' + g.communeFR + ', Belgium'], centre, seuil, 90);
}
function geocodeGare(g, centre, seuil) {
  const ville = g.region === 'bruxelles' ? 'Bruxelles' : 'Belgium';
  return geocodePOI(['Gare de ' + g.communeFR + ', ' + ville,
                     'Station ' + g.communeFR + ', ' + ville,
                     g.communeFR + ' gare'], centre, seuil, 90);
}

// Géocodage Nominatim/OSM (recherche textuelle souple) — repli quand le service régional échoue.
// Politique OSM : max 1 req/s → on sérialise les appels avec ≥1,1 s d'écart (évite le blocage HTTP 429).
let _nomiAt = 0;
function geocodeNominatim(adr) {
  const at = Math.max(Date.now(), _nomiAt + 1100);
  const wait = at - Date.now();
  _nomiAt = at;
  return new Promise(res => setTimeout(res, wait)).then(() =>
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=be&q=' + encodeURIComponent(adr))
      .then(r => r.json()).then(d => (d && d[0]) ? { lat: +d[0].lat, lng: +d[0].lon } : null).catch(() => null));
}

// Géocodage hiérarchique province→commune→quartier, avec score de confiance :
//  1) centre de commune fiable (ancrage) ; 2) candidats FR/NL via service régional ;
//  3) repli Nominatim ; 4) sinon centre commune. Tout résultat est filtré DANS la commune.
const _quartierCache = new Map();   // mémoïsation session : region|commune|quartier → point
async function geocodeQuartier(g) {
  const essais = [];
  let retenu = '—';
  const ck = (g.region || '') + '|' + (g.communeFR || '') + '|' + (g.quartier || '');
  if (!(g && g.debug) && _quartierCache.has(ck)) return _quartierCache.get(ck);
  const finalize = (pt) => {
    const out = (g && g.debug) ? Object.assign({}, pt || { score: 0 }, { essais, retenu }) : pt;
    if (!(g && g.debug) && out) _quartierCache.set(ck, out);   // on ne met en cache QUE les résultats non nuls
    return out;
  };

  try {
    const centre = await centreCommune(g);
    let seuil = g.region === 'bruxelles' ? 3 : 8;
    if (g.region === 'bruxelles' && /bruxelles|brussel/.test(sansAccent(g.communeFR))) seuil = 9;
    const ok = pt => pt && (!centre || distanceKm(pt, centre) <= seuil);
    const fallback = () => { retenu = 'centre commune'; return centre ? { lat: centre.lat, lng: centre.lng, score: 30, source: 'centre' } : null; };

    if (!g.quartier) return finalize(fallback());

    // 1. Court-circuits POI
    if (/hotel (de )?ville|hotel communal|maison communale|gemeentehuis|stadhuis/.test(sansAccent(g.quartier))) {
      retenu = 'POI maison communale'; return finalize(await geocodeMaisonCommunale(g, centre, seuil));
    }
    if (/\bgare\b|\bstation\b|treinstation/.test(sansAccent(g.quartier))) {
      retenu = 'POI gare'; return finalize(await geocodeGare(g, centre, seuil));
    }

    const cands = candidatsQuartier(g.quartier).slice(0, 30);
    essais.push(...cands.map(c => c.req));
    const toksQ = [...new Set(basesQuartier(g.quartier).flatMap(b => tokensSignificatifs(b)).concat(tokensSignificatifs(g.quartier)))];
    let nomme = null, autre = null;

    // 2. Recherche via les services régionaux (boucle linéaire)
    for (const c of cands) {
      const res = await geocodeAdresseRegion(g.region, c.req + ', ' + g.communeFR);   // pas de « , Belgique » (pollue UrbIS)
      if (ok(res)) {
        const dd = centre ? distanceKm(res, centre) : 0;
        const svc = (typeof res.svc === 'number') ? res.svc : 70;
        const nameOk = res.label && toksQ.some(t => sansAccent(res.label).includes(t));
        if (nameOk) {
          if (!nomme || svc > nomme.svc + 0.5 || (Math.abs(svc - nomme.svc) <= 0.5 && dd < nomme.dd))
            nomme = { lat: res.lat, lng: res.lng, score: Math.min(100, Math.max(80, Math.round(svc))), svc, dd, label: res.label, src: res.src };
        } else if (!res.label) {
          if (!autre || dd < autre.dd) autre = { lat: res.lat, lng: res.lng, score: c.score, dd, src: res.src };
        }
      }
    }

    // 3. Vraie voie (Rue/Avenue/Chaussée…) → précise telle quelle
    const VOIE = /^(rue|avenue|chauss|boulevard|dreve|clos|quai|impasse|allee|chemin|venelle|sentier|drève|allée)/;
    if (nomme && VOIE.test(sansAccent(nomme.label || ''))) {
      retenu = 'voie : ' + nomme.label;
      return finalize({ lat: nomme.lat, lng: nomme.lng, score: nomme.score, source: nomme.src });
    }

    // 4. Repli OSM/Nominatim (POI église/parvis 90, lieux-dits 80, libellé brut 70)
    const viaNominatim = async () => {
      const reqs = [];
      const co = ', ' + g.communeFR + ', Belgique';
      if (/\bst\b|\bste\b|saint|sint|eglise|kerk|paulus|rochus|parvis|voorpl/.test(sansAccent(g.quartier))) {
        // église/parvis bilingue : on essaie Saint ET Sint (expandToken + produit cartésien)
        const opts = (basesQuartier(g.quartier)[0] || g.quartier).split(' ')
          .map(t => t.replace(/(voorplein|voorpl|voorp|plein|kerk)$/i, ''))
          .filter(t => t && !/^(parvis|voorplein|voorpl|voorp)$/i.test(t)).slice(0, 3)
          .map(expandToken);
        produitTokens(opts).forEach(seq => {
          const nom = seq.join(' ');
          if (nom) reqs.push({ q: 'Église ' + nom + co, score: 90 }, { q: nom.replace(/\s+/g, '') + 'kerk' + co, score: 90 });
        });
      }
      basesQuartier(g.quartier).forEach(b => {
        const w = b.split(' ').map(normToken);
        reqs.push({ q: w.join(' ') + co, score: 80 });
        if (w.length > 2) { reqs.push({ q: w.slice(0, 2).join(' ') + co, score: 80 }); reqs.push({ q: w.slice(-2).join(' ') + co, score: 80 }); }
      });
      reqs.push({ q: g.quartier + co, score: 70 });
      essais.push(...reqs.map(r => 'OSM:' + r.q));
      const seen = new Set();
      for (const r of reqs) {
        const k = r.q.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        const pt = await geocodeNominatim(r.q);
        if (ok(pt)) return { lat: pt.lat, lng: pt.lng, score: r.score, source: 'osm' };
      }
      return fallback();
    };

    // 5. Décisions finales : place≈OSM (coïncidence) / lieu-dit OSM / plus proche / centre commune
    const osm = await viaNominatim();
    const osmOk = osm && osm.score >= 70;
    if (nomme && osmOk) {
      const ecart = Math.round(distanceKm(nomme, osm) * 1000);
      if (ecart < 120) { retenu = 'place≈OSM : ' + nomme.label; return finalize({ lat: nomme.lat, lng: nomme.lng, score: Math.max(nomme.score, 85), ecart, source: nomme.src }); }
      retenu = 'lieu-dit OSM (écart ' + ecart + ' m)'; return finalize(Object.assign({}, osm, { ecart }));
    }
    if (osmOk) { retenu = 'lieu-dit / POI OSM'; return finalize(osm); }
    const b = nomme || autre;
    if (b) { retenu = nomme ? ('voie : ' + nomme.label) : 'plus proche du centre'; return finalize({ lat: b.lat, lng: b.lng, score: b.score, source: b.src }); }
    return finalize(osm);

  } catch (err) {
    retenu = 'erreur exécution';   // pas de crash sur le terrain (perte réseau, etc.)
    return finalize(null);
  }
}


// Affiche/masque la carte de gestion du planning selon l'état, puis (re)construit
// sélecteur + filtres + carte + tableau de référence. Appelée par le script
// consommateur (chargerPlanningsConvertisseur) après (re)lecture du stockage.
function majPlanMgmt() {
  const card = document.getElementById('planMgmtCard');
  if (!card) return;
  card.style.display = _plans.length ? '' : 'none';
  // La carte (registre + _planRows) est déjà rafraîchie par onChangePlanning() ;
  // ici on ne fait qu'afficher la carte de gestion et (ré)initialiser Leaflet.
  if (_plans.length) initPlanning();
}

// Le script consommateur a déjà tourné (majPlanMgmt était alors indéfini) :
// on relance une fois maintenant que tout le sous-système est défini.
if (typeof chargerPlanningsConvertisseur === 'function') chargerPlanningsConvertisseur();

