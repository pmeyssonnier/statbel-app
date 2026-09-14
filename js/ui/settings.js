/*
 * js/ui/settings.js — Panneau Paramètres : thème (clair/sombre/auto), police &
 * taille, ouverture/fermeture de la modale, récap données, et éditeur de
 * statuts (couleur/icône/label/drapeaux, ajout/suppression). Extrait de
 * js/app.js (modules ES).
 *
 * Imports : esc (util) ; t, tf (i18n) ; statutLabel (canon). Le reste
 * (settings, enquetes, saveSettings, sauver, rendu, renderFilters,
 * rafraichirStatutsVues, renderNonTraduits, etc.) est global (pont).
 */
import { esc } from '../core/util.js';
import { t, tf } from '../core/i18n.js';
import { statutLabel } from '../data/canon.js';
import { estCatiCawi } from '../data/collect-method.js';



// ── Thème (clair / sombre / auto) ───────────────────────────────────
export function appliquerTheme() {
  let dark = settings.theme === 'dark';
  if (settings.theme === 'auto')
    dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark', dark);
}
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settings.theme === 'auto') appliquerTheme();
  });
}

// ── Police et taille des caractères ─────────────────────────────────
export const FONT_FAMILIES = {
  system:    `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`,
  arial:     `Arial, Helvetica, sans-serif`,
  georgia:   `Georgia, "Times New Roman", serif`,
  verdana:   `Verdana, Geneva, sans-serif`,
  monospace: `"Courier New", Consolas, monospace`,
};
// Facteurs d'échelle : la CSS utilise des tailles en px figées, donc on agrandit
// tout via un « zoom » (échelle proportionnelle) — bien plus visible.
export const FONT_SIZES = {
  small:  0.9,
  normal: 1,
  large:  1.2,
  xlarge: 1.4,
};
export function appliquerPolice() {
  const fam   = FONT_FAMILIES[settings.fontFamily] || FONT_FAMILIES.system;
  const scale = FONT_SIZES[settings.fontSize] ?? FONT_SIZES.normal;
  document.documentElement.style.setProperty('--app-font', fam);
  // Échelle globale : zoom (Chromium/Edge/Safari) avec repli sur la taille de
  // police racine pour les navigateurs sans zoom.
  document.body.style.zoom = scale;
  document.documentElement.style.fontSize = (14 * scale) + 'px';
  // La taille du texte reflow les barres → réancrer la courbe de progression
  if (typeof redessinerCourbeApresLayout === 'function') redessinerCourbeApresLayout();
}

// ── Panneau Paramètres ──────────────────────────────────────────────
export function ouvrirSettings() {
  document.getElementById('setLang').value       = settings.lang;
  document.getElementById('setTheme').value      = settings.theme;
  document.getElementById('setFontFamily').value = settings.fontFamily;
  document.getElementById('setFontSize').value   = settings.fontSize;
  { const e = document.getElementById('setCsvSep'); if (e) e.value = settings.csvSep || 'auto'; }
  { const e = document.getElementById('setCawiUrl'); if (e) e.value = settings.cawiUrl || ''; }
  { const e = document.getElementById('setReminderSignature'); if (e) e.value = settings.reminderSignature || ''; }
  { const e = document.getElementById('setReminderSignatureShort'); if (e) e.value = settings.reminderSignatureShort || ''; }
  { const e = document.getElementById('setReminderIncludePwd'); if (e) e.checked = settings.reminderIncludePwd !== false; }
  const rt = settings.reminderTemplates || {};
  document.querySelectorAll('[data-reminder-field]').forEach(e => {
    e.value = rt[e.dataset.reminderField] || '';
  });
  { const e = document.getElementById('setPayHousehold'); if (e) e.value = settings.paieMenage || ''; }
  { const e = document.getElementById('setPayPerson'); if (e) e.value = settings.paiePersonne || ''; }
  document.getElementById('setProvider').value = settings.provider;
  document.getElementById('setMapStyle').value = settings.mapStyle;
  document.getElementById('setNav').value      = settings.navMode;
  renderStatutsEditor();
  majSettingsUI();
  majPinUI();
  majLastBackupInfo();
  document.getElementById('modalSettings').classList.add('open');
}

