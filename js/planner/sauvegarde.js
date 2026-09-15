/*
 * js/planner/sauvegarde.js — Planner : SAUVEGARDE LOCALE (localStorage). sauvegarder(),
 * restaurer(), effacerSauvegarde() (cle lfs_planner_save) et afficherToast(). Extrait verbatim
 * du <script> du Planner. Script CLASSIQUE : globales partagees ; appelees via le menu ⋮.
 * NB : le bootstrap (IIFE init() qui charge les plannings au demarrage) reste inline dans la
 * page, a sa position d'origine, pour preserver l'ordre d'execution.
 */
// ══════════════════════════════════════════════════════════════════════
//  SAUVEGARDE LOCALE (localStorage)
// ══════════════════════════════════════════════════════════════════════
const LS_KEY = 'lfs_planner_save';

// Les données (groupes/vagues) proviennent du Convertisseur : la sauvegarde ne
// mémorise donc que le choix de trimestre, la sélection de groupes et la vue.
function sauvegarder() {
  try {
    const sel = document.getElementById('selPlanning');
    localStorage.setItem(LS_KEY, JSON.stringify({
      date: new Date().toISOString(),
      plan: sel ? sel.value : '',
      selected: Array.from(selected),
      view,
    }));
    afficherToast(t('js_saved'));
  } catch(e) { alert(tf('js_error',{msg:e.message})); }
}

function restaurer() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { alert(t('js_no_backup')); return; }
    const p = JSON.parse(raw);
    const sel = document.getElementById('selPlanning');
    if (sel && p.plan && [...sel.options].some(o => o.value === p.plan)) sel.value = p.plan;
    onChangePlanning();                       // charge le trimestre choisi
    selected = new Set(p.selected || []);     // puis restaure la sélection
    selected = new Set([...selected].filter(n => allRows.some(r => r.numero === n)));
    view = p.view || 'liste';
    renderGroupsList();
    setView(view);
    updateAgenda();
    afficherToast(t('js_restored'));
  } catch(e) { alert(tf('js_error',{msg:e.message})); }
}

function effacerSauvegarde() {
  if (!localStorage.getItem(LS_KEY)) { afficherToast(t('js_no_backup')); return; }
  if (!confirm(t('js_confirm_clear_save'))) return;
  localStorage.removeItem(LS_KEY);
  afficherToast(t('js_save_cleared'));
}

function afficherToast(msg) {
  let t = document.getElementById('lfs-toast');
  if (!t) {
    t = document.createElement('div'); t.id='lfs-toast';
    t.setAttribute('role','status'); t.setAttribute('aria-live','polite');
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'+
      'background:var(--ink);color:#fff;padding:10px 22px;border-radius:20px;'+
      'font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:opacity .2s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity='1';
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>{t.style.opacity='0';},2200);
}
