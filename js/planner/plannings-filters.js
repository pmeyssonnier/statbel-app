/*
 * js/planner/plannings-filters.js — Planner : SOURCE (lecture des plannings du stockage
 * partage localStorage['plannings'], conversion, agregation des trimestres, deduplication,
 * badge « N groupe(s) », menu du bandeau) et FILTRES (cascade province -> commune -> quartier,
 * trimestre, selection de groupes, « Tout »). Extrait verbatim du <script> du Planner. Script
 * CLASSIQUE : globales partagees du coeur ; fonctions appelees via onclick=/onchange=.
 */
// ══════════════════════════════════════════════════════════════════════
//  SOURCE : plannings du stockage partagé localStorage['plannings']
// ══════════════════════════════════════════════════════════════════════
// Les plannings trimestriels LFS sont persistés dans localStorage['plannings'] :
// [{ id, nom, type, rows:[{code,prov,commune,quartier,wave,sem,start,stop}],
// grp, embedded }]. Ils sont désormais importés ici même (sous-système Planning
// déplacé du Convertisseur) ; le Convertisseur relit ce même stockage pour son
// annexe « Aperçu » (lien GRP↔LFS conservé via l'index « grp »).

// Convertit un planning du Convertisseur en groupes du Planner
// ({province,numero,commune,quartier,vagues:[{idx,sem,start,stop}]}).
function planningVersRows(p) {
  const byCode = new Map();
  (p.rows || []).forEach(r => {
    const code = String(r.code || '').trim();
    if (!code) return;
    let g = byCode.get(code);
    if (!g) {
      g = { province: String(r.prov || '').trim(), numero: code,
            commune: String(r.commune || '').trim(), lettre: '',
            quartier: String(r.quartier || '').trim(), nInterro: 0,
            source: p.nom, vagues: [] };
      byCode.set(code, g);
    }
    const idx   = parseInt(r.wave) || (g.vagues.length + 1);
    const start = parseDate(r.start), stop = parseDate(r.stop);
    if (start && stop)
      g.vagues.push({ idx, sem: parseInt(String(r.sem).replace(/\.0$/, '')) || idx, start, stop });
  });
  const rows = [...byCode.values()];
  rows.forEach(g => { g.vagues.sort((a, b) => a.idx - b.idx); g.nInterro = g.vagues.length; });
  return rows.filter(g => g.vagues.length);
}

// Charge (ou recharge) la liste des plannings depuis le Convertisseur.
function chargerPlanningsConvertisseur() {
  let imp = [];
  try { imp = JSON.parse(localStorage.getItem('plannings') || '[]'); } catch (e) { imp = []; }
  // Ne garder que les plannings exploitables (au moins un groupe avec des vagues)
  _plans = imp.filter(p => p && p.id)
              .map(p => ({ id: p.id, nom: p.nom || p.id, rows: planningVersRows(p) }))
              .filter(p => p.rows.length);

  const card = document.getElementById('planCard');   // invite (aucun planning)
  const sel  = document.getElementById('selPlanning');
  if (!_plans.length) {
    // Comme #sourceSelect du Convertisseur : sélecteur masqué quand vide.
    sel.style.display = 'none'; sel.innerHTML = '';
    card.style.display = '';                           // affiche l'invite
    allRows = []; filtered = [];
    document.getElementById('filterCard').style.display = 'none';
    document.getElementById('agendaCard').style.display = 'none';
    const ae = document.getElementById('agendaEmpty'); if (ae) ae.style.display = '';   // invite onglet Agenda
    if (typeof majPlanMgmt === 'function') majPlanMgmt();   // masque la carte de gestion
    return;
  }
  { const ae = document.getElementById('agendaEmpty'); if (ae) ae.style.display = 'none'; }
  card.style.display = 'none'; sel.style.display = '';  // masque l'invite

  const prev = sel.value;                       // préserver le choix courant si possible
  const opts = [];
  if (_plans.length > 1)
    opts.push(`<option value="__ALL__">${tf('sel_all_quarters', { n: _plans.length })}</option>`);
  _plans.forEach(p => opts.push(`<option value="${esc(p.id)}">${esc(p.nom)}</option>`));
  sel.innerHTML = opts.join('');
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  if (typeof chargerRegistrePlannings === 'function') chargerRegistrePlannings();  // _plannings prêt pour la carte
  onChangePlanning();                                     // agenda + carte (même trimestre)
  if (typeof majPlanMgmt === 'function') majPlanMgmt();   // affiche la carte de gestion + initPlanning
}