export function fermerSettings() { document.getElementById('modalSettings').classList.remove('open'); }

export function majSettingsUI() {
  // Le style de carte ne concerne qu'UrbIS (Bruxelles)
  // Le style gris/couleur ne concerne qu'UrbIS (mode Bruxelles explicite)
  document.getElementById('setStyleRow').style.display = settings.provider === 'bruxelles' ? '' : 'none';
  const hint = document.getElementById('setProviderHint');
  hint.textContent = settings.provider === 'auto' ? t('hint_prov_auto') : t('hint_prov_be');
  hint.style.color = '#2e7d32';
  // Stats données
  const nbEnq = Object.keys(enquetes).length;
  const nbCnt = Object.values(enquetes).reduce((s,a)=>s+a.length,0);
  const nbCoords = Object.keys(localStorage).filter(k=>k.startsWith('coords_')).length;
  document.getElementById('dataStats').textContent =
    tf('data_stats', { e: nbEnq, c: nbCnt, g: nbCoords });
  document.getElementById('i18nMissing').innerHTML = renderNonTraduits();
  // Sélecteur de portée pour la purge du cache : « toutes » + chaque enquête
  const sel = document.getElementById('viderCacheScope');
  if (sel) {
    const prev = sel.value;
    const noms = Object.keys(enquetes);
    sel.innerHTML = `<option value="__all__">${t('res_allsurveys')}</option>`
      + noms.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    sel.value = (prev && [...sel.options].some(o => o.value === prev))
      ? prev : (enqueteActive && noms.includes(enqueteActive) ? enqueteActive : '__all__');
  }
}

// ── Éditeur de statuts (cloisonné par enquête) ──────────────────────
// Le vocabulaire édité est celui de l'enquête active (settings.statutsParEnquete),
// semé à la volée depuis le modèle au 1er changement. Les re-mappages de contacts
// ne concernent alors QUE l'enquête active. Sans enquête active, on édite le modèle
// global et on ne re-mappe que les enquêtes qui en dépendent (repli).
function cibleStatuts() {
  if (enqueteActive) {
    const m = settings.statutsParEnquete || (settings.statutsParEnquete = {});
    if (!Array.isArray(m[enqueteActive]) || !m[enqueteActive].length)
      m[enqueteActive] = statutsActifs().map(s => ({ ...s }));   // clone du modèle
    return { arr: m[enqueteActive], remap: [enqueteActive], set: nx => { m[enqueteActive] = nx; } };
  }
  return {
    arr: settings.statuts,
    remap: Object.keys(enquetes).filter(n => statutsPourEnquete(n) === settings.statuts),
    set: nx => { settings.statuts = nx; },
  };
}
// Applique une réécriture de libellé/repli aux contacts (statut courant + historique)
// des seules enquêtes visées. Renvoie le nombre d'entrées migrées.
function remapContacts(noms, fn) {
  let migres = 0;
  noms.forEach(n => (enquetes[n] || []).forEach(c => {
    const nv = fn(c.statut || '');
    if (nv !== undefined && nv !== (c.statut || '')) { c.statut = nv; migres++; }
    if (Array.isArray(c.historique)) c.historique.forEach(h => {
      const hv = fn(h.statut || '');
      if (hv !== undefined && hv !== (h.statut || '')) { h.statut = hv; migres++; }
    });
  }));
  return migres;
}

