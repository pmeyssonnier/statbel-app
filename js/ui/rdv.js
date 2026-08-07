/*
 * js/ui/rdv.js — Vue « Suivi / RDV » : filtres par statut, graphe d'activité
 * quotidienne + courbe de progression, et journal chronologique des visites
 * (clic → jour filtré / fiche). Extrait de js/app.js (modules ES).
 *
 * Imports : rendus graphiques (ui/stats) ; esc (util) ; t (i18n) ; statutLabel
 * (canon). L'état (filtreRdv ici en globalThis ; _activiteJour/_journalEvents
 * partagés) et les fonctions applicatives (contacts, enquetes, statutDef(s),
 * sauver, refreshSelect, setView, ouvrirEdit) sont globaux (pont).
 */
import { renderActiviteQuotidienne, renderProgressionGlobale, renderEvenementsChrono,
         dessinerCourbeProgression, collecterVisites } from './stats.js';
import { esc } from '../core/util.js';
import { t } from '../core/i18n.js';
import { statutLabel } from '../data/canon.js';

globalThis.filtreRdv = 'Tous';
// Clic sur une barre du graphe : (dé)sélectionne le jour → filtre le journal
export function filtrerActiviteJour(iso) {
  _activiteJour = (_activiteJour === iso) ? null : iso;
  renduRdv();
}

// Clic sur une ligne du journal → ouvre la fiche du contact correspondant
export function ouvrirFicheEvtIdx(i) {
  const e = _journalEvents[i];
  if (!e) return;
  const arr = enquetes[e.enq] || [];
  const idx = arr.findIndex(c => String(c.ordre) === String(e.ordre) && (c.nom || '') === e.nom && (c.prenom || '') === e.prenom);
  if (idx < 0) return;
  if (enqueteActive !== e.enq) { enqueteActive = e.enq; sauver(); refreshSelect(); }
  filtreActif = 'Tous';
  setView('liste');
  setTimeout(() => { const el = ouvrirEdit(idx); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
}

/** Titre et icône contextuels selon le statut filtré */
export function rdvTitreStatut(label) {
  if (!label || label === 'Tous') return { icon: '📅', titre: t('track_title_plain') };
  const def = statutDef(label);
  const icon = def.icon || '•';
  // Titres sémantiques selon la nature du statut
  if (def.rdv)  return { icon, titre: t('rdv_planned') + ' — ' + statutLabel(label) };
  if (def.done) return { icon, titre: t('rdv_done')    + ' — ' + statutLabel(label) };
  return        { icon, titre: t('rdv_contacts') + ' — ' + statutLabel(label) };
}

export function renderRdvFilters() {
  const bar = document.getElementById('rdvFilters');
  if (!bar) return;

  // Statuts éligibles : tout sauf le premier (= "À faire" = statutDefaut)
  const eligible = statutDefs().filter(s => s.label !== statutDefaut());
  const all = contacts();
  const cpt = {};
  all.forEach(c => { const s = c.statut || statutDefaut(); cpt[s] = (cpt[s]||0)+1; });

  const total = eligible.reduce((acc, s) => acc + (cpt[s.label]||0), 0);
  const on0   = filtreRdv === 'Tous';
  let html = `<button class="filter-btn${on0?' active':''}" onclick="filtrerRdv('Tous')">${t('f_all')} (${total})</button>`;

  eligible.forEach(s => {
    const n  = cpt[s.label] || 0;
    const on = filtreRdv === s.label;
    html += `<button class="filter-btn" style="border-color:${s.color};color:${on?'#fff':s.color};background:${on?s.color:'var(--filter-bg)'}" onclick="filtrerRdv('${s.label.replace(/'/g,"\\'")}')">
      ${s.icon} ${esc(statutLabel(s.label))}${n > 0 ? ' ('+n+')' : ''}
    </button>`;
  });
  bar.innerHTML = html;

  // Titre dynamique
  const { icon, titre } = rdvTitreStatut(filtreRdv);
  const el = document.getElementById('rdvTitle');
  if (el) el.textContent = icon + ' ' + titre;
}

export function filtrerRdv(statut) {
  filtreRdv = statut;
  renduRdv();
}

export function renduRdv() {
  renderRdvFilters();
  const container = document.getElementById('rdvListe');
  container.innerHTML = '';

  const enqAct = enqueteActive;
  const q      = (document.getElementById('rdvSearch')?.value||'').toLowerCase().trim();
  const defaut = statutDefaut();
  const today  = new Date().toISOString().slice(0, 10);

  // ── Graphe d'activité en premier ─────────────────────────────────
  const grapheEl = document.createElement('div');
  grapheEl.className = 'rdv-section-card';
  grapheEl.innerHTML = `<div class="rdv-section-title">📊 ${t('res_activity')}</div>`
    + renderProgressionGlobale(enqAct)
    + renderActiviteQuotidienne(enqAct, filtreRdv).replace(`<div class="resume-section-title">${t('res_activity')}</div>`, '');
  container.appendChild(grapheEl);
  // Courbe de progression (% Fait cumulés) superposée au graphe, en vue non filtrée
  if (!filtreRdv || filtreRdv === 'Tous' || filtreRdv === 'Done') requestAnimationFrame(() => dessinerCourbeProgression(enqAct));

  // ── Journal des événements (briques, filtré par statut + recherche) ──
  const journalEl = document.createElement('div');
  journalEl.className = 'rdv-section-card';
  const evtFiltered = collecterVisites(enqAct).filter(e =>
    (!_activiteJour || e.iso.slice(0, 10) === _activiteJour) &&
    (!filtreRdv || filtreRdv === 'Tous' || e.statut === filtreRdv) &&
    (!q || `${e.prenom} ${e.nom}`.toLowerCase().includes(q) || `${e.nom} ${e.prenom}`.toLowerCase().includes(q))
  );
  // Badge du jour sélectionné (cliquable pour tout réafficher)
  let jourBadge = '';
  if (_activiteJour) {
    const [jy, jm, jd] = _activiteJour.split('-');
    jourBadge = ` <span style="cursor:pointer;color:var(--filter-text);font-weight:600;" onclick="filtrerActiviteJour('${_activiteJour}')">— ${jd}/${jm}/${jy} ✕</span>`;
  }
  journalEl.innerHTML = `<div class="rdv-section-title">🕐 ${t('res_events')} (${evtFiltered.length})${jourBadge}</div>`
    + renderEvenementsChrono(enqAct, true, filtreRdv, q, _activiteJour);
  container.appendChild(journalEl);
}