// Applique le trimestre choisi (ou « Tout ») → allRows + filtres + agenda.
function onChangePlanning() {
  const sel = document.getElementById('selPlanning');
  const id  = sel ? sel.value : '';
  const src = id === '__ALL__' ? _plans : _plans.filter(p => p.id === id);
  // Agréger en dédupliquant par numéro de groupe (dernier trimestre gagne)
  const map = new Map();
  src.forEach(p => p.rows.forEach(g => map.set(g.numero, g)));
  allRows  = [...map.values()];
  selected = new Set([...selected].filter(n => map.has(n)));   // garder la sélection valide
  filtered = allRows.slice();

  populateFilters();      // → cascade filtres → applyFilters → majBadgeGroupes
  document.getElementById('filterCard').style.display = allRows.length ? '' : 'none';
  renderGroupsList();
  updateAgenda();

  // Le sélecteur du header pilote aussi la carte de l'onglet Planning (même trimestre).
  _planActif = (id === '__ALL__') ? '__ALL__' : id;
  if (typeof appliquerPlanningActif === 'function') { appliquerPlanningActif(); filtrerPlanning(); }
  // La candidature reprend le trimestre sélectionné (titre « EFT 2026-Tx »).
  if (typeof syncCandSurvey === 'function') syncCandSurvey();
}

// Badge « N groupe(s) » : dépend des filtres (province/commune/quartier/recherche)
// et de la sélection. Affiche le nb de groupes filtrés + le nb sélectionnés.
function majBadgeGroupes() {
  const info = document.getElementById('planInfo');
  if (!info) return;
  const tot = filtered.length, sel = selected.size;
  info.innerHTML = `<div class="file-chip">📊 ${tot} ${esc(t('cand_groupes_word'))}`
    + (sel ? tf('js_selected_suffix',{n:sel}) : '') + `</div>`;
}

// Menu ⋮ du bandeau (même comportement que Interviews / Convertisseur).
function toggleKebab() { document.getElementById('kebabMenu').classList.toggle('open'); }
document.addEventListener('click', e => {
  const wrap = document.querySelector('.kebab-wrap');
  if (wrap && !wrap.contains(e.target)) document.getElementById('kebabMenu').classList.remove('open');
});

// ══════════════════════════════════════════════════════════════════════
//  FILTRES
// ══════════════════════════════════════════════════════════════════════
function getSelValues(id) {
  return Array.from(document.getElementById(id).selectedOptions).map(o => o.value);
}

// ── Filtrage en cascade ───────────────────────────────────────────────
// Province → filtre les communes disponibles
// Province + Commune → filtre les quartiers disponibles
// Les 3 → filtre les groupes
// Chaque select ne montre que ce qui existe dans le contexte des sélections parentes.

function populateFilters() {
  // Province : sélection UNIQUE (liste déroulante, une ligne). Valeur = code brut
  // (BRU…), libellé = nom complet (Bruxelles…). Défaut : Bruxelles (BRU) si présent.
  const provs = [...new Set(allRows.map(r => r.province))]
    .sort((a, b) => provLabel(a).localeCompare(provLabel(b), 'fr', { sensitivity: 'base' }));
  const sel  = document.getElementById('selProvince');
  const prev = sel.value;
  sel.innerHTML = provs.map(v =>
    `<option value="${esc(v)}">${esc(provLabel(v))}</option>`
  ).join('');
  // Conserver le choix précédent s'il existe encore, sinon Bruxelles, sinon 1er.
  if (prev && provs.includes(prev)) sel.value = prev;
  else if (provs.includes('BRU')) sel.value = 'BRU';
  cascadeCommune();
}

// onchange Province → recalcule Commune puis Quartier puis groupes
function onChangeProvince() {
  cascadeCommune();
}

// onchange Commune → recalcule Quartier puis groupes
function onChangeCommune() {
  cascadeQuartier();
}

// onchange Quartier → recalcule groupes uniquement
function onChangeQuartier() {
  applyFilters();
}

function cascadeCommune() {
  const provs = getSelValues('selProvince');
  // Communes disponibles selon les provinces sélectionnées (ou toutes si aucune)
  const base = provs.length ? allRows.filter(r => provs.includes(r.province)) : allRows;
  const comms = [...new Set(base.map(r => r.commune))].sort();
  // Conserver les sélections encore valides
  const prevComms = getSelValues('selCommune').filter(v => comms.includes(v));
  fillSelect('selCommune', comms, prevComms, communeLabel);
  cascadeQuartier();
}

function cascadeQuartier() {
  const provs = getSelValues('selProvince');
  const comms = getSelValues('selCommune');
  let base = allRows;
  if (provs.length) base = base.filter(r => provs.includes(r.province));
  if (comms.length) base = base.filter(r => comms.includes(r.commune));
  const quarts = [...new Set(base.map(r => r.quartier))].sort();
  const prevQ = getSelValues('selQuartier').filter(v => quarts.includes(v));
  fillSelect('selQuartier', quarts, prevQ);
  applyFilters();
}

