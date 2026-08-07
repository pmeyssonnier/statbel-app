/*
 * js/features/history.js — Gestion de l'historique des visites d'un contact :
 * tri, synchronisation du statut/date courants (= dernière entrée), et CRUD des
 * entrées (ajout, changement de statut/date/RDV via calendrier, suppression).
 * Extrait de js/app.js (modules ES).
 *
 * Imports : dateFrToISO/dateISOToFr/todayStr/nowHHMM/jourValide (util) ;
 * t/tf (i18n) ; statutLabel (canon). Le reste (contacts, statutDef, settings,
 * sauver, buildHistoriqueHTML, majCarteStatut) est global (pont).
 */
import { dateFrToISO, dateISOToFr, todayStr, nowHHMM, jourValide } from '../core/util.js';
import { t, tf } from '../core/i18n.js';
import { statutLabel } from '../data/canon.js';



/** Rafraîchit le bloc historique en place (sans refermer la fiche en édition) */
export function rafraichirHistorique(i) {
  const el = document.getElementById('hist-' + i);
  if (el) el.outerHTML = buildHistoriqueHTML(contacts()[i], i);
}

/** Trie l'historique par date (+heure) croissante → l'affichage (reverse) est décroissant */
export function trierHistorique(c) {
  if (!Array.isArray(c.historique)) return;
  c.historique.sort((a, b) => {
    const ka = dateFrToISO(a.date) + (a.heure ? 'T' + a.heure : '');
    const kb = dateFrToISO(b.date) + (b.heure ? 'T' + b.heure : '');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** Statut/date courants = dernière entrée (date la plus récente) de l'historique.
 *  On préserve d'abord le statut courant « terminé » non historisé pour ne rien perdre. */
export function syncStatutCourant(c) {
  if (!Array.isArray(c.historique)) return;
  const cd = statutDef(c.statut || '');
  if (c.statut && cd.done && c.date && !c.historique.some(h => h.statut === c.statut && h.date === c.date)) {
    c.historique.push({ statut: c.statut, date: c.date });   // statut importé jamais historisé (à cette date) → on le garde
    trierHistorique(c);
  }
  if (!c.historique.length) return;
  const last = c.historique[c.historique.length - 1];   // trié croissant → dernier = plus récent
  c.statut = last.statut;
  const d = statutDef(last.statut);
  if (d.done)      { c.date = last.date; c.rdv = ''; }
  else if (d.rdv)  { c.date = ''; c.rdv = last.rdv || ''; }
  else             { c.date = ''; c.rdv = ''; }
}

/** Après une modif d'historique : tri + statut/date courants = dernière entrée + rafraîchissements en place */
export function apresModifHistorique(i) {
  const c = contacts()[i];
  trierHistorique(c);
  syncStatutCourant(c);
  sauver();
  rafraichirHistorique(i);
  majCarteStatut(i);
}

/** Ajoute une entrée d'historique (statut = état courant si pertinent, sinon 1er statut "terminé") */
export function ajouterHistorique(i) {
  const c = contacts()[i];
  if (!Array.isArray(c.historique)) c.historique = [];
  const dCur = statutDef(c.statut || '');
  // Archiver d'abord le statut courant « terminé » jamais historisé (ex. importé),
  // sinon il serait perdu quand le statut courant prendra la nouvelle entrée.
  if (c.statut && dCur.done && c.date && !c.historique.some(h => h.statut === c.statut && h.date === c.date)) {
    c.historique.push({ statut: c.statut, date: c.date });
  }
  const defaut = (dCur && (dCur.done || dCur.rdv)) ? c.statut
    : (settings.statuts.find(s => s.done || s.rdv) || settings.statuts[0]).label;
  c.historique.push({ statut: defaut, date: todayStr(), heure: nowHHMM() });
  apresModifHistorique(i);
}

/** Change le statut d'une entrée d'historique */
export function modifierStatutHistorique(i, idx, val) {
  const c = contacts()[i];
  if (!Array.isArray(c.historique) || !c.historique[idx]) return;
  c.historique[idx].statut = val;
  if (!statutDef(val).rdv) delete c.historique[idx].rdv;   // RDV sans objet si statut ≠ rendez-vous
  apresModifHistorique(i);
}

/** Renseigne / efface le RDV d'une entrée (format « jj/mm/aaaa [hh:mm] ») */
export function modifierRdvHistorique(i, idx, val) {
  const c = contacts()[i];
  if (!Array.isArray(c.historique) || !c.historique[idx]) return;
  val = (val || '').trim();
  if (!val) { delete c.historique[idx].rdv; apresModifHistorique(i); return; }
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+([01]\d|2[0-3]):([0-5]\d))?$/);
  if (!m) { alert(t('al_date_invalid')); rafraichirHistorique(i); return; }
  c.historique[idx].rdv = `${m[3]}-${m[2]}-${m[1]}` + (m[4] ? ` ${m[4]}:${m[5]}` : '');
  apresModifHistorique(i);
}

/** Ouvre le calendrier natif pour choisir la date d'une entrée d'historique */
export function ouvrirCalendrierHist(i, idx, fr) {
  const p = document.getElementById('histDatePicker');
  if (!p) return;
  p.value = dateFrToISO(fr) || '';
  p.onchange = function () {
    if (p.value) changerDateHistorique(i, idx, dateISOToFr(p.value));
    p.onchange = null;
  };
  if (typeof p.showPicker === 'function') { try { p.showPicker(); return; } catch (e) {} }
  p.focus(); p.click();
}

/** Ouvre le calendrier date+heure pour le RDV d'une entrée d'historique (rdvIso = « YYYY-MM-DD HH:MM ») */
export function ouvrirCalendrierRdvHist(i, idx, rdvIso) {
  const p = document.getElementById('histRdvPicker');
  if (!p) return;
  p.value = rdvIso ? rdvIso.replace(' ', 'T').slice(0, 16) : '';
  p.onchange = function () {
    const c = contacts()[i];
    if (Array.isArray(c.historique) && c.historique[idx]) {
      if (p.value) c.historique[idx].rdv = p.value.slice(0, 16).replace('T', ' ');
      else delete c.historique[idx].rdv;
      apresModifHistorique(i);
    }
    p.onchange = null;
  };
  if (typeof p.showPicker === 'function') { try { p.showPicker(); return; } catch (e) {} }
  p.focus(); p.click();
}

/** Modifie la date d'une entrée d'historique (et synchronise c.date si c'est l'état courant) */
export function changerDateHistorique(i, idx, val) {
  const c = contacts()[i];
  if (!Array.isArray(c.historique) || !c.historique[idx]) return;
  val = (val || '').trim();
  // Valider le format jj/mm/aaaa
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m || !jourValide(+m[3], +m[2], +m[1])) {
    alert(t('al_date_invalid'));
    rafraichirHistorique(i);
    return;
  }
  c.historique[idx].date = val;
  apresModifHistorique(i);
}

/** Supprime une entrée erronée de l'historique d'un contact */
export function supprimerHistorique(i, idx) {
  const c = contacts()[i];
  if (!Array.isArray(c.historique) || !c.historique[idx]) return;
  const e = c.historique[idx];
  if (!confirm(tf('cf_del_history', { s: statutLabel(e.statut), d: e.date }))) return;
  c.historique.splice(idx, 1);
  apresModifHistorique(i);
}