export function renderStatutsEditor() {
  const box = document.getElementById('statutsEditor');
  if (!box) return;
  const arr = statutsActifs();
  box.innerHTML = arr.map((s, i) => `
    <div class="statut-edit-row">
      <input type="color" value="${s.color}" data-act="modifierStatut" data-idx="${i}" data-field="color" title="${t('ed_color')}">
      <input type="text" class="se-icon" value="${esc(s.icon)}" maxlength="2" data-act="modifierStatut" data-idx="${i}" data-field="icon" title="${t('ed_icon')}">
      <input type="text" class="se-label" value="${esc(statutLabel(s.label))}" data-act="modifierStatut" data-idx="${i}" data-field="label" title="${t('ed_label')}">
      <label class="se-flag" title="${esc(t('flag_done_title'))}"><input type="checkbox" ${s.done?'checked':''} data-act="modifierStatut" data-idx="${i}" data-field="done"> ✓</label>
      <label class="se-flag" title="${esc(t('flag_realise_title'))}"><input type="checkbox" ${s.realise?'checked':''} data-act="modifierStatut" data-idx="${i}" data-field="realise"> 🎤</label>
      <label class="se-flag" title="${esc(t('flag_rdv_title'))}"><input type="checkbox" ${s.rdv?'checked':''} data-act="modifierStatut" data-idx="${i}" data-field="rdv"> 📅</label>
      <button class="se-del" data-act="supprimerStatut" data-idx="${i}" title="${t('del_status_title')}" aria-label="${esc(t('del_status_title'))}"${arr.length<=1?' disabled':''}>🗑️</button>
    </div>`).join('');
}

export function modifierStatut(idx, field, value) {
  const cible = cibleStatuts();
  const st = cible.arr[idx];
  if (!st) return;
  if (field === 'label') {
    const old = st.label, nw = (value || '').trim() || old;
    if (nw !== old) {
      // Migrer les contacts des enquêtes visées vers le nouveau libellé (statut
      // courant ET historique, sinon les entrées d'historique deviennent orphelines).
      const migres = remapContacts(cible.remap, s => s === old ? nw : undefined);
      if (filtreActif === old) filtreActif = nw;
      st.label = nw;
      if (migres) sauver();
    }
  } else {
    st[field] = value;
  }
  saveSettings();
  rafraichirStatutsVues();
}

export function ajouterStatut() {
  cibleStatuts().arr.push({ label:'Nouveau', color:'#607d8b', icon:'•', done:false, rdv:false, realise:false });
  saveSettings();
  renderStatutsEditor();
  rafraichirStatutsVues();
}

// ── Préréglages de statuts prêts à l'emploi ─────────────────────────
// « cati » reprend les 6 valeurs de la feuille de contact EFT (CATI). `from`
// re-mappe les statuts par défaut (libellés canoniques EN) vers l'équivalent
// CATI, pour préserver le suivi existant lors de la bascule.
export const STATUT_PRESETS = {
  capi: {
    i18nLabel: 'preset_capi',
    statuts: [
      { label:'To do',       color:'#90a4ae', icon:'✕',  done:false, rdv:false, realise:false },
      { label:'In progress', color:'#f9a825', icon:'⏳', done:false, rdv:true,  realise:false },
      { label:'Done',        color:'#2e7d32', icon:'✓',  done:true,  rdv:false, realise:true  },
      { label:'Absent',      color:'#a1887f', icon:'⊘',  done:true,  rdv:false, realise:false },
      { label:'Refusal',     color:'#c62828', icon:'✗',  done:true,  rdv:false, realise:false },
      { label:'Moved',       color:'#6a1b9a', icon:'📦', done:true,  rdv:false, realise:false },
    ],
    from: {
      'Pas encore de contact entrepris':      'To do',
      'Rdv fixé':                             'In progress',
      'Interview réalisée':                   'Done',
      'Tentatives de contacts sans résultat': 'Absent',
      'Négatif':                              'Refusal',
      'Inconnu':                              'To do',
    },
  },
  cati: {
    i18nLabel: 'preset_cati',
    statuts: [
      { label:'Pas encore de contact entrepris',      color:'#90a4ae', icon:'•',  done:false, rdv:false, realise:false },
      { label:'Rdv fixé',                              color:'#f9a825', icon:'📅', done:false, rdv:true,  realise:false },
      { label:'Tentatives de contacts sans résultat',  color:'#fb8c00', icon:'🔁', done:false, rdv:false, realise:false },
      { label:'Négatif',                               color:'#c62828', icon:'✗',  done:true,  rdv:false, realise:false },
      { label:'Interview réalisée',                    color:'#2e7d32', icon:'✓',  done:true,  rdv:false, realise:true  },
      { label:'Inconnu',                               color:'#607d8b', icon:'❓', done:false, rdv:false, realise:false },
    ],
    from: {
      'To do':       'Pas encore de contact entrepris',
      'In progress': 'Rdv fixé',
      'Done':        'Interview réalisée',
      'Absent':      'Tentatives de contacts sans résultat',
      'Refusal':     'Négatif',
      'Moved':       'Négatif',
      'Impossible':  'Inconnu',
    },
  },
};