function fillSelect(id, items, selected, fmt) {
  const label = typeof fmt === 'function' ? fmt : (v => v);
  const sel = document.getElementById(id);
  sel.innerHTML = items.map(v =>
    `<option value="${esc(v)}"${selected && selected.includes(v) ? ' selected' : ''}>${esc(label(v))}</option>`
  ).join('');
}

function applyFilters() {
  const provs  = getSelValues('selProvince');
  const comms  = getSelValues('selCommune');
  const quarts = getSelValues('selQuartier');
  const q = document.getElementById('searchGrp').value.toLowerCase().trim();

  // Si aucun filtre actif → tous les groupes visibles
  filtered = allRows.filter(r => {
    if (provs.length  && !provs.includes(r.province))  return false;
    if (comms.length  && !comms.includes(r.commune))   return false;
    if (quarts.length && !quarts.includes(r.quartier)) return false;
    if (q && !r.numero.includes(q) &&
        !r.quartier.toLowerCase().includes(q) &&
        !r.commune.toLowerCase().includes(q)) return false;
    return true;
  });

  renderGroupsList();
  majBadgeGroupes();          // le badge dépend des filtres
}

function renderGroupsList() {
  const el = document.getElementById('groupsSelected');
  if (!filtered.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--ink3);padding:6px 0">'+esc(t('js_no_group_match'))+'</div>';
    return;
  }
  // Tri croissant par numéro de groupe
  const sorted = [...filtered].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
  el.innerHTML = sorted.map(r => {
    const on = selected.has(r.numero);
    // n° de groupe = donnée importée : jamais interpolée dans un onclick (→ data-num
    // échappé + écouteur délégué) ni injectée sans esc() (protection XSS).
    // Puce = <button> : focusable et activable au clavier (Entrée/Espace natif),
    // état de sélection annoncé au lecteur d'écran via aria-pressed.
    return `<button type="button" class="grp-tag" data-num="${esc(r.numero)}" aria-pressed="${on ? 'true' : 'false'}"
      style="${on?'':'background:var(--bg);color:var(--ink2);border:1px solid var(--border);'}">
      <span>${esc(r.numero)}</span>
      <span class="gt-qtier">${esc(r.quartier.split(' ').slice(0,3).join(' '))}</span>
      ${on?'<span style="color:#4caf50;font-weight:700" aria-hidden="true">✓</span>':''}
    </button>`;
  }).join('');
  // Écouteur délégué (réassigné à chaque rendu, donc pas de doublon).
  el.onclick = e => { const tag = e.target.closest('.grp-tag'); if (tag) toggleGroup(tag.dataset.num); };
}

// Trier les options d'un select sans perdre les sélections
function sortSelect(id, dir) {
  const sel = document.getElementById(id);
  const selected = new Set(Array.from(sel.selectedOptions).map(o => o.value));
  const opts = Array.from(sel.options).map(o => ({ v: o.value, t: o.text }));
  opts.sort((a, b) => dir === 'asc'
    ? a.t.localeCompare(b.t, 'fr', { sensitivity: 'base' })
    : b.t.localeCompare(a.t, 'fr', { sensitivity: 'base' }));
  sel.innerHTML = opts.map(o =>
    `<option value="${esc(o.v)}"${selected.has(o.v) ? ' selected' : ''}>${esc(o.t)}</option>`
  ).join('');
}

function toggleGroup(num) {
  if (selected.has(num)) selected.delete(num);
  else selected.add(num);
  renderGroupsList();
  updateAgenda();
}

function selectAll() {
  filtered.forEach(r => selected.add(r.numero));
  renderGroupsList();
  updateAgenda();
}

function clearAll() {
  selected.clear();
  renderGroupsList();
  updateAgenda();
}

function updateAgenda() {
  const count = selected.size;
  // Pastille de comptage sur l'onglet Agenda (masquée quand aucune sélection).
  const b = document.getElementById('agendaCount');
  if (b) { b.textContent = count; b.hidden = count === 0; }
  const tab = document.getElementById('tab-agenda');
  if (tab) tab.setAttribute('data-tip', count ? tf('js_agenda_count',{n:count}) : t('tab_agenda'));
  majBadgeGroupes();                                   // le badge dépend de la sélection
  const card = document.getElementById('agendaCard');
  if (count === 0) {
    card.style.display = 'none';
    if (typeof updateCandidaturePreview === 'function') updateCandidaturePreview();
    return;
  }
  card.style.display = '';
  renderView();
  if (typeof updateCandidaturePreview === 'function') updateCandidaturePreview();
}
