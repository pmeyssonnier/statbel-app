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
  if (settings.provider === 'osm') {
    hint.textContent = t('hint_prov_osm');
  } else if (settings.provider === 'auto') {
    hint.textContent = t('hint_prov_auto');
  } else {
    hint.textContent = t('hint_prov_be');
  }
  hint.style.color = settings.provider === 'osm' ? '#e65100' : '#2e7d32';
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

// ── Éditeur de statuts ──────────────────────────────────────────────
export function renderStatutsEditor() {
  const box = document.getElementById('statutsEditor');
  if (!box) return;
  box.innerHTML = settings.statuts.map((s, i) => `
    <div class="statut-edit-row">
      <input type="color" value="${s.color}" onchange="modifierStatut(${i},'color',this.value)" title="${t('ed_color')}">
      <input type="text" class="se-icon" value="${esc(s.icon)}" maxlength="2" onchange="modifierStatut(${i},'icon',this.value)" title="${t('ed_icon')}">
      <input type="text" class="se-label" value="${esc(statutLabel(s.label))}" onchange="modifierStatut(${i},'label',this.value)" title="${t('ed_label')}">
      <label class="se-flag" title="${esc(t('flag_done_title'))}"><input type="checkbox" ${s.done?'checked':''} onchange="modifierStatut(${i},'done',this.checked)"> ✓</label>
      <label class="se-flag" title="${esc(t('flag_realise_title'))}"><input type="checkbox" ${s.realise?'checked':''} onchange="modifierStatut(${i},'realise',this.checked)"> 🎤</label>
      <label class="se-flag" title="${esc(t('flag_rdv_title'))}"><input type="checkbox" ${s.rdv?'checked':''} onchange="modifierStatut(${i},'rdv',this.checked)"> 📅</label>
      <button class="se-del" onclick="supprimerStatut(${i})" title="${t('del_status_title')}" aria-label="${esc(t('del_status_title'))}"${settings.statuts.length<=1?' disabled':''}>🗑️</button>
    </div>`).join('');
}

export function modifierStatut(idx, field, value) {
  const st = settings.statuts[idx];
  if (!st) return;
  if (field === 'label') {
    const old = st.label, nw = (value || '').trim() || old;
    if (nw !== old) {
      // Migrer les contacts existants vers le nouveau libellé (statut courant
      // ET historique, sinon les entrées d'historique deviennent orphelines).
      Object.values(enquetes).forEach(arr => arr.forEach(c => {
        if ((c.statut || '') === old) c.statut = nw;
        if (Array.isArray(c.historique)) c.historique.forEach(h => { if (h.statut === old) h.statut = nw; });
      }));
      if (filtreActif === old) filtreActif = nw;
      st.label = nw;
      sauver();
    }
  } else {
    st[field] = value;
  }
  saveSettings();
  rafraichirStatutsVues();
}

export function ajouterStatut() {
  settings.statuts.push({ label:'Nouveau', color:'#607d8b', icon:'•', done:false, rdv:false, realise:false });
  saveSettings();
  renderStatutsEditor();
  rafraichirStatutsVues();
}

export function supprimerStatut(idx) {
  if (settings.statuts.length <= 1) return;
  const st    = settings.statuts[idx];
  // Statut de repli = premier statut restant après suppression
  const cible = (settings.statuts[idx === 0 ? 1 : 0] || {}).label;
  if (!confirm(tf('cf_del_status', { label: statutLabel(st.label), cible: statutLabel(cible) }))) return;
  settings.statuts.splice(idx, 1);
  // Migration : réassigner les contacts orphelins (toutes enquêtes) vers le repli
  const repli = statutDefaut();   // = settings.statuts[0].label après splice
  let migres = 0;
  Object.values(enquetes).forEach(arr => arr.forEach(c => {
    if ((c.statut || '') === st.label) { c.statut = repli; migres++; }
    // Migrer aussi les entrées d'historique vers le statut de repli
    if (Array.isArray(c.historique)) c.historique.forEach(h => { if (h.statut === st.label) { h.statut = repli; migres++; } });
  }));
  if (filtreActif === st.label) filtreActif = 'Tous';
  if (migres) sauver();
  saveSettings();
  renderStatutsEditor();
  rafraichirStatutsVues();
}