// Applique un préréglage : remplace la liste des statuts et re-mappe les
// contacts existants (statut courant + historique) vers les nouveaux libellés
// via `from`, sinon vers le 1er statut (repli) — aucun historique orphelin.
export function appliquerPresetStatuts(key) {
  const preset = STATUT_PRESETS[key];
  if (!preset) return;
  const nom = enqueteActive || '';
  // Le message de confirmation nomme l'enquête visée pour éviter toute méprise.
  if (!confirm(tf('cf_preset_statuts', { name: t(preset.i18nLabel), survey: nom || t('res_allsurveys') }))) return;
  poserPresetStatuts(key);
}

// Cœur du préréglage, SANS confirmation : remplace le vocabulaire de l'enquête
// active (cibleStatuts) et re-mappe ses contacts (statut courant + historique)
// via `from`, sinon vers le 1er statut. Utilisé par le bouton (avec confirm) et
// par la déduction automatique à l'import (silencieux).
function poserPresetStatuts(key) {
  const preset = STATUT_PRESETS[key];
  if (!preset) return;
  const cible = cibleStatuts();
  const nouveaux = preset.statuts.map(s => ({ ...s }));
  const connus = new Set(nouveaux.map(s => s.label));
  const repli = nouveaux[0].label;
  const remap = old => (!old || connus.has(old)) ? old : ((preset.from && preset.from[old]) || repli);
  const migres = remapContacts(cible.remap, s => connus.has(s) ? undefined : remap(s));
  cible.set(nouveaux);
  if (filtreActif !== 'Tous' && !connus.has(filtreActif)) filtreActif = remap(filtreActif);
  if (migres) sauver();
  saveSettings();
  renderStatutsEditor();
  rafraichirStatutsVues();
}

// Déduit le préréglage de statuts d'une enquête NEUVE d'après la méthode de
// collecte des fiches importées : ≥1 fiche CATI/CAWI → préréglage « feuille de
// contact CATI » ; sinon aucune méthode (vague 1 CAPI) → défaut CAPI (no-op).
// L'enquête active doit déjà être l'enquête créée (enqueteActive = nom).
// La classification CATI/CAWI vient du module métier unique collect-method.js.
export function deduirePresetStatuts(nom, rows) {
  if (!(rows || []).some(c => estCatiCawi(c && c.collect_method))) return;
  poserPresetStatuts('cati');
  if (typeof afficherToast === 'function')
    afficherToast(tf('toast_preset_auto', { name: t(STATUT_PRESETS.cati.i18nLabel) }), 5000);
}

export function supprimerStatut(idx) {
  const cible = cibleStatuts();
  if (cible.arr.length <= 1) return;
  const st    = cible.arr[idx];
  // Statut de repli = premier statut restant après suppression
  const replLabel = (cible.arr[idx === 0 ? 1 : 0] || {}).label;
  if (!confirm(tf('cf_del_status', { label: statutLabel(st.label), cible: statutLabel(replLabel) }))) return;
  cible.arr.splice(idx, 1);
  // Migration : réassigner les contacts orphelins (enquêtes visées) vers le repli
  const migres = remapContacts(cible.remap, s => s === st.label ? replLabel : undefined);
  if (filtreActif === st.label) filtreActif = 'Tous';
  if (migres) sauver();
  saveSettings();
  renderStatutsEditor();
  rafraichirStatutsVues();
}
