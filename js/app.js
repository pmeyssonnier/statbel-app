import {
  debounce, esc, correspondRecherche, regionPourCP,
  parseAdresse, composeAdresse, adresseSansBoite,
  todayStr, nowHHMM, dateFrToISO, dateISOToFr,
  formaterGsm, formatHeureSaisie, calcAge, jourValide,
  csvGuard, csvDeguard,
} from './core/util.js';
import {
  GEO_PROVIDERS, changerProvider,
} from './features/geocoding.js';
import {
  rafraichirHistorique, trierHistorique, syncStatutCourant, apresModifHistorique,
  ajouterHistorique, modifierStatutHistorique, modifierRdvHistorique,
  ouvrirCalendrierHist, ouvrirCalendrierRdvHist, changerDateHistorique, supprimerHistorique,
} from './features/history.js';
import {
  importerFichier, ouvrirModalImport, preparerImport, renderExclus,
  majComparaisonImport, renderImportApercu, confirmerImport, fermerModal,
  _contactKey, apparieurAnciens, diffHistorique, recordEnErreur, raisonsErreur,
  _diffContacts, buildCompareHTML, valeurIncoherente,
} from './features/import.js';

import {
  t, tf, tPlural, champLabel, localeApp, nomJourCourt, labelNbEnquetes, LANGS,
} from './core/i18n.js';
import {
  _pinHash, pinEstActif, renderLockDots, renderLockKeypad, pinToucheAppuyee,
  pinAfficherErreur, pinValiderSaisie, ouvrirLockScreen, fermerLockScreen,
  ouvrirGestionPin, fermerModalPin, pinChanger, pinDesactiver, majPinUI,
  pinVerifierAuDemarrage, pinSurveillerInactivite,
} from './ui/pin.js';
import {
  collecterVisites, renderActiviteQuotidienne, renderProgressionGlobale,
  renderCourbeAvancement, dessinerCourbeProgression, renderEvenementsChrono,
} from './ui/stats.js';
import {
  appliquerTheme, appliquerPolice, ouvrirSettings, fermerSettings, majSettingsUI,
  renderStatutsEditor, modifierStatut, ajouterStatut, supprimerStatut,
  FONT_FAMILIES, FONT_SIZES,
} from './ui/settings.js';
import {
  ouvrirDB, idbReq, idbTx, majEtatSauvegarde, signalerEchecSauvegarde,
  sauver, charger, coordsCache, saveCoords,
} from './data/idb.js';
import {
  parseCSVRows, parseCSV, splitLine, csvCell,
  sepRegionalAuto, sepCSVexport, genererCSV,
} from './data/csv.js';
import {
  maritalCanon, etatCivilGenre, paysNom, normaliserPays, paysAffiche,
  statutCanon, statutLabel, PAYS_I18N, MARITAL_I18N,
} from './data/canon.js';


// ── Statuts par défaut ───────────────────────────────────────────────
// done : marque l'entretien terminé → remplit automatiquement la date
// rdv  : statut « rendez-vous » → active la date/heure et la vue 📅
// Libellés = identifiants canoniques EN (langue pivot). L'affichage est traduit
// via statutLabel(). Migration des anciennes données FR → EN au chargement.
const STATUTS_DEFAULTS = [
  { label:'To do',       color:'#90a4ae', icon:'✕',  done:false, rdv:false },
  { label:'In progress', color:'#f9a825', icon:'⏳', done:false, rdv:true  },
  { label:'Done',        color:'#2e7d32', icon:'✓',  done:true,  rdv:false },
  { label:'Absent',      color:'#a1887f', icon:'⊘',  done:true,  rdv:false },
  { label:'Refusal',     color:'#c62828', icon:'✗',  done:true,  rdv:false },
  { label:'Moved',       color:'#6a1b9a', icon:'📦', done:true,  rdv:false },
];
// Palette contrastée par défaut (clé = label EN) — appliquée aux statuts standards
// lors de la migration pour bien distinguer les segments du graphe.
const STATUT_COULEURS = { 'To do':'#90a4ae', 'In progress':'#f9a825', 'Done':'#2e7d32', 'Absent':'#a1887f', 'Refusal':'#c62828', 'Moved':'#6a1b9a', 'Impossible':'#d81b60' };
const cloneStatuts = () => STATUTS_DEFAULTS.map(s => Object.assign({}, s));

// ── Paramètres utilisateur (persistés dans localStorage) ─────────────
// Version de l'application (source unique, affichée dans Paramètres et Aide)
const APP_VERSION = '3.2';

const SETTINGS_DEFAULTS = {
  theme:    'light',      // 'light' | 'dark' | 'auto'
  provider: 'auto',  // 'auto' | 'bruxelles' | 'wallonie' | 'flandre' | 'osm'
  mapStyle: 'gray',       // 'gray' | 'color'  (Bruxelles uniquement)
  navMode:  'coords',     // 'coords' (point GPS, vie privée) | 'adresse'
  statuts:  cloneStatuts(),
  statutsV: 7,            // version de schéma des statuts (7 = pivot EN + palette contrastée ; installs neuves sautent les migrations)
  pinCode:    '',         // code PIN de verrouillage de l'app ('' = désactivé)
  pinTimeout: 5,          // minutes d'inactivité avant re-verrouillage (0 = jamais auto)
  fontFamily: 'system',   // 'system' (défaut) | 'arial' | 'georgia' | 'verdana' | 'monospace'
  fontSize:   'normal',   // 'small' | 'normal' (défaut/système) | 'large' | 'xlarge'
  csvSep:     'auto',     // séparateur d'export CSV : 'auto' (régional) | ',' | ';'
  // Langue : détectée depuis le navigateur au 1er lancement (fr/nl/en), défaut fr
  lang: (() => { const l = (navigator.language || 'fr').slice(0,2).toLowerCase(); return ['fr','nl','en','de'].includes(l) ? l : 'fr'; })(),
};
// État mutable partagé au-delà de la frontière du module (gestionnaires inline
// + tests headless) : déclaré sur globalThis pour rester un vrai global. Les
// lectures/écritures non qualifiées (`settings = …`, `settings.x`) résolvent
// vers cette propriété globale.
globalThis.settings = Object.assign({}, SETTINGS_DEFAULTS, { statuts: cloneStatuts() });
globalThis.GEO = GEO_PROVIDERS[settings.provider];   // provider courant (mutable, partagé)

function chargerSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('statbel_settings') || '{}');
    settings = Object.assign({}, SETTINGS_DEFAULTS, raw);
  } catch(e) { settings = Object.assign({}, SETTINGS_DEFAULTS); }
  if (!Array.isArray(settings.statuts) || !settings.statuts.length) settings.statuts = cloneStatuts();
  // Migration v2 : horodater aussi les refus
  if (!settings.statutsV) {
    settings.statuts.forEach(s => { if (s.label === 'Refus') s.done = true; });
    settings.statutsV = 2;
    saveSettings();
  }
  // Migration v3 : horodater Absent + ajouter A déménager si absent
  if (settings.statutsV < 3) {
    settings.statuts.forEach(s => { if (s.label === 'Absent') s.done = true; });
    if (!settings.statuts.find(s => s.label === 'A déménager')) {
      settings.statuts.push({ label:'A déménager', color:'#7b1fa2', icon:'📦', done:true, rdv:false });
    }
    settings.statutsV = 3;
    saveSettings();
  }
  // Migration v7 : palette contrastée (Absent en brun clair, hors du vert de Fait)
  if (settings.statutsV < 7) {
    settings.statuts.forEach(s => {
      const en = (typeof statutCanon === 'function') ? statutCanon(s.label) : s.label;
      if (STATUT_COULEURS[en]) s.color = STATUT_COULEURS[en];
    });
    settings.statutsV = 7;
    saveSettings();
  }
  // OSM/Nominatim retiré (géocodage en masse bloqué) → bascule vers UrbIS
  if (settings.provider === 'osm') { settings.provider = 'bruxelles'; saveSettings(); }
  // Compat : ancien réglage de thème isolé
  const legacy = localStorage.getItem('statbel_theme');
  if (legacy && !('statbel_settings' in localStorage)) settings.theme = legacy;
  GEO = GEO_PROVIDERS[settings.provider] || GEO_PROVIDERS.bruxelles;
}
function saveSettings() { localStorage.setItem('statbel_settings', JSON.stringify(settings)); }

// Valide/assainit un objet « settings » d'origine externe (fichier de
// sauvegarde importé) : ne conserve QUE les clés connues, chaque valeur
// contrainte à son domaine (enum / type / borne), repli sur le défaut sinon.
// Empêche un fichier d'injecter des clés arbitraires ou des valeurs
// hors-domaine (provider inexistant, lang invalide, statuts malformés…).
// Le PIN n'est jamais repris d'un backup (géré à part par l'appelant).
function validerSettings(raw) {
  const out = Object.assign({}, SETTINGS_DEFAULTS, { statuts: cloneStatuts() });
  if (!raw || typeof raw !== 'object') return out;
  const enums = {
    theme:      ['light', 'dark', 'auto'],
    provider:   Object.keys(GEO_PROVIDERS),
    mapStyle:   ['gray', 'color'],
    navMode:    ['coords', 'adresse'],
    fontFamily: Object.keys(FONT_FAMILIES),
    fontSize:   Object.keys(FONT_SIZES),
    csvSep:     ['auto', ',', ';'],
    lang:       LANGS.slice(),
  };
  for (const [k, allowed] of Object.entries(enums)) {
    if (allowed.includes(raw[k])) out[k] = raw[k];
  }
  if (Number.isInteger(raw.statutsV) && raw.statutsV >= 0) out.statutsV = raw.statutsV;
  const st = validerStatuts(raw.statuts);
  if (st) out.statuts = st;
  return out;
}

// Valide un tableau de statuts importé : chaque entrée doit porter un label
// (chaîne non vide, longueur bornée) ; couleur (hex) / icône / booléens
// assainis. Renvoie null si rien d'exploitable (→ statuts par défaut).
function validerStatuts(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const out = [];
  for (const s of arr) {
    if (!s || typeof s !== 'object') continue;
    const label = typeof s.label === 'string' ? s.label.trim().slice(0, 40) : '';
    if (!label) continue;
    out.push({
      label,
      color: (typeof s.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(s.color)) ? s.color : '#90a4ae',
      icon:  typeof s.icon === 'string' ? s.icon.slice(0, 4) : '•',
      done:  s.done === true,
      rdv:   s.rdv === true,
    });
  }
  return out.length ? out : null;
}

// ── Accès aux statuts (pilotés par les paramètres) ───────────────────
function statutDefs()       { return settings.statuts; }
function statutDefaut()     { return (settings.statuts[0] || {label:'To do'}).label; }
function statutDef(label)   {
  return settings.statuts.find(s => s.label === label)
      || settings.statuts[0]
      || { label, color:'#90a4ae', icon:'•', done:false, rdv:false };
}


// ── Indicateur réseau (en ligne / hors ligne) ───────────────────────
// Met à jour le pastille d'état dans l'en-tête + le message sur la carte.
function majIndicateurReseau() {
  const off = !navigator.onLine;
  document.querySelectorAll('.net-indicator').forEach(el => {
    el.classList.toggle('offline', off);
    const label = off ? t('net_offline') : t('net_online');
    el.title = label;
    el.setAttribute('aria-label', label);
  });
  const mapMsg = document.getElementById('mapOfflineMsg');
  if (mapMsg) {
    mapMsg.classList.toggle('hidden', !off);
    const txt = mapMsg.querySelector('.map-offline-txt');
    if (txt) txt.textContent = t('map_offline');
  }
}
function restaurerIndicateur() {
  window.addEventListener('online',  majIndicateurReseau);
  window.addEventListener('offline', majIndicateurReseau);
  majIndicateurReseau();
}

// ── Accessibilité : rôle dialog sur les modales + fermeture par Échap ─
function setupA11y() {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const ouverts = [...document.querySelectorAll('.modal-overlay.open')];
    if (!ouverts.length) return;
    const top = ouverts[ouverts.length - 1];
    // Fermeture propre de l'import (réinitialise csvEnAttente) sinon fermeture générique
    if (top.id === 'modalNom' && typeof fermerModal === 'function') fermerModal();
    else top.classList.remove('open');
  });
}

// ── Bandeau de rappel de sauvegarde (non-modal, dans la liste) ───────
// S'affiche quand il y a des données et qu'aucune sauvegarde n'a été faite,
// ou que la dernière remonte à plus de BACKUP_RAPPEL_JOURS jours.
const BACKUP_RAPPEL_JOURS = 7;
function majBackupBanner() {
  const el = document.getElementById('backupBanner');
  if (!el) return;
  const aDesDonnees = Object.keys(enquetes).length > 0 &&
    Object.values(enquetes).some(arr => Array.isArray(arr) && arr.length > 0);
  if (sessionStorage.getItem('statbel_bkbanner_dismiss') || !aDesDonnees) {
    el.classList.add('hidden');
    return;
  }
  const iso = localStorage.getItem('statbel_last_backup');
  let msg = null;
  if (!iso) {
    msg = t('bkbanner_never');
  } else {
    const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (jours >= BACKUP_RAPPEL_JOURS) msg = tf('bkbanner_old', { n: jours });
  }
  el.classList.toggle('hidden', !msg);
  if (msg) el.querySelector('.bk-msg').textContent = msg;
}
function fermerBackupBanner() {
  sessionStorage.setItem('statbel_bkbanner_dismiss', '1');
  const el = document.getElementById('backupBanner');
  if (el) el.classList.add('hidden');
}


// ════════════════════════════════════════════════════════════════════
// STATE — Variables globales et sélecteur d'enquêtes
// ════════════════════════════════════════════════════════════════════

globalThis.enquetes      = {};    // globaux partagés (gestionnaires inline + tests)
globalThis.enqueteActive = '';
globalThis.filtreActif   = 'Tous';

function contacts() { return enquetes[enqueteActive] || []; }

function contactsFiltres() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  return contacts().filter(c => {
    if (filtreActif !== 'Tous' && (c.statut || statutDefaut()) !== filtreActif) return false;
    if (!correspondRecherche(c, q)) return false;
    return true;
  });
}

function refreshSelect() {
  const sel  = document.getElementById('surveySelect');
  const noms = Object.keys(enquetes);
  sel.innerHTML = noms.length === 0
    ? '<option value="">— Aucune enquête —</option>'
    : noms.map(n => `<option value="${esc(n)}"${n===enqueteActive?' selected':''}>${esc(n)}</option>`).join('');
}

function changerEnquete(nom) {
  enqueteActive = nom;
  sauver();
  filtreActif = 'Tous';
  filtreRdv   = 'Tous';
  _activiteJour = null;
  renderFilters();
  if      (vueActive === 'carte' && markersLayer) afficherMarqueurs();
  else if (vueActive === 'rdv')                   renduRdv();
  else if (vueActive === 'resume')                renduResume();
  else                                            rendu();
}

function renommerEnquete() {
  if (!enqueteActive) { alert(t('al_no_active_survey')); return; }
  const inp = document.getElementById('inputRename');
  inp.value = enqueteActive;
  document.getElementById('modalRename').classList.add('open');
  setTimeout(() => inp.select(), 100);
}

function fermerRename() {
  document.getElementById('modalRename').classList.remove('open');
}

function confirmerRename() {
  const ancien  = enqueteActive;
  const nouveau = (document.getElementById('inputRename').value || '').trim();
  if (!nouveau || nouveau === ancien) { fermerRename(); return; }
  if (enquetes[nouveau]) { alert(t('al_name_taken')); return; }
  // Renommer la clé en conservant l'ordre des enquêtes
  const renomme = {};
  Object.keys(enquetes).forEach(k => { renomme[k === ancien ? nouveau : k] = enquetes[k]; });
  enquetes = renomme;
  enqueteActive = nouveau;
  sauver();
  refreshSelect();
  rendu();
  fermerRename();
}

function supprimerEnquete() {
  if (!enqueteActive) return;
  if (!confirm(tf('cf_delete_survey', { name: enqueteActive }))) return;
  delete enquetes[enqueteActive];
  enqueteActive = Object.keys(enquetes)[0] || '';
  sauver();
  refreshSelect();
  rendu();
}


// ════════════════════════════════════════════════════════════════════
// ADRESSE — Parse / compose / variantes geocodage
// ════════════════════════════════════════════════════════════════════


// Lien de navigation. On privilégie les coordonnées GPS (point anonyme)
// plutôt que l'adresse nominative. Repli sur l'adresse seulement si
// le géocodage n'a pas encore eu lieu.
function mapsUrl(adresse) {
  const c = coordsCache(adresse);
  if (settings.navMode === 'coords' && c)
    return 'https://www.google.com/maps/search/?api=1&query=' + c.lat + ',' + c.lng;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(adresseSansBoite(adresse) + ', Belgique');
}


// ════════════════════════════════════════════════════════════════════
// CONTACTS — Modification des champs d'un contact
// ════════════════════════════════════════════════════════════════════


/** Ajoute le jour de la semaine devant une date DD/MM/YYYY → « Mer. 10/06/2026 » */
function formatDateJour(fr) {
  if (!fr) return '';
  const iso = dateFrToISO(fr);
  if (!iso) return fr;
  const [y, m, d] = iso.split('-');
  return nomJourCourt(new Date(+y, +m - 1, +d)) + ' ' + fr;
}

function changerStatut(i, val) {
  const c   = contacts()[i];
  const old = c.statut || statutDefaut();
  const def = statutDef(val);
  if (!Array.isArray(c.historique)) c.historique = [];

  // Préserver l'état courant « terminé » non encore historisé (ex. statut importé)
  // avant de le remplacer, pour ne pas perdre la visite précédente.
  const oldDef = statutDef(old);
  if (old && oldDef.done && c.date && !c.historique.some(h => h.statut === old && h.date === c.date)) {
    c.historique.push({ statut: old, date: c.date });
  }

  // Historique = journal des visites : on enregistre chaque passage « terminé »
  // (done) ET chaque « rendez-vous » (rdv), daté du jour de la visite.
  if (def.done || def.rdv) {
    const today = todayStr();
    const heure = nowHHMM();
    // Éviter doublon : même statut le même jour
    const derniere = c.historique[c.historique.length - 1];
    if (!derniere || derniere.statut !== val || derniere.date !== today) {
      const entry = { statut: val, date: today, heure };
      if (def.rdv && c.rdv) entry.rdv = c.rdv;   // RDV pris ce jour-là
      c.historique.push(entry);
    }
    c.date = def.done ? today : (c.date || '');
  } else {
    c.date = '';
  }

  c.statut = val;
  if (!def.rdv) c.rdv = '';
  sauver();
  rendu();
  if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
  if (vueActive === 'rdv') renduRdv();
}

// Persistance différée : la frappe (notes/email) met à jour la fiche en mémoire
// immédiatement, mais ne réécrit IndexedDB qu'après une pause (évite de réécrire
// toute la base à chaque caractère). Flush garanti avant fermeture/masquage.
let _saveTimer = null;
function sauverBientot() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { _saveTimer = null; sauver(); }, 400);
}
function flushSauver() { if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; sauver(); } }
window.addEventListener('pagehide', flushSauver);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSauver(); });

function changerNotes(i, val)  { contacts()[i].notes = val;  sauverBientot(); }
function changerEmail(i, val)  { contacts()[i].email = val;  sauverBientot(); }

function changerGsm(i, input) {
  const f = formaterGsm(input.value);
  input.value = f;
  contacts()[i].gsm = f;
  sauver();
}


/** Lit les champs RDV (date jj/mm/aaaa + heure hh:mm) et renvoie la valeur
 *  stockée en interne « YYYY-MM-DD HH:MM » (ISO, pour tri/affichage). */
function lireRdvFields(i) {
  const dFr = ((document.getElementById('edit-rdv-date-' +i)||{}).value||'').trim();
  let h     = ((document.getElementById('edit-rdv-heure-'+i)||{}).value||'').trim();
  const iso = dateFrToISO(dFr);                 // '' si incomplet/invalide
  if (h && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h)) h = '';  // heure 24h valide
  return iso ? (h ? iso + ' ' + h : iso) : '';
}

function changerRdvDH(i) {
  const c = contacts()[i];
  c.rdv = lireRdvFields(i);
  // Refléter le RDV sur la dernière entrée d'historique « En cours »
  if (Array.isArray(c.historique) && c.historique.length) {
    const last = c.historique[c.historique.length - 1];
    if (last.statut === c.statut && statutDef(c.statut).rdv) {
      if (c.rdv) last.rdv = c.rdv; else delete last.rdv;
    }
  }
  sauver();
}

/** Ouvre le calendrier natif pour le champ date du RDV */
function ouvrirCalendrierRdv(i) {
  const p = document.getElementById('histDatePicker');
  const champ = document.getElementById('edit-rdv-date-' + i);
  if (!p || !champ) return;
  p.value = dateFrToISO((champ.value || '').trim()) || '';
  p.onchange = function () {
    if (p.value) { champ.value = dateISOToFr(p.value); changerRdvDH(i); }
    p.onchange = null;
  };
  if (typeof p.showPicker === 'function') { try { p.showPicker(); return; } catch (e) {} }
  p.focus(); p.click();
}

function majAge(i) {
  const c = contacts()[i];
  if (!c.birth_date) return;
  const nais = new Date(c.birth_date);
  const now  = new Date();
  let age = now.getFullYear() - nais.getFullYear();
  const m = now.getMonth() - nais.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < nais.getDate())) age--;
  c.age = age;
  const el = document.getElementById('edit-age-'+i);
  if (el) el.value = age;
  sauver();
}

function formatRdv(rdv) {
  if (!rdv) return '';
  const parts = (rdv+' ').split(' ');
  const [y,m,d] = (parts[0]||'').split('-');
  if (!y||!m||!d) return rdv;
  const h = (parts[1]||'').trim();
  const dateObj = new Date(+y,+m-1,+d);
  return nomJourCourt(dateObj)+' '+d.padStart(2,'0')+'/'+m.padStart(2,'0')+'/'+y+(h?' '+h:'');
}


// Détecte les valeurs présentes dans les données mais absentes des dictionnaires
// de traduction (pays / état civil) → affichées telles quelles. `contacts` :
// tableau de contacts à analyser (défaut : toutes les enquêtes).
function detecterNonTraduits(contacts) {
  const arr = contacts || Object.values(enquetes).reduce((a, b) => a.concat(b), []);
  const pays = new Set(), marital = new Set();
  arr.forEach(c => {
    // Pays : nationalité ET pays de naissance (codes inconnus de PAYS_I18N)
    [c.nationality, c.birth_country].forEach(v => {
      const x = (v || '').trim();
      if (x && !PAYS_I18N[x.toUpperCase()]) pays.add(x);
    });
    const m = (c.marital_status || '').trim();
    if (m && !MARITAL_I18N[m]) marital.add(m);
  });
  return { pays: [...pays], marital: [...marital] };
}

// Construit le HTML d'alerte « valeurs non traduites » (ou '' si tout est traduit)
function renderNonTraduits(contacts) {
  const { pays, marital } = detecterNonTraduits(contacts);
  if (!pays.length && !marital.length) return '';
  const det = [];
  if (pays.length)    det.push(`${t('cohr_country')} : ${pays.map(esc).join(', ')}`);
  if (marital.length) det.push(`${champLabel('marital_status')} : ${marital.map(esc).join(', ')}`);
  return `<div style="font-size:11px;color:#e65100;margin-top:6px;">${t('i18n_missing')} ${det.join(' · ')}</div>`;
}

// Contrôles de cohérence structurelle des lignes importées (format date, sexe, statut)
function detecterIncoherences(rows) {
  const r = { dates: [], sexes: new Set(), statuts: new Set() };
  (rows || []).forEach(c => {
    const d = (c.birth_date || '').trim();
    if (valeurIncoherente('birth_date', d)) r.dates.push({ ordre: c.ordre || '—', val: d });
    const s = (c.sexe || '').trim();
    if (valeurIncoherente('sexe', s)) r.sexes.add(s);
    const st = (c.statut || '').trim();
    if (valeurIncoherente('statut', st)) r.statuts.add(st);
  });
  return r;
}

function renderCoherence(rows) {
  const i = detecterIncoherences(rows);
  const parts = [];
  if (i.dates.length)  parts.push(`${t('cohr_date')} (${i.dates.length}) : ${i.dates.slice(0, 5).map(x => 'N° ' + esc(String(x.ordre)) + '=' + esc(x.val)).join(', ')}${i.dates.length > 5 ? '…' : ''}`);
  if (i.sexes.size)    parts.push(`${t('cohr_sex')} : ${[...i.sexes].map(esc).join(', ')}`);
  if (i.statuts.size)  parts.push(`${t('cohr_status')} : ${[...i.statuts].map(esc).join(', ')}`);
  if (!parts.length) return '';
  return `<div style="font-size:11px;color:#e65100;margin-top:6px;">⚠️ ${t('cohr_title')} ${parts.join(' · ')}</div>`;
}


// Construit « 45 ans · Mariée · Belgique » à partir des données disponibles
function ligneDemographie(c) {
  const parts = [];
  const age = c.age || calcAge(c.birth_date);
  if (age) parts.push(age + ' ' + t('age_unit'));
  const ec = etatCivilGenre(c.marital_status, c.sexe);
  if (ec) {
    const badM = c.marital_status && !MARITAL_I18N[maritalCanon(c.marital_status)];
    parts.push(badM ? `<span class="demo-bad" title="${t('cohr_status_marital')}">${esc(ec)}</span>` : esc(ec));
  }
  if (c.nationality) {
    const badP = !PAYS_I18N[String(c.nationality).trim().toUpperCase()];
    const aff = esc(paysAffiche(c.nationality));
    parts.push(badP ? `<span class="demo-bad" title="${t('cohr_country')}">${aff}</span>` : aff);
  }
  if (c.taille_menage) parts.push('👥 ' + esc(c.taille_menage) + ' ' + tPlural('persons', c.taille_menage));
  return parts.join(' · ');
}

function toggleEdit(i) {
  const el = document.getElementById('edit-'+i);
  // Édition paresseuse : le formulaire n'est construit qu'au premier clic,
  // pas pour les centaines de fiches à chaque rendu.
  if (!el.dataset.built) {
    el.innerHTML = buildEditForm(i);
    el.dataset.built = '1';
  }
  el.classList.toggle('open');
  if (el.classList.contains('open')) document.getElementById('edit-prenom-'+i).focus();
}

// Ouvre (et construit si besoin) le formulaire d'édition d'une fiche
function ouvrirEdit(i) {
  const el = document.getElementById('edit-'+i);
  if (!el) return null;
  if (!el.dataset.built) { el.innerHTML = buildEditForm(i); el.dataset.built = '1'; }
  el.classList.add('open');
  return el;
}

// Génère le contenu du formulaire d'édition d'une fiche (à la demande)
function buildEditForm(i) {
  const c      = contacts()[i];
  const _p     = parseAdresse(c.adresse);
  const statut = c.statut || statutDefaut();
  const def    = statutDef(statut);
  return `
        ${buildHistoriqueHTML(c, i)}
        <div class="edit-row">
          <label>${t('ed_status')}</label>
          <div class="statut-bar">
            ${statutDefs().map((s, si) => {
              const on = s.label === statut;
              return `<button class="s-btn${on?' actif':''}" style="color:${s.color};${on?`border-color:${s.color};background:${s.color}22;`:''}" onclick="changerStatut(${i},statutDefs()[${si}].label)">${s.icon} ${esc(statutLabel(s.label))}</button>`;
            }).join('')}
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start">
          <div class="edit-row" style="flex:1">
            <label>${t('ed_firstname')}</label>
            <input type="text" id="edit-prenom-${i}" value="${esc(c.prenom)}">
          </div>
          <div class="edit-row" style="flex:2">
            <label>${t('ed_lastname')}</label>
            <input type="text" id="edit-nom-${i}" value="${esc(c.nom)}">
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start">
          <div class="edit-row" style="flex:1">
            <label>${t('ed_street')}</label>
            <input type="text" id="edit-rue-${i}" value="${esc(_p.rue)}" placeholder="Rue des Chardons 18">
          </div>
          <div class="edit-row" style="width:140px;min-width:0;flex-shrink:0">
            <label>${t('ed_box')}</label>
            <input type="text" id="edit-boite-${i}" value="${esc(_p.boite)}" placeholder="bte 2" style="width:100%">
          </div>
        </div>
        <div class="edit-row">
          <label>${t('ed_cpcity')}</label>
          <input type="text" id="edit-cpville-${i}" value="${esc(_p.cpville)}" placeholder="1030 Schaerbeek">
        </div>


        <div style="display:flex;gap:10px;align-items:flex-start">
          <div class="edit-row" style="flex:0.45">
            <label>${t('ed_gsm')}</label>
            <input type="tel" placeholder="+32 4xx xx xx xx" value="${esc(c.gsm||'')}"
              oninput="changerGsm(${i},this)" style="max-width:150px"
              ondblclick="if(this.value)window.location.href='tel:'+this.value">
          </div>
          <div class="edit-row" style="flex:1">
            <label>${t('ed_email')}</label>
            <div class="email-wrap">
              <input type="email" placeholder="${t('ph_email')}" value="${esc(c.email||'')}"
                oninput="changerEmail(${i},this.value);emailSuggest(this,'esug-${i}')"
                onkeydown="emailKeydown(event,'esug-${i}')"
                onblur="setTimeout(()=>fermerSuggestions('esug-${i}'),150)"
                ondblclick="if(this.value)window.location.href='mailto:'+this.value"
                autocomplete="off">
              <div class="email-suggestions" id="esug-${i}"></div>
            </div>
          </div>
        </div>
        <div class="edit-row">
          <label>${t('ed_notes')}</label>
          <textarea placeholder="${t('ph_notes')}" oninput="changerNotes(${i},this.value)"
            style="padding:8px;border:1px solid #ccc;border-radius:8px;font-size:14px;font-family:Arial,sans-serif;resize:vertical;min-height:60px">${esc(c.notes||'')}</textarea>
        </div>
        ${def.rdv ? `
        <div class="edit-row" style="background:#e3f2fd;padding:8px;border-radius:8px;border:1px solid #90caf9;">
          <label style="color:#1565c0;">${t('ed_rdv')}</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" inputmode="numeric" id="edit-rdv-date-${i}" value="${dateISOToFr((c.rdv||'').split(' ')[0]||'')}"
              placeholder="jj/mm/aaaa" maxlength="10" oninput="this.value=formatDateFrSaisie(this.value)" onchange="changerRdvDH(${i})"
              style="flex:1;border-color:#90caf9;background:#fff;">
            <button type="button" class="historique-cal" title="Ouvrir le calendrier" onclick="ouvrirCalendrierRdv(${i})" style="font-size:16px;">📅</button>
            <input type="text" inputmode="numeric" id="edit-rdv-heure-${i}" value="${(c.rdv||'').split(' ')[1]||''}"
              placeholder="hh:mm" maxlength="5" oninput="this.value=formatHeureSaisie(this.value)" onchange="changerRdvDH(${i})"
              style="width:70px;border-color:#90caf9;background:#fff;text-align:center;">
          </div>
        </div>` : ''}
        <div class="edit-btns">
          <button class="btn-cancel-edit" onclick="toggleEdit(${i})">${t('btn_close')}</button>
          <button class="btn-vcard" onclick="exporterVCard(${i})" title="Exporter contact">📇 vCard</button>
          <button class="btn-save-edit" onclick="sauverEdit(${i})">${t('ed_save')}</button>
        </div>
  `;
}

function sauverEdit(i) {
  const c = contacts()[i];
  const ancAdresse = c.adresse;
  c.prenom  = document.getElementById('edit-prenom-'+i).value.trim();
  c.nom     = document.getElementById('edit-nom-'+i).value.trim();
  c.rdv = lireRdvFields(i);
  const rue    = document.getElementById('edit-rue-'+i).value.trim();
  const boite  = document.getElementById('edit-boite-'+i).value.trim();
  const cpville= document.getElementById('edit-cpville-'+i).value.trim();
  c.adresse = composeAdresse(rue, boite, cpville);
  if (c.adresse !== ancAdresse) localStorage.removeItem('coords_'+adresseSansBoite(ancAdresse));
  sauver();
  rendu();
  if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
}

function filtrer(f) {
  filtreActif = f;
  renderFilters();
  if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
  else rendu();
}


// ════════════════════════════════════════════════════════════════════
// IMPORT — Lecture CSV / XLSX, modal de nommage
// ════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════
// EXPORT — CSV et vCard
// ════════════════════════════════════════════════════════════════════


function exporterCSV() {
  if (!enqueteActive) { alert(t('al_no_active_survey')); return; }
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([genererCSV()], {type:'text/csv;charset=utf-8'})),
    download: enqueteActive + '.csv'
  });
  a.click();
}

function exporterVCard(i) {
  const c      = contacts()[i];
  const prenom = (document.getElementById('edit-prenom-'+i)||{}).value?.trim() || c.prenom;
  const nom    = (document.getElementById('edit-nom-'+i)||{}).value?.trim()    || c.nom;
  const rue    = (document.getElementById('edit-rue-'+i)||{}).value?.trim()    || '';
  const boite  = (document.getElementById('edit-boite-'+i)||{}).value?.trim()  || '';
  const cpv    = (document.getElementById('edit-cpville-'+i)||{}).value?.trim()|| '';
  const adresse= composeAdresse(rue, boite, cpv) || c.adresse;
  const parts  = adresse.split(',');
  const street = (parts[0]||'').trim();
  const cityRaw= (parts[1]||'').trim();
  const zip    = (cityRaw.match(/^[0-9]+/)||[''])[0];
  const city   = cityRaw.replace(/^[0-9]+ */,'').trim();
  const CRLF   = '\r\n';
  let vcard    = 'BEGIN:VCARD'+CRLF+'VERSION:3.0'+CRLF;
  vcard += 'FN:'+prenom+' '+nom+CRLF+'N:'+nom+';'+prenom+';;;'+CRLF;
  if (street)  vcard += 'ADR;TYPE=HOME:;;'+street+';'+city+';;'+zip+';Belgique'+CRLF;
  if (c.gsm)   vcard += 'TEL;TYPE=CELL:'+c.gsm+CRLF;
  if (c.email) vcard += 'EMAIL:'+c.email+CRLF;
  if (c.notes) vcard += 'NOTE:'+c.notes.split('\n').join(' ')+CRLF;
  vcard += 'ORG:Statbel LFS'+CRLF+'END:VCARD';
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([vcard], {type:'text/vcard;charset=utf-8'})),
    download: prenom+'_'+nom+'.vcf'
  });
  a.click();
}


// ════════════════════════════════════════════════════════════════════
// RENDU — Génération HTML des cards et filtres
// ════════════════════════════════════════════════════════════════════

function renderFilters() {
  const all = contacts(), total = all.length, cpt = {};
  all.forEach(c => { const s = c.statut||statutDefaut(); cpt[s]=(cpt[s]||0)+1; });
  let html = `<button class="filter-btn${filtreActif==='Tous'?' active':''}" onclick="filtrer('Tous')">${t('f_all')}${total>0?' ('+total+')':''}</button>`;
  statutDefs().forEach((s, si) => {
    const n = cpt[s.label] || 0;
    const on = filtreActif === s.label;
    html += `<button class="filter-btn" style="border-color:${s.color};color:${on?'#fff':s.color};background:${on?s.color:'var(--filter-bg)'}" onclick="filtrer(statutDefs()[${si}].label)">${s.icon} ${esc(statutLabel(s.label))}${n>0?' ('+n+')':''}</button>`;
  });
  document.querySelector('.filters').innerHTML = html;
  document.getElementById('filters') && (document.getElementById('filters').innerHTML = html);
}

// Sélecteur de statut du header (vue carte) — reflète le filtre actif

function rendu() {
  renderFilters();
  majBackupBanner();
  const liste = document.getElementById('liste');
  liste.innerHTML = '';
  const all = contacts();
  if (all.length === 0) {
    liste.innerHTML = `<div class="empty-state">${t('empty_state')}<button onclick="document.getElementById('importFile').click()">${t('menu_import')}</button></div>`;
    return;
  }
  const q = (document.getElementById('searchInput')?.value||'').toLowerCase().trim();
  all.forEach((c, i) => {
    const statut = c.statut || statutDefaut();
    if (filtreActif !== 'Tous' && statut !== filtreActif) return;
    if (!correspondRecherche(c, q)) return;
    const def = statutDef(statut);
    const badges = [];
    if (c.gsm)   badges.push(`<a class="badge badge-tel" href="tel:${esc(c.gsm)}">📞 ${esc(c.gsm)}</a>`);
    if (c.email) badges.push(`<span class="badge">✉️ ${esc(c.email)}</span>`);
    // Date associée au statut : RDV (si statut « rendez-vous ») sinon date d'action
    const dateStatut = (c.rdv && def.rdv) ? '📅 ' + formatRdv(c.rdv) : (c.date ? formatDateJour(c.date) : '');
    const _p = parseAdresse(c.adresse);
    const card = document.createElement('div');
    card.className = 'card';
    card.style.borderLeftColor = def.color;
    card.innerHTML = `
      <div class="card-top">
        <span class="card-ordre">N° ${esc(c.ordre)}</span>
        <div class="card-name">${esc(c.prenom)} ${esc(c.nom)}</div>
        <button class="btn-edit" onclick="toggleEdit(${i})" title="${esc(t('aria_edit'))}" aria-label="${esc(t('aria_edit'))}">🖊️</button>
      </div>
      ${(() => { const d = ligneDemographie(c); return d ? `<div class="card-demo">👤 ${d}</div>` : ''; })()}
      <div class="card-adresse-row">
        <a class="card-adresse" href="${mapsUrl(c.adresse)}" target="_blank">📍 ${esc(c.adresse)}</a>
        ${distanceBadge(c.adresse)}
      </div>
      ${badges.length ? '<div class="card-badges">'+badges.join('')+'</div>' : ''}
      <div class="card-statut">
        <div class="statut-bar">
          ${statutDefs().map((s, si) => {
            const on = s.label === statut;
            return `<button class="s-btn${on?' actif':''}" style="color:${s.color};${on?`border-color:${s.color};background:${s.color}22;`:''}" onclick="event.stopPropagation();changerStatut(${i},statutDefs()[${si}].label)">${esc(s.icon)} ${esc(statutLabel(s.label))}</button>`;
          }).join('')}
        </div>
        ${dateStatut ? `<span class="card-statut-date">${esc(dateStatut)}</span>` : ''}
      </div>
      ${!coordsCache(c.adresse) ? `<div class="no-coords">${t('no_coords')}</div>` : ''}
      <div class="edit-area" id="edit-${i}"></div>
    `;
    liste.appendChild(card);
  });
}


// ════════════════════════════════════════════════════════════════════
// GÉOLOC — Position GPS, Haversine, marqueur Ma position
// ════════════════════════════════════════════════════════════════════

let maPosition = null;
let markerMoi  = null;

function haversine(lat1, lng1, lat2, lng2) {
  const R=6371000, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function formatDist(m) { return m<1000 ? Math.round(m)+' m' : (m/1000).toFixed(1)+' km'; }

function distanceBadge(adresse) {
  if (!maPosition) return '';
  const c = coordsCache(adresse);
  if (!c) return '';
  const d = haversine(maPosition.lat, maPosition.lng, c.lat, c.lng);
  return `<span class="badge-dist" style="display:inline-block;margin-top:3px;">🚶 ${formatDist(d)}</span>`;
}

function afficherToast(msg, duree) {
  let t = document.getElementById('geoToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'geoToast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(30,30,30,0.92);color:white;padding:12px 18px;border-radius:12px;font-size:13px;z-index:9999;max-width:320px;text-align:center;line-height:1.5;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.display='block'; t.style.opacity='1';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => { t.style.transition='opacity 0.5s'; t.style.opacity='0'; setTimeout(()=>{t.style.display='none';t.style.transition='';},500); }, duree||3000);
}

function toggleMaPosition() {
  const btn = document.getElementById('btnGeo');
  if (maPosition) {
    maPosition=null;
    if (markerMoi && leafletMap) leafletMap.removeLayer(markerMoi);
    markerMoi=null; btn.classList.remove('active'); btn.textContent='🎯'; btn.title='Ma position';
    rendu(); return;
  }
  if (!navigator.geolocation) { afficherToast(t('toast_geo_unsupported'),4000); return; }
  if (navigator.permissions) {
    navigator.permissions.query({name:'geolocation'}).then(r => {
      if (r.state==='denied') { afficherToast(t('toast_geo_blocked'),6000); return; }
      demanderPosition(btn);
    }).catch(()=>demanderPosition(btn));
  } else demanderPosition(btn);
}

function demanderPosition(btn) {
  btn.textContent='⏳'; btn.title='Localisation en cours...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      maPosition={lat:pos.coords.latitude,lng:pos.coords.longitude};
      btn.textContent='🎯'; btn.classList.add('active'); btn.title='Position active';
      afficherToast(t('toast_geo_ok'),2000);
      if (vueActive==='carte') { placerMarqueurMoi(); afficherMarqueurs(); }
      rendu();
    },
    err => {
      btn.textContent='🎯'; btn.classList.remove('active'); btn.title=t('title_mypos');
      const msgs={1:t('geo_err_1'),2:t('geo_err_2'),3:t('geo_err_3')};
      afficherToast(msgs[err.code]||(t('geo_err')+err.code),6000);
    },
    {enableHighAccuracy:true,timeout:15000,maximumAge:30000}
  );
}

function placerMarqueurMoi() {
  if (!leafletMap||!maPosition) return;
  if (markerMoi) leafletMap.removeLayer(markerMoi);
  markerMoi = L.marker([maPosition.lat,maPosition.lng],{
    icon:L.divIcon({className:'',html:'<div class="marker-moi"></div>',iconSize:[20,20],iconAnchor:[10,10],popupAnchor:[0,-14]}),
    zIndexOffset:1000
  }).addTo(leafletMap).bindPopup('<div style="font-weight:bold;color:#1a73e8;">📍 Ma position</div>');
}


// ════════════════════════════════════════════════════════════════════
// CARTE — Leaflet, marqueurs, géocodage UrbIS (CIRB, Région bruxelloise)
// ════════════════════════════════════════════════════════════════════

function recentrerCarte() {
  if (!leafletMap||!markersLayer) return;
  leafletMap.invalidateSize();   // recalcule la taille (corrige tuiles grises sur mobile)
  const bounds = markersLayer.getLayers().filter(l=>l.getLatLng).map(l=>l.getLatLng());
  if (bounds.length===1) leafletMap.setView(bounds[0],16);
  else if (bounds.length>1) leafletMap.fitBounds(L.latLngBounds(bounds),{padding:[40,40],maxZoom:16});
}

function changerStatutCarte(idx, val) { changerStatut(idx,val); if (markersLayer) afficherMarqueurs(); }

function ouvrirFicheDepuisCarte(idx) {
  setView('liste');
  setTimeout(()=>{ const el=ouvrirEdit(idx); if(el) el.scrollIntoView({behavior:'smooth',block:'center'}); },150);
}

function renderLegend() {
  const el = document.getElementById('mapLegend');
  if (!el) return;
  el.innerHTML = statutDefs().map(s =>
    `<div class="leg-item"><div class="leg-dot" style="background:${s.color}"></div> ${esc(statutLabel(s.label))}</div>`
  ).join('') +
    `<div class="leg-item"><div class="leg-dot" style="background:#1a73e8;box-shadow:0 0 0 3px rgba(26,115,232,0.3)"></div> ${t('title_mypos')}</div>`;
}

function initCarte() {
  if (!leafletMap) {
    leafletMap = L.map('map',{wheelPxPerZoomLevel:120,wheelDebounceTime:100}).setView([50.8670,4.3800],14);
    const F = fondEffectif();
    baseLayer = L.tileLayer(F.tileUrl(settings.mapStyle),{attribution:F.tileAttribution,maxZoom:F.maxZoom}).addTo(leafletMap);
    _fondActuel = F;
    markersLayer = L.layerGroup().addTo(leafletMap);
  }
  renderLegend();
  afficherMarqueurs();
  if (maPosition) placerMarqueurMoi();
  // Mobile : la hauteur du conteneur peut changer (barre d'adresse) → recalcul
  setTimeout(() => leafletMap.invalidateSize(), 250);
}

// Recalcule la taille de la carte quand la fenêtre change (rotation, barre
// d'adresse mobile qui apparaît/disparaît) — évite les tuiles grises.
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (vueActive === 'carte' && leafletMap) { leafletMap.invalidateSize(); return; }
    // Réancrer la courbe de progression après reflow (rotation / redimensionnement)
    redessinerCourbeApresLayout();
  }, 200);
});
window.addEventListener('orientationchange', () => {
  // Délai plus long : la rotation termine son reflow après l'événement
  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
    redessinerCourbeApresLayout();
  }, 350);
});

/* Recalcule et réancre la courbe % faits cumulés sur le graphe d'activité,
   uniquement si elle est présente dans la vue courante (RDV / Suivi). */
function redessinerCourbeApresLayout() {
  if (vueActive !== 'rdv' && vueActive !== 'resume') return;
  if (!document.querySelector('#rdvListe .activite-wrap')) return;
  if (filtreRdv && filtreRdv !== 'Tous' && filtreRdv !== 'Done') return;
  // Double rAF : on attend que le navigateur ait recalculé tailles/positions des barres
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { dessinerCourbeProgression(enqueteActive); } catch (e) {}
  }));
}

function afficherMarqueurs() {
  // Mode auto : le fond peut changer si l'enquête active relève d'une autre région
  if (settings.provider === 'auto' && fondEffectif() !== _fondActuel) rafraichirFond();
  markersLayer.clearLayers();
  const all = contactsFiltres();
  if (all.filter(c=>!coordsCache(c.adresse)).length > 0)
    document.getElementById('geocodeProgress').style.display = 'block';

  function placerMarqueur(c, lat, lng) {
    const statut = c.statut||statutDefaut();
    const def    = statutDef(statut);
    const icon   = L.divIcon({className:'',html:`<div class="marker-pin" style="background:${def.color}"><span>${esc(c.ordre)}</span></div>`,iconSize:[30,30],iconAnchor:[15,30],popupAnchor:[0,-32]});
    const idx    = enquetes[enqueteActive].indexOf(c);
    const gsm    = c.gsm   ? `<div style="margin-top:5px">📞 <a href="tel:${esc(c.gsm)}" style="color:#1a73e8;text-decoration:none;">${esc(c.gsm)}</a></div>` : '';
    const email  = c.email ? `<div style="margin-top:3px">✉️ <a href="mailto:${esc(c.email)}" style="color:#1a73e8;text-decoration:none;">${esc(c.email)}</a></div>` : '';
    let distPopup='';
    if (maPosition) {
      const cd=coordsCache(c.adresse);
      if (cd) distPopup='<div style="margin-top:5px"><span style="background:#e3f2fd;color:#1a73e8;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">🚶 '+formatDist(haversine(maPosition.lat,maPosition.lng,cd.lat,cd.lng))+'</span></div>';
    }
    const demo = ligneDemographie(c);
    const dateStatut = (c.rdv && def.rdv) ? '📅 ' + formatRdv(c.rdv) : (c.date ? formatDateJour(c.date) : '');
    const popup=`
      <div class="popup-titre">N° ${esc(c.ordre)} — ${esc(c.prenom)} ${esc(c.nom)}</div>
      ${demo ? `<div style="font-size:12px;color:#666;margin-bottom:4px">👤 ${demo}</div>` : ''}
      <a href="${mapsUrl(c.adresse)}" target="_blank" style="color:#1a73e8;text-decoration:none;font-size:13px;">📍 ${esc(c.adresse)}</a>
      ${distPopup}${gsm}${email}
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="s-btn actif" style="color:${def.color};border-color:${def.color};background:${def.color}22;cursor:default;opacity:1">${esc(def.icon)} ${esc(statutLabel(statut))}</span>
        ${dateStatut ? `<span style="font-size:12px;color:#666">${esc(dateStatut)}</span>` : ''}
      </div>
      <div style="margin-top:8px"><button onclick="ouvrirFicheDepuisCarte(${idx})" style="width:100%;padding:8px;background:#1a237e;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖊️ Éditer la fiche</button></div>`;
    // Largeur du popup adaptée à l'écran (téléphone/tablette)
    const vw = window.innerWidth || 360;
    const popMax = Math.min(340, vw - 40);
    const popMin = Math.min(280, popMax);
    L.marker([lat,lng],{icon}).addTo(markersLayer).bindPopup(popup,{maxWidth:popMax,minWidth:popMin});
  }

  function zoomSurMarqueurs() {
    const bounds=markersLayer.getLayers().filter(l=>l.getLatLng).map(l=>l.getLatLng());
    if (bounds.length===1) leafletMap.setView(bounds[0],16);
    else if (bounds.length>1) leafletMap.fitBounds(L.latLngBounds(bounds),{padding:[40,40],maxZoom:16});
  }

  // Jeton de session : tout réaffichage (changement d'enquête, de filtre…)
  // invalide la file de géocodage précédente pour éviter une boucle fantôme.
  const session = ++_geoSession;

  const queue=[];
  all.forEach(c=>{ const cc=coordsCache(c.adresse); if(cc) placerMarqueur(c,cc.lat,cc.lng); else queue.push(c); });
  if (markersLayer.getLayers().length>0) zoomSurMarqueurs();

  let qi=0;
  function nextGeocode() {
    if (session!==_geoSession) return;   // session annulée : on arrête l'ancienne boucle
    if (qi>=queue.length){ document.getElementById('geocodeProgress').style.display='none'; zoomSurMarqueurs(); return; }
    const c=queue[qi++];
    document.getElementById('geocodeCount').textContent=qi+' / '+queue.length;
    GEO.geocode(c.adresse).then(coords=>{
      if (session!==_geoSession) return; // résultat obsolète : on l'ignore
      if(coords){ saveCoords(c.adresse,coords.lat,coords.lng); placerMarqueur(c,coords.lat,coords.lng); zoomSurMarqueurs(); }
      setTimeout(nextGeocode,300);
    });
  }
  nextGeocode();
}


// ════════════════════════════════════════════════════════════════════
// VUE RDV — Agenda des rendez-vous chronologique
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// VUE RDV — Suivi chronologique de tous les statuts sauf "À faire"
// ════════════════════════════════════════════════════════════════════

let filtreRdv = 'Tous';
globalThis._activiteJour = null;   // jour ISO sélectionné dans le graphe (filtre le journal) — partagé avec ui/stats.js
globalThis._journalEvents = [];    // événements affichés dans le journal (clic → fiche) — partagé avec ui/stats.js

// Clic sur une barre du graphe : (dé)sélectionne le jour → filtre le journal
function filtrerActiviteJour(iso) {
  _activiteJour = (_activiteJour === iso) ? null : iso;
  renduRdv();
}

// Clic sur une ligne du journal → ouvre la fiche du contact correspondant
function ouvrirFicheEvtIdx(i) {
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
function rdvTitreStatut(label) {
  if (!label || label === 'Tous') return { icon: '📅', titre: t('track_title_plain') };
  const def = statutDef(label);
  const icon = def.icon || '•';
  // Titres sémantiques selon la nature du statut
  if (def.rdv)  return { icon, titre: t('rdv_planned') + ' — ' + statutLabel(label) };
  if (def.done) return { icon, titre: t('rdv_done')    + ' — ' + statutLabel(label) };
  return        { icon, titre: t('rdv_contacts') + ' — ' + statutLabel(label) };
}

function renderRdvFilters() {
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

function filtrerRdv(statut) {
  filtreRdv = statut;
  renduRdv();
}

function renduRdv() {
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

/** Bloc historique éditable d'un contact (statut + date + RDV + ajout/suppression).
 *  Toujours rendu (avec bouton ➕) pour permettre de compléter un historique vide. */
function buildHistoriqueHTML(c, i) {
  const hist = Array.isArray(c.historique) ? c.historique : [];
  // Du plus récent au plus ancien (idx = position réelle conservée)
  const lignes = hist.map((h, idx) => ({ h, idx })).reverse().map(({ h, idx }) => {
    const def = statutDef(h.statut);
    const opts = settings.statuts.map(s =>
      `<option value="${esc(s.label)}"${s.label === h.statut ? ' selected' : ''}>${esc(s.icon)} ${esc(statutLabel(s.label))}</option>`
    ).join('');
    let rdvField = '';
    if (def.rdv) {
      const p = (h.rdv ? h.rdv + ' ' : ' ').split(' ');
      const rdvFr = h.rdv ? (dateISOToFr(p[0]) + (p[1] ? ' ' + p[1].trim() : '')) : '';
      rdvField = `<input type="text" class="hist-rdv" value="${esc(rdvFr)}" placeholder="${t('hist_rdv_ph')}" onchange="modifierRdvHistorique(${i},${idx},this.value)" title="Date/heure du RDV"><button class="historique-cal" title="Calendrier RDV" onclick="ouvrirCalendrierRdvHist(${i},${idx},'${esc(h.rdv || '')}')">📅</button>`;
    }
    return `<div class="historique-ligne">
      <div class="historique-dot" style="background:${def.color}"></div>
      <select class="hist-statut" onchange="modifierStatutHistorique(${i},${idx},this.value)">${opts}</select>
      <input type="text" class="historique-date" value="${esc(h.date)}" readonly tabindex="-1" title="Cliquez sur 📅 pour modifier la date">
      <button class="historique-cal" title="Modifier la date" onclick="ouvrirCalendrierHist(${i},${idx},'${esc(h.date)}')">📅</button>
      ${rdvField}
      <button class="historique-del" title="Supprimer cette entrée" onclick="supprimerHistorique(${i},${idx})">✕</button>
    </div>`;
  }).join('');
  return `<div class="historique-wrap" id="hist-${i}">
    <div class="historique-title">${t('hist_title')} (${hist.length})</div>
    ${lignes}
    <button class="btn-secondary" style="align-self:flex-start;font-size:12px;padding:4px 10px;margin-top:4px;" onclick="ajouterHistorique(${i})">${t('hist_add')}</button>
  </div>`;
}


/** Met à jour la carte (bordure, badge statut, date) + les boutons de statut du
 *  formulaire d'édition, en place (sans refermer la fiche) */
function majCarteStatut(i) {
  const editEl = document.getElementById('edit-' + i);
  const card = editEl && editEl.closest('.card');
  if (!card) return;
  const c = contacts()[i];
  const def = statutDef(c.statut || statutDefaut());
  card.style.borderLeftColor = def.color;
  // Date / RDV associée au statut
  const dateStatut = (c.rdv && def.rdv) ? '📅 ' + formatRdv(c.rdv) : (c.date ? formatDateJour(c.date) : '');
  let el = card.querySelector('.card-statut-date');
  if (dateStatut) {
    if (el) el.textContent = dateStatut;
    else { const s = document.createElement('span'); s.className = 'card-statut-date'; s.textContent = dateStatut; card.querySelector('.card-statut') && card.querySelector('.card-statut').appendChild(s); }
  } else if (el) { el.remove(); }
  // Barres de statut (carte + formulaire) : reflète le statut courant
  card.querySelectorAll('.statut-bar').forEach(bar => {
    bar.innerHTML = statutDefs().map((s, si) => {
      const on = s.label === c.statut;
      return `<button class="s-btn${on ? ' actif' : ''}" style="color:${s.color};${on ? `border-color:${s.color};background:${s.color}22;` : ''}" onclick="event.stopPropagation();changerStatut(${i},statutDefs()[${si}].label)">${s.icon} ${esc(statutLabel(s.label))}</button>`;
    }).join('');
  });
}


/** Insère les barres obliques pendant la saisie : 12062026 → 12/06/2026 */
function formatDateFrSaisie(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}


function buildRdvCard(c, i, today, def) {
  const hasRdv   = !!(c.rdv && def.rdv);
  const rdvDate  = hasRdv ? (c.rdv + ' ').split(' ')[0] : '';
  const isPast   = rdvDate && rdvDate < today;
  const isToday  = rdvDate && rdvDate === today;
  const tag      = isPast ? 'rdv-past' : (isToday ? 'rdv-today' : '');

  const distHtml = (() => {
    if (!maPosition) return '';
    const cc = coordsCache(c.adresse);
    if (!cc) return '';
    return `<span class="badge-dist" style="margin-left:6px;">🚶 ${formatDist(haversine(maPosition.lat, maPosition.lng, cc.lat, cc.lng))}</span>`;
  })();

  const div = document.createElement('div');
  div.className = 'rdv-card ' + tag;
  // Bordure gauche colorée selon statut
  div.style.borderLeft = `5px solid ${def.color}`;

  let headerHtml = '';
  if (hasRdv) {
    // Statut « rendez-vous » : « Rendez-vous <jour DD/MM/YYYY hh:mm> »
    const label = isPast ? t('rdv_past') : (isToday ? t('rdv_today') : '');
    headerHtml = `<div class="rdv-header">
      <span class="rdv-datetime">${t('rdv_label')} ${esc(formatRdv(c.rdv))}</span>
      ${label ? `<span style="font-size:11px;color:${isToday?'#2e7d32':'#999'};font-weight:bold;">${esc(label)}</span>` : ''}
    </div>`;
  } else if (c.date) {
    // Statut « done » : « <Statut> le <jour DD/MM/YYYY[ HH:mm]> »
    // Si un RDV existait avec une heure, on l'affiche à côté de la date
    const heure = (c.rdv || '').split(' ')[1] || '';
    const dateLabel = formatDateJour(c.date) + (heure ? ' ' + heure : '');
    headerHtml = `<div class="rdv-header">
      <span class="rdv-datetime" style="background:${def.color}22;color:${def.color}">${def.icon} ${esc(statutLabel(c.statut || statutDefaut()))} ${t('done_on')} ${esc(dateLabel)}</span>
    </div>`;
  }

  div.innerHTML = `
    ${headerHtml}
    <div class="card-top" style="padding-right:32px;position:relative;">
      <span class="card-ordre">N° ${esc(c.ordre)}</span>
      <div class="card-name">${esc(c.prenom)} ${esc(c.nom)}</div>
      <button class="btn-edit" onclick="setView('liste');setTimeout(()=>{const el=ouvrirEdit(${i});if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},150)">🖊️</button>
    </div>
    ${(() => { const d = ligneDemographie(c); return d ? `<div class="card-demo">👤 ${d}</div>` : ''; })()}
    <div class="card-adresse-row">
      <a class="card-adresse" href="${mapsUrl(c.adresse)}" target="_blank">📍 ${esc(c.adresse)}</a>
      ${distHtml}
    </div>
    ${c.gsm   ? `<div style="margin-top:4px"><a class="badge badge-tel" href="tel:${esc(c.gsm)}">📞 ${esc(c.gsm)}</a></div>` : ''}
    ${c.notes ? `<div style="margin-top:6px;font-size:12px;color:var(--text3);">📝 ${esc(c.notes)}</div>` : ''}
    ${buildHistoriqueHTML(c, i)}`;
  return div;
}


// ════════════════════════════════════════════════════════════════════
// UI — Navigation vues, thème, menu ⋮, email autocomplete
// ════════════════════════════════════════════════════════════════════

let vueActive    = 'liste';
let leafletMap   = null;
let markersLayer = null;
let baseLayer    = null;
let _geoSession  = 0;   // jeton d'annulation des files de géocodage

function setView(v) {
  vueActive = v;
  ['liste','carte','rdv','resume'].forEach(id => {
    const btn = document.getElementById('btn'+id.charAt(0).toUpperCase()+id.slice(1));
    if (btn) btn.classList.toggle('active', v===id);
  });
  document.querySelector('.filters').style.display         = v==='liste'  ? '' : 'none';
  document.getElementById('liste').style.display           = v==='liste'  ? '' : 'none';
  document.querySelector('.search-bar').style.display      = v==='liste'  ? '' : 'none';
  document.getElementById('mapContainer').style.display    = v==='carte'  ? 'block' : 'none';
  document.getElementById('rdvContainer').style.display    = v==='rdv'    ? 'flex'  : 'none';
  document.getElementById('resumeContainer').style.display = v==='resume' ? 'flex'  : 'none';
  if (v!=='liste') { const bb = document.getElementById('backupBanner'); if (bb) bb.classList.add('hidden'); }
  if (v==='carte')  { initCarte(); if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 50); }
  if (v==='liste')  rendu();
  if (v==='rdv')    renduRdv();
  if (v==='resume') renduResume();
}


// Applique la langue courante à tout le DOM balisé (data-i18n[-ph|-tip|-title]).
function appliquerLangue() {
  document.documentElement.lang = settings.lang || 'fr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-tip]').forEach(el => { el.setAttribute('data-tip', t(el.getAttribute('data-i18n-tip'))); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
}

function changerLangue(v) {
  settings.lang = LANGS.includes(v) ? v : 'fr';
  saveSettings();
  appliquerLangue();
  if (typeof majIndicateurReseau === 'function') majIndicateurReseau();
  majPinUI();
  if (typeof renderFilters === 'function') renderFilters();
  if (typeof renderStatutsEditor === 'function') renderStatutsEditor();
  rendu();
  // Rafraîchir aussi la vue active (Suivi / Résumé / Carte)
  if (vueActive === 'rdv') renduRdv();
  else if (vueActive === 'resume') renduResume();
  else if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
}


// Contenu de l'aide par langue (HTML). La ligne de version est ajoutée par renderAide().
const AIDE_HTML = {
  fr: `
    <p>Cette application aide les <strong>enquêteurs Statbel</strong> à suivre leurs contacts à interviewer (enquête sur les forces de travail, LFS). Tout fonctionne <strong>dans votre navigateur</strong> : vos données de suivi restent <strong>stockées localement</strong> (aucune donnée personnelle n'est envoyée à un serveur). Seul le <strong>géocodage</strong> transmet l'adresse postale (sans numéro de boîte) au service géographique public belge de la région concernée. L'application reste utilisable hors-ligne une fois chargée.</p>
    <h3>🗂️ Enquêtes &amp; import</h3>
    <ul>
      <li>Importez vos contacts depuis un fichier <strong>CSV ou Excel</strong> (menu ⋮ → Importer).</li>
      <li>Vous pouvez gérer <strong>plusieurs enquêtes</strong> et basculer de l'une à l'autre via le sélecteur en haut à gauche.</li>
      <li>Chaque fiche contient nom, adresse, GSM, e-mail, données démographiques et notes.</li>
    </ul>
    <h3>👁️ Les trois vues</h3>
    <ul>
      <li><strong>☰ Liste</strong> — toutes les fiches, avec recherche et filtres par statut.</li>
      <li><strong>🗺️ Carte</strong> — localisation des contacts ; filtre par statut, recentrage ⊙, et distance depuis votre position.</li>
      <li><strong>📅 Suivi</strong> — agenda chronologique des rendez-vous planifiés, avec recherche.</li>
    </ul>
    <h3>🏷️ Statuts</h3>
    <p>Chaque fiche a un statut (À faire, En cours, Fait, Absent, Refus). Les statuts sont <strong>personnalisables</strong> dans les Paramètres (couleur, icône, ajout/suppression). Les statuts « terminés » <strong>enregistrent automatiquement la date</strong> de l'action ; un statut « rendez-vous » permet de fixer une date/heure.</p>
    <h3>📍 Localisation &amp; vie privée</h3>
    <ul>
      <li>Le géocodage est routé automatiquement par code postal vers le service public régional (UrbIS/CIRB pour Bruxelles, SPW pour la Wallonie, Geopunt pour la Flandre) — pas de transfert hors UE.</li>
      <li>Les liens de navigation envoient par défaut de simples <strong>coordonnées GPS</strong> (sans nom ni adresse).</li>
    </ul>
    <h3>💾 Données &amp; sécurité</h3>
    <ul>
      <li>Les données sont stockées localement (IndexedDB). Pensez à <strong>Sauvegarder tout (JSON)</strong> régulièrement : un nettoyage du navigateur peut effacer les données.</li>
      <li>Vous pouvez <strong>exporter en CSV</strong>, générer une <strong>vCard</strong> par contact, et restaurer une sauvegarde.</li>
      <li>Un <strong>code PIN</strong> optionnel protège l'accès à l'application.</li>
    </ul>
    <h3>💡 Astuces</h3>
    <ul>
      <li>Sur une fiche, le bouton 🖊️ ouvre l'édition (adresse, démographie, RDV, notes).</li>
      <li>Sur la carte, cliquez un repère pour changer son statut ou éditer la fiche.</li>
      <li>Langue, thème et taille du texte se règlent dans les Paramètres.</li>
    </ul>`,
  nl: `
    <p>Deze app helpt <strong>Statbel-enquêteurs</strong> bij het opvolgen van hun te interviewen contacten (enquête naar de arbeidskrachten, LFS). Alles werkt <strong>in uw browser</strong>: uw opvolggegevens blijven <strong>lokaal opgeslagen</strong> (er worden geen persoonsgegevens naar een server gestuurd). Enkel bij het <strong>geocoderen</strong> wordt het postadres (zonder busnummer) doorgestuurd naar de bevoegde Belgische openbare geografische dienst van het gewest. De app blijft offline bruikbaar na het laden.</p>
    <h3>🗂️ Enquêtes &amp; import</h3>
    <ul>
      <li>Importeer uw contacten uit een <strong>CSV- of Excel-bestand</strong> (menu ⋮ → Importeren).</li>
      <li>U kunt <strong>meerdere enquêtes</strong> beheren en ertussen wisselen via de keuzelijst linksboven.</li>
      <li>Elke fiche bevat naam, adres, gsm, e-mail, demografische gegevens en notities.</li>
    </ul>
    <h3>👁️ De drie weergaven</h3>
    <ul>
      <li><strong>☰ Lijst</strong> — alle fiches, met zoeken en filters per status.</li>
      <li><strong>🗺️ Kaart</strong> — locatie van de contacten; filter per status, hercentreren ⊙, en afstand vanaf uw positie.</li>
      <li><strong>📅 Opvolging</strong> — chronologische agenda van geplande afspraken, met zoeken.</li>
    </ul>
    <h3>🏷️ Statussen</h3>
    <p>Elke fiche heeft een status (Te doen, Bezig, Klaar, Afwezig, Weigering). De statussen zijn <strong>aanpasbaar</strong> in de Instellingen (kleur, pictogram, toevoegen/verwijderen). "Voltooide" statussen <strong>registreren automatisch de datum</strong> van de actie; een "afspraak"-status laat toe een datum/uur vast te leggen.</p>
    <h3>📍 Lokalisatie &amp; privacy</h3>
    <ul>
      <li>De geocodering wordt automatisch via de postcode naar de regionale overheidsdienst geleid (UrbIS/CIBG voor Brussel, SPW voor Wallonië, Geopunt voor Vlaanderen) — geen overdracht buiten de EU.</li>
      <li>De navigatielinks sturen standaard enkel <strong>GPS-coördinaten</strong> (zonder naam of adres).</li>
    </ul>
    <h3>💾 Gegevens &amp; beveiliging</h3>
    <ul>
      <li>De gegevens worden lokaal opgeslagen (IndexedDB). Maak regelmatig een <strong>volledige back-up (JSON)</strong>: het wissen van de browser kan de gegevens verwijderen.</li>
      <li>U kunt <strong>naar CSV exporteren</strong>, een <strong>vCard</strong> per contact genereren en een back-up herstellen.</li>
      <li>Een optionele <strong>pincode</strong> beschermt de toegang tot de app.</li>
    </ul>
    <h3>💡 Tips</h3>
    <ul>
      <li>Op een fiche opent de knop 🖊️ de bewerking (adres, demografie, afspraak, notities).</li>
      <li>Klik op de kaart op een markering om de status te wijzigen of de fiche te bewerken.</li>
      <li>Taal, thema en tekstgrootte stelt u in bij de Instellingen.</li>
    </ul>`,
  en: `
    <p>This app helps <strong>Statbel field interviewers</strong> track the contacts they need to interview (Labour Force Survey, LFS). Everything runs <strong>in your browser</strong>: your tracking data stays <strong>stored locally</strong> (no personal data is sent to a server). Only <strong>geocoding</strong> sends the postal address (without box number) to the relevant Belgian public geographic service for the region. The app stays usable offline once loaded.</p>
    <h3>🗂️ Surveys &amp; import</h3>
    <ul>
      <li>Import your contacts from a <strong>CSV or Excel file</strong> (⋮ menu → Import).</li>
      <li>You can manage <strong>several surveys</strong> and switch between them via the selector at the top left.</li>
      <li>Each record holds name, address, phone, e-mail, demographic data and notes.</li>
    </ul>
    <h3>👁️ The three views</h3>
    <ul>
      <li><strong>☰ List</strong> — all records, with search and status filters.</li>
      <li><strong>🗺️ Map</strong> — contact locations; status filter, recenter ⊙, and distance from your position.</li>
      <li><strong>📅 Tracking</strong> — chronological agenda of scheduled appointments, with search.</li>
    </ul>
    <h3>🏷️ Statuses</h3>
    <p>Each record has a status (To do, In progress, Done, Absent, Refusal). Statuses are <strong>customizable</strong> in Settings (color, icon, add/remove). "Completed" statuses <strong>automatically record the date</strong> of the action; an "appointment" status lets you set a date/time.</p>
    <h3>📍 Location &amp; privacy</h3>
    <ul>
      <li>Geocoding is automatically routed by postal code to the regional public service (UrbIS/CIRB for Brussels, SPW for Wallonia, Geopunt for Flanders) — no transfer outside the EU.</li>
      <li>Navigation links send only plain <strong>GPS coordinates</strong> by default (no name or address).</li>
    </ul>
    <h3>💾 Data &amp; security</h3>
    <ul>
      <li>Data is stored locally (IndexedDB). Remember to <strong>Back up all (JSON)</strong> regularly: clearing the browser can erase the data.</li>
      <li>You can <strong>export to CSV</strong>, generate a <strong>vCard</strong> per contact, and restore a backup.</li>
      <li>An optional <strong>PIN code</strong> protects access to the app.</li>
    </ul>
    <h3>💡 Tips</h3>
    <ul>
      <li>On a record, the 🖊️ button opens editing (address, demographics, appointment, notes).</li>
      <li>On the map, click a marker to change its status or edit the record.</li>
      <li>Language, theme and text size are set in Settings.</li>
    </ul>`,
  de: `
    <p>Diese Anwendung hilft <strong>Statbel-Befragern</strong>, ihre zu befragenden Kontakte zu verfolgen (Arbeitskräfteerhebung, LFS). Alles läuft <strong>in Ihrem Browser</strong>: Ihre Nachverfolgungsdaten bleiben <strong>lokal gespeichert</strong> (es werden keine personenbezogenen Daten an einen Server gesendet). Nur bei der <strong>Geokodierung</strong> wird die Postanschrift (ohne Busnummer) an den zuständigen belgischen öffentlichen Geodienst der Region übermittelt. Die App bleibt nach dem Laden offline nutzbar.</p>
    <h3>🗂️ Umfragen &amp; Import</h3>
    <ul>
      <li>Importieren Sie Ihre Kontakte aus einer <strong>CSV- oder Excel-Datei</strong> (Menü ⋮ → Importieren).</li>
      <li>Sie können <strong>mehrere Umfragen</strong> verwalten und über die Auswahl oben links zwischen ihnen wechseln.</li>
      <li>Jeder Datensatz enthält Name, Adresse, Telefon, E-Mail, demografische Daten und Notizen.</li>
    </ul>
    <h3>👁️ Die drei Ansichten</h3>
    <ul>
      <li><strong>☰ Liste</strong> — alle Datensätze, mit Suche und Statusfiltern.</li>
      <li><strong>🗺️ Karte</strong> — Standorte der Kontakte; Statusfilter, Neuzentrierung ⊙ und Entfernung von Ihrer Position.</li>
      <li><strong>📅 Verfolgung</strong> — chronologische Agenda der geplanten Termine, mit Suche.</li>
    </ul>
    <h3>🏷️ Status</h3>
    <p>Jeder Datensatz hat einen Status (Zu erledigen, In Bearbeitung, Erledigt, Abwesend, Abgelehnt). Die Status sind in den Einstellungen <strong>anpassbar</strong> (Farbe, Symbol, Hinzufügen/Löschen). „Abgeschlossene" Status <strong>erfassen automatisch das Datum</strong> der Aktion; ein „Termin"-Status erlaubt die Festlegung von Datum/Uhrzeit.</p>
    <h3>📍 Lokalisierung &amp; Datenschutz</h3>
    <ul>
      <li>Die Geokodierung wird automatisch nach Postleitzahl an den regionalen öffentlichen Dienst geleitet (UrbIS/CIRB für Brüssel, SPW für Wallonien, Geopunt für Flandern) — keine Übermittlung außerhalb der EU.</li>
      <li>Die Navigationslinks senden standardmäßig nur <strong>GPS-Koordinaten</strong> (ohne Name oder Adresse).</li>
    </ul>
    <h3>💾 Daten &amp; Sicherheit</h3>
    <ul>
      <li>Die Daten werden lokal gespeichert (IndexedDB). Denken Sie daran, regelmäßig <strong>alles zu sichern (JSON)</strong>: Das Leeren des Browsers kann die Daten löschen.</li>
      <li>Sie können <strong>nach CSV exportieren</strong>, pro Kontakt eine <strong>vCard</strong> erzeugen und eine Sicherung wiederherstellen.</li>
      <li>Ein optionaler <strong>PIN-Code</strong> schützt den Zugang zur App.</li>
    </ul>
    <h3>💡 Tipps</h3>
    <ul>
      <li>Auf einem Datensatz öffnet die Schaltfläche 🖊️ die Bearbeitung (Adresse, Demografie, Termin, Notizen).</li>
      <li>Klicken Sie auf der Karte auf eine Markierung, um den Status zu ändern oder den Datensatz zu bearbeiten.</li>
      <li>Sprache, Theme und Textgröße stellen Sie in den Einstellungen ein.</li>
    </ul>`,
};

function renderAide() {
  const body = AIDE_HTML[settings.lang] || AIDE_HTML.fr;
  document.getElementById('aideBody').innerHTML = body
    + `<hr class="kebab-sep" style="margin:12px 0;">
       <p class="aide-copyright">Version <span class="app-version">${APP_VERSION}</span> · © Consultora sprl 2026</p>`;
}

function ouvrirAide()  { renderAide(); document.getElementById('modalAide').classList.add('open'); }
function fermerAide()  { document.getElementById('modalAide').classList.remove('open'); }


// Région majoritaire des contacts affichés (mode auto) — détermine le fond.
function regionDominante() {
  const arrs = (enqueteActive && enquetes[enqueteActive])
    ? [enquetes[enqueteActive]] : Object.values(enquetes);
  const cpt = {};
  arrs.forEach(a => a.forEach(c => {
    const m = (parseAdresse(c.adresse).cpville || '').match(/\d{4}/);
    const r = regionPourCP(m ? m[0] : '');
    cpt[r] = (cpt[r] || 0) + 1;
  }));
  let best = 'bruxelles', n = -1;
  Object.entries(cpt).forEach(([r, v]) => { if (v > n) { n = v; best = r; } });
  return best;
}

// Fond de carte « plan de rue » universel (OpenStreetMap), couvre toute la
// Belgique. Les tuiles ne contiennent que l'image de la carte (pas de donnée
// personnelle) → conforme RGPD. Utilisé pour le fond en mode auto.
const FOND_OSM = {
  tileUrl: function() { return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; },
  tileAttribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  maxZoom: 19
};

// Fond de carte effectif : en mode auto, on affiche un plan de rue OSM unique
// pour toutes les régions (le géocodage, lui, reste routé par région).
function fondEffectif() {
  if (settings.provider !== 'auto') return GEO;
  return FOND_OSM;
}

// Remplace le fond de carte sans recréer la carte entière
let _fondActuel = null;
function rafraichirFond() {
  if (!leafletMap) return;
  const F = fondEffectif();
  if (baseLayer) leafletMap.removeLayer(baseLayer);
  baseLayer = L.tileLayer(F.tileUrl(settings.mapStyle),
    { attribution: F.tileAttribution, maxZoom: F.maxZoom }).addTo(leafletMap);
  _fondActuel = F;
}

// ── Sauvegarde / restauration complète (toutes les enquêtes) ────────

/** Construit le HTML du détail enquêtes × statuts pour un objet enquetes */
function buildBackupDetailHTML(src, meta) {
  const statutsCfg = settings.statuts;

  function colorFor(label) {
    const s = statutsCfg.find(s => s.label === label);
    return s ? s.color : '#90a4ae';
  }
  function iconFor(label) {
    const s = statutsCfg.find(s => s.label === label);
    return s ? s.icon : '•';
  }

  const noms = Object.keys(src);
  let grandTotal = 0;
  let html = '';

  if (meta) {
    html += `<div class="backup-meta">${meta}</div>`;
  }

  noms.forEach(nom => {
    const arr = src[nom] || [];
    const cpt = {};
    arr.forEach(c => {
      const st = c.statut || statutDefaut();
      cpt[st] = (cpt[st] || 0) + 1;
    });
    const tot = arr.length;
    grandTotal += tot;

    let pillsHtml = '';
    // Statuts configurés d'abord, dans l'ordre
    statutsCfg.forEach(s => {
      const nb = cpt[s.label] || 0;
      if (!nb) return;
      const pct = tot ? Math.round(nb / tot * 100) : 0;
      pillsHtml += `<span class="backup-statut-pill" style="background:${s.color}22;color:${s.color}">
        ${esc(s.icon)} ${esc(statutLabel(s.label))} <strong>${nb}</strong> <span style="opacity:.7">(${pct}%)</span>
      </span>`;
    });
    // Statuts hors config (données orphelines)
    Object.entries(cpt).forEach(([st, nb]) => {
      if (statutsCfg.find(s => s.label === st)) return;
      pillsHtml += `<span class="backup-statut-pill" style="background:#eee;color:#666">
        ${esc(st)} <strong>${nb}</strong>
      </span>`;
    });

    html += `
      <div class="backup-enq-block">
        <div class="backup-enq-header">
          <span title="${esc(nom)}">${esc(nom)}</span>
          <span class="backup-enq-total">${tot} contact${tot > 1 ? 's' : ''}</span>
        </div>
        <div class="backup-statuts">${pillsHtml || '<span style="font-size:12px;color:var(--text3)">Aucun contact</span>'}</div>
      </div>`;
  });

  html += `<div class="backup-grand-total">
    <span>${t('bk_total')}</span>
    <span>${grandTotal} ${tPlural('bk_w_contact',grandTotal)} · ${noms.length} ${tPlural('bk_w_survey',noms.length)}</span>
  </div>`;

  return html;
}


function fermerBackupDetail() {
  document.getElementById('modalBackupDetail').classList.remove('open');
}

// Clés de champs : modèle interne (FR) ↔ pivot anglais (export/backup/CSV).
const KEYMAP_OUT = { prenom:'first_name', nom:'last_name', adresse:'address', ordre:'order', sexe:'sex', statut:'status', historique:'history', taille_menage:'household_size', gsm:'mobile_number', rdv:'appointment' };
const KEYMAP_IN  = { first_name:'prenom', last_name:'nom', address:'adresse', order:'ordre', sex:'sexe', status:'statut', history:'historique', household_size:'taille_menage', mobile_number:'gsm', appointment:'rdv' };
function renommerCles(c, map) { const o = {}; for (const k in c) o[map[k] || k] = c[k]; return o; }
function contactVersEN(c) {
  const o = renommerCles(c, KEYMAP_OUT);
  if (Array.isArray(o.history)) o.history = o.history.map(h => renommerCles(h, { statut:'status' }));
  return o;
}
function contactVersInterne(c) {
  const o = renommerCles(c, KEYMAP_IN);
  if (Array.isArray(o.historique)) o.historique = o.historique.map(h => renommerCles(h, { status:'statut' }));
  return o;
}
function enquetesVersEN(enq) { const r = {}; Object.entries(enq).forEach(([n, arr]) => r[n] = arr.map(contactVersEN)); return r; }
function enquetesVersInterne(enq) { const r = {}; Object.entries(enq).forEach(([n, arr]) => r[n] = arr.map(contactVersInterne)); return r; }

function exporterBackup() {
  const date   = new Date();
  const isoNow = date.toISOString();
  // Inclure le cache de géocodage (coords_<adresse> → {lat,lng})
  const coords = {};
  Object.keys(localStorage).forEach(k => {
    if (!k.startsWith('coords_')) return;
    try { coords[k.slice(7)] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
  });
  // Exclure le verrouillage PIN du backup : c'est un réglage propre à
  // l'appareil (et son hash n'a pas à voyager dans un fichier exporté).
  const { pinCode, pinTimeout, ...settingsExport } = settings;
  const data   = JSON.stringify({ version: 2, date: isoNow, settings: settingsExport, surveys: enquetesVersEN(enquetes), coords }, null, 2);
  const blob   = new Blob([data], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const fname  = 'statbel_sauvegarde_' + isoNow.slice(0, 10) + '.json';

  const meta = `${t('bk_date')} ${date.toLocaleDateString(localeApp(), {day:'2-digit',month:'long',year:'numeric'})}
&nbsp;&nbsp;${t('bk_file')} <code>${fname}</code>`;

  const detailHtml = buildBackupDetailHTML(enquetes, meta);

  document.getElementById('modalBackupTitle').textContent = t('bk_save_title');
  document.getElementById('modalBackupBody').innerHTML    = detailHtml;
  document.getElementById('backupPreserveRow').classList.add('hidden');     // options réservées au restore
  document.getElementById('backupOnlyValidRow').classList.add('hidden');
  document.getElementById('restoreExclusDetail').innerHTML = '';
  document.getElementById('restoreExcluded').textContent = '';

  const btnConfirm = document.getElementById('btnBackupConfirm');
  btnConfirm.textContent = t('bk_download');
  btnConfirm.onclick = () => {
    const a = Object.assign(document.createElement('a'), { href: url, download: fname });
    a.click();
    localStorage.setItem('statbel_last_backup', isoNow);
    majLastBackupInfo();
    fermerBackupDetail();
  };

  // Bouton annuler = juste fermer (pas de téléchargement)
  document.querySelector('#modalBackupDetail .btn-secondary').textContent = t('btn_cancel');

  document.getElementById('modalBackupDetail').classList.add('open');
}

// Affiche « Dernière sauvegarde : … » dans la section Données des Paramètres
function majLastBackupInfo() {
  const el = document.getElementById('lastBackupInfo');
  if (!el) return;
  const iso = localStorage.getItem('statbel_last_backup');
  if (!iso) {
    el.textContent = t('backup_none');
    el.style.color = '#e65100';
    return;
  }
  const d = new Date(iso);
  el.textContent = t('backup_last') + ' ' + d.toLocaleDateString(localeApp(),
      { day:'2-digit', month:'long', year:'numeric' })
    + ' ' + t('backup_at') + ' ' + d.toLocaleTimeString(localeApp(), { hour:'2-digit', minute:'2-digit' });
  el.style.color = '';
}

// Stockage temporaire pour la restauration (entre l'aperçu et la confirmation)
let _pendingRestore = null;
let _pendingSettings = null;
let _pendingCoords = null;
let _restoreRaw = null;    // données du backup (normalisées, avant filtrage erreurs)
let _restoreMeta = '';

// (Re)construit la comparaison de restauration selon la case « ne restaurer que les corrects »
function majComparaisonRestore() {
  if (!_restoreRaw) return;
  const onlyValid = (document.getElementById('chkRestoreOnlyValid') || {}).checked;
  const filtered = {};
  const exclus = [];   // {c, raisons, garde}
  Object.entries(_restoreRaw).forEach(([n, arr]) => {
    if (!onlyValid) { filtered[n] = arr; return; }
    const cur = enquetes[n]; const trouver = apparieurAnciens(cur || []);
    const out = [];
    arr.forEach(rec => {
      if (recordEnErreur(rec)) {
        const o = trouver(rec);
        if (o) { out.push(o); exclus.push({ c: rec, raisons: raisonsErreur(rec), garde: true }); }  // existant conservé
        else exclus.push({ c: rec, raisons: raisonsErreur(rec), garde: false });                    // non restauré
      } else out.push(rec);
    });
    filtered[n] = out;
  });
  _pendingRestore = filtered;
  const elX = document.getElementById('restoreExcluded');
  if (elX) elX.textContent = exclus.length ? tf('ip_excluded', { n: exclus.length }) : '';
  const elD = document.getElementById('restoreExclusDetail');
  if (elD) elD.innerHTML = exclus.length ? exclus.map(x => {
    const nom = esc(((x.c.prenom || '') + ' ' + (x.c.nom || '')).trim()) || ('N° ' + esc(String(x.c.ordre || '—')));
    return `<div class="excl-row">⚠️ <b>${nom}</b> — ${x.raisons.map(esc).join(', ')} <span class="excl-state">(${x.garde ? t('ip_excl_kept') : t('ip_excl_skipped')})</span></div>`;
  }).join('') : '';
  const { html, stats } = buildCompareHTML(filtered, _restoreMeta);
  document.getElementById('modalBackupBody').innerHTML = html;
  const btn = document.getElementById('btnBackupConfirm');
  const totChanges = stats.add + stats.rem + stats.mod;
  const suffixExcl = exclus.length ? ' · ' + tf('ip_btn_excl', { n: exclus.length }) : '';
  btn.textContent = (totChanges
    ? tf('bk_confirm_n', { n: totChanges, word: tPlural('cmp_change', totChanges) })
    : t('bk_confirm')) + suffixExcl;
}

function importerBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // Repli vers les clés internes (accepte backups EN « first_name… » et anciens FR « prenom… »)
      const src  = enquetesVersInterne(data.surveys || data.enquetes || data);
      // Correction auto ISO-2 → ISO-3 des codes pays (naissance + nationalité)
      Object.values(src).forEach(arr => arr.forEach(c => {
        if (c.birth_country) c.birth_country = normaliserPays(c.birth_country);
        if (c.nationality)   c.nationality   = normaliserPays(c.nationality);
      }));
      const noms = Object.keys(src);
      if (!noms.length) { alert(t('al_no_survey_file')); return; }

      const dateBackup = data.date
        ? new Date(data.date).toLocaleDateString(localeApp(), {day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'})
        : t('bk_unknown');

      // Détecter conflits (enquêtes de même nom déjà en mémoire)
      const conflits = noms.filter(n => enquetes[n]);
      const metaHtml = `${t('bk_saved_on')} ${dateBackup}
&nbsp;&nbsp;${t('bk_file')} <code>${esc(file.name)}</code>${conflits.length ? `<br>${tf('bk_conflict', { n: conflits.length })}` : ''}`;

      document.getElementById('modalBackupTitle').textContent = t('bk_restore_title');
      _restoreRaw = src;            // données normalisées (avant filtrage)
      _restoreMeta = metaHtml;
      _pendingSettings = data.settings || null;
      _pendingCoords = data.coords || null;
      // Options visibles uniquement au restore
      document.getElementById('backupPreserveRow').classList.remove('hidden');
      document.getElementById('backupOnlyValidRow').classList.remove('hidden');
      document.getElementById('chkPreserveHist').checked = true;
      document.getElementById('chkRestoreOnlyValid').checked = true;
      majComparaisonRestore();      // construit la comparaison + _pendingRestore filtré

      const btnConfirm = document.getElementById('btnBackupConfirm');
      btnConfirm.onclick = () => {
        if (!_pendingRestore) return;
        const preserver = document.getElementById('chkPreserveHist').checked;
        const noms2 = Object.keys(_pendingRestore);
        noms2.forEach(n => {
          let arr = _pendingRestore[n];
          if (preserver && enquetes[n]) {
            // Conserver historique + RDV (et statut/date) des contacts appariés déjà suivis
            const trouver = apparieurAnciens(enquetes[n]);
            arr = arr.map(neu => {
              const o = trouver(neu);
              if (!o) return neu;
              const travaille = (Array.isArray(o.historique) && o.historique.length)
                || (o.statut && o.statut !== statutDefaut()) || o.rdv;
              if (!travaille) return neu;
              const m = Object.assign({}, neu);
              m.statut = o.statut; m.date = o.date;
              if (o.rdv) m.rdv = o.rdv; else delete m.rdv;
              if (Array.isArray(o.historique) && o.historique.length) m.historique = o.historique;
              return m;
            });
          }
          enquetes[n] = arr;
        });
        enqueteActive = enqueteActive || noms2[0];
        // Restaurer le cache de géocodage s'il était présent dans la sauvegarde
        if (_pendingCoords) Object.entries(_pendingCoords).forEach(([adr, v]) => {
          if (v && typeof v.lat === 'number' && typeof v.lng === 'number')
            try { localStorage.setItem('coords_' + adr, JSON.stringify(v)); } catch(e) {}
        });
        // Restaurer aussi les paramètres (statuts personnalisés, thème, fournisseur…)
        if (_pendingSettings) {
          // Préserver le verrouillage PIN local : il ne doit jamais être
          // écrasé/activé par un backup (évite tout blocage de l'app).
          const pinLocal = { pinCode: settings.pinCode, pinTimeout: settings.pinTimeout };
          // Réglages issus d'un fichier externe : jamais fusionnés tels quels.
          // On valide/assainit (clés connues + valeurs contraintes), puis on
          // réimpose le PIN local (validerSettings guarantit déjà des statuts).
          settings = validerSettings(_pendingSettings);
          settings.pinCode = pinLocal.pinCode;
          settings.pinTimeout = pinLocal.pinTimeout;
          GEO = GEO_PROVIDERS[settings.provider] || GEO_PROVIDERS.bruxelles;
          saveSettings();
          appliquerTheme();
          if (leafletMap) rafraichirFond();
        }
        _pendingRestore = null; _pendingSettings = null; _pendingCoords = null;
        migrerVersAnglais();   // backup éventuellement en FR → pivot EN
        sauver();
        refreshSelect();
        rendu();
        majSettingsUI();
        fermerBackupDetail();
        // Petit toast de confirmation
        afficherToast(tf('toast_restore_done', { n: noms2.length }), 3000);
      };

      document.querySelector('#modalBackupDetail .btn-secondary').textContent = t('btn_cancel');
      document.getElementById('modalBackupDetail').classList.add('open');

    } catch(err) { alert(t('al_backup_invalid') + err.message); }
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
}

function viderCacheCoords() {
  const sel = document.getElementById('viderCacheScope');
  const scope = sel ? sel.value : '__all__';
  let keys;
  if (scope && scope !== '__all__' && enquetes[scope]) {
    // Ne purger que les adresses appartenant à cette enquête
    const cles = new Set(enquetes[scope].map(c => 'coords_' + adresseSansBoite(c.adresse)));
    keys = Object.keys(localStorage).filter(k => cles.has(k));
  } else {
    keys = Object.keys(localStorage).filter(k => k.startsWith('coords_'));
  }
  if (!keys.length) { alert(t('al_cache_empty_sel')); return; }
  const portee = (scope && scope !== '__all__') ? tf('cf_clear_scope', { name: scope }) : '';
  if (!confirm(tf('cf_clear_cache', { n: keys.length, portee }))) return;
  keys.forEach(k => localStorage.removeItem(k));
  majSettingsUI();
  rendu();
  if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
}

// ── Lister les adresses non géocodées ───────────────────────────────
let _nonGeoAll = [];
let _nonGeoFiltre = 'Tous';

function listerNonGeocodees() {
  _nonGeoAll = [];
  Object.entries(enquetes).forEach(([enq, arr]) => {
    arr.forEach((c, idx) => { if (!coordsCache(c.adresse)) _nonGeoAll.push({ enq, idx, c }); });
  });
  // Par défaut, filtrer sur l'enquête active si elle a des non-géocodées
  const enqs = [...new Set(_nonGeoAll.map(x => x.enq))];
  _nonGeoFiltre = (enqueteActive && enqs.includes(enqueteActive)) ? enqueteActive : 'Tous';
  renderNonGeo();
}

function renderNonGeo() {
  const box = document.getElementById('nonGeoList');
  if (!_nonGeoAll.length) {
    box.innerHTML = '<div class="nongeo-ok">✅ Toutes les adresses sont géocodées.</div>';
    return;
  }
  const enqs = [...new Set(_nonGeoAll.map(x => x.enq))];
  const cnt  = e => _nonGeoAll.filter(x => x.enq === e).length;
  const items = _nonGeoFiltre === 'Tous' ? _nonGeoAll : _nonGeoAll.filter(x => x.enq === _nonGeoFiltre);
  const opts = `<option value="Tous"${_nonGeoFiltre === 'Tous' ? ' selected' : ''}>Toutes les enquêtes (${_nonGeoAll.length})</option>` +
    enqs.map(e => `<option value="${esc(e)}"${e === _nonGeoFiltre ? ' selected' : ''}>${esc(e)} (${cnt(e)})</option>`).join('');
  box.innerHTML =
    `<select class="nongeo-filtre" onchange="_nonGeoFiltre=this.value;renderNonGeo()">${opts}</select>
     <div class="nongeo-head">${items.length} adresse(s) non géocodée(s) — cliquez pour ouvrir la fiche :</div>` +
    items.map(({enq, idx, c}) =>
      `<button class="nongeo-item" onclick="allerAFiche('${enq.replace(/'/g,"\\'")}',${idx})">
        <span class="nongeo-ref">${esc(enq)} › N°${esc(c.ordre)}</span>
        <span class="nongeo-name">${esc(c.prenom)} ${esc(c.nom)}</span>
        <span class="nongeo-adr">📍 ${esc(c.adresse||'(adresse vide)')}</span>
        <span class="nongeo-adr" style="color:#1a73e8">🔎 envoyé : ${esc(adresseSansBoite(c.adresse)||'(vide)')}</span>
      </button>`
    ).join('');
}

function allerAFiche(enq, idx) {
  enqueteActive = enq;
  sauver();
  refreshSelect();
  filtreActif = 'Tous';
  fermerSettings();
  setView('liste');
  setTimeout(() => {
    const el = ouvrirEdit(idx);
    if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
  }, 250);
}


// Rafraîchit toutes les vues dépendant des statuts (sans toucher à l'éditeur)
function rafraichirStatutsVues() {
  renderFilters();
  renderLegend();
  rendu();
  if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
  if (vueActive === 'rdv') renduRdv();
  majSettingsUI();
}


function toggleKebab() { document.getElementById('kebabMenu').classList.toggle('open'); }
document.addEventListener('click', e => {
  const wrap=document.querySelector('.kebab-wrap');
  if (wrap&&!wrap.contains(e.target)) document.getElementById('kebabMenu').classList.remove('open');
});

// Autocomplétion email
const EMAIL_DOMAINES = ['gmail.com','skynet.be','yahoo.com','hotmail.com','outlook.com','live.be','telenet.be','proximus.be','icloud.com'];

function emailSuggest(input, sugId) {
  const val=input.value, at=val.indexOf('@'), box=document.getElementById(sugId);
  if (!box) return;
  if (at<0){fermerSuggestions(sugId);return;}
  const avant=val.slice(0,at+1), apres=val.slice(at+1).toLowerCase();
  const filtres=EMAIL_DOMAINES.filter(d=>d.startsWith(apres));
  if (!filtres.length){fermerSuggestions(sugId);return;}
  box.innerHTML=filtres.map((d,idx)=>`<button class="email-sug-item" data-idx="${idx}" onmousedown="choisirSuggestion(event,'${sugId}','${avant}${d}')">${avant}${d}</button>`).join('');
  box.classList.add('open');
}

function choisirSuggestion(e, sugId, valeur) {
  e.preventDefault();
  const box=document.getElementById(sugId); if(!box) return;
  const input=box.closest('.email-wrap').querySelector('input'); if(!input) return;
  input.value=valeur;
  changerEmail(parseInt(sugId.replace('esug-','')), valeur);
  fermerSuggestions(sugId); input.focus();
}

function fermerSuggestions(sugId) { const b=document.getElementById(sugId); if(b) b.classList.remove('open'); }

function emailKeydown(e, sugId) {
  const box=document.getElementById(sugId); if(!box||!box.classList.contains('open')) return;
  const items=box.querySelectorAll('.email-sug-item'), focused=box.querySelector('.focused');
  let idx=focused?parseInt(focused.dataset.idx):-1;
  if (e.key==='ArrowDown'){e.preventDefault();if(focused)focused.classList.remove('focused');items[(idx+1)%items.length].classList.add('focused');}
  else if (e.key==='ArrowUp'){e.preventDefault();if(focused)focused.classList.remove('focused');items[(idx-1+items.length)%items.length].classList.add('focused');}
  else if (e.key==='Enter'&&focused){e.preventDefault();focused.dispatchEvent(new MouseEvent('mousedown'));}
  else if (e.key==='Escape') fermerSuggestions(sugId);
}


// ════════════════════════════════════════════════════════════════════
// INIT — Démarrage asynchrone de l'application
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// EXPORT RÉSUMÉ — XLSX et PDF (impression navigateur)
// ════════════════════════════════════════════════════════════════════

function exporterResumeXLSX() {
  const wb = XLSX.utils.book_new();
  const nomEnquetes = Object.keys(enquetes);
  const statutsCfg  = settings.statuts;

  // ── Feuille 1 : Tableau croisé ──────────────────────────────────
  const header = ['Enquête', ...statutsCfg.map(s => s.icon + ' ' + s.label), 'Total'];
  const rows   = [header];

  const totauxParStatut = {};
  statutsCfg.forEach(s => totauxParStatut[s.label] = 0);
  let grandTotal = 0;

  nomEnquetes.forEach(nom => {
    const cpt = {};
    statutsCfg.forEach(s => cpt[s.label] = 0);
    (enquetes[nom] || []).forEach(c => {
      const st = c.statut || statutDefaut();
      if (cpt[st] !== undefined) cpt[st]++;
      else cpt[st] = 1;
      totauxParStatut[st] = (totauxParStatut[st] || 0) + 1;
      grandTotal++;
    });
    const tot = Object.values(cpt).reduce((a,b)=>a+b, 0);
    rows.push([nom, ...statutsCfg.map(s => cpt[s.label] || 0), tot]);
  });

  // Ligne totaux
  rows.push(['TOTAL', ...statutsCfg.map(s => totauxParStatut[s.label] || 0), grandTotal]);

  const ws1 = XLSX.utils.aoa_to_sheet(rows);

  // Largeurs de colonnes
  ws1['!cols'] = [
    { wch: 35 },
    ...statutsCfg.map(() => ({ wch: 12 })),
    { wch: 10 }
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Résumé');

  // ── Feuille 2 : Détail par statut (%) ──────────────────────────
  const header2 = ['Enquête', 'Total', ...statutsCfg.map(s => s.label + ' (%)') ];
  const rows2   = [header2];

  nomEnquetes.forEach(nom => {
    const cpt = {};
    statutsCfg.forEach(s => cpt[s.label] = 0);
    (enquetes[nom] || []).forEach(c => {
      const st = c.statut || statutDefaut();
      if (cpt[st] !== undefined) cpt[st]++;
    });
    const tot = Object.values(cpt).reduce((a,b)=>a+b, 0);
    rows2.push([
      nom, tot,
      ...statutsCfg.map(s => tot ? +(cpt[s.label]/tot*100).toFixed(1) : 0)
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2['!cols'] = [{ wch: 35 }, { wch: 8 }, ...statutsCfg.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, ws2, 'Pourcentages');

  // ── Feuille 3 : KPI global ──────────────────────────────────────
  const rows3 = [
    ['Indicateur', 'Valeur', '%'],
    ['Total contacts', grandTotal, '100%'],
    ...statutsCfg.map(s => {
      const nb  = totauxParStatut[s.label] || 0;
      const pct = grandTotal ? (nb/grandTotal*100).toFixed(1)+'%' : '0%';
      return [s.icon + ' ' + s.label, nb, pct];
    }),
    [],
    ['Nombre d\'enquêtes', nomEnquetes.length, ''],
    ['Date export', new Date().toLocaleDateString('fr-BE'), ''],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(rows3);
  ws3['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'KPI');

  const date = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `statbel_resume_${date}.xlsx`);
}

function exporterResumePDF() {
  // Bascule sur la vue résumé si on n'y est pas déjà
  if (vueActive !== 'resume') setView('resume');
  setTimeout(() => window.print(), 150);
}


// ════════════════════════════════════════════════════════════════════
// VUE RÉSUMÉ — KPI cards + barre de progression + tableau croisé
// ════════════════════════════════════════════════════════════════════


let resumeScope = 'all';   // 'all' = toutes les enquêtes | 'active' = enquête sélectionnée
function setResumeScope(s) { resumeScope = s; renduResume(); }

function renduResume() {
  const box = document.getElementById('resumeContainer');
  if (!box) return;

  // ── Collecte des données (périmètre : toutes les enquêtes ou l'enquête active) ──
  const toutesEnq   = Object.keys(enquetes);
  const scopeActive = resumeScope === 'active' && enqueteActive && enquetes[enqueteActive];
  const nomEnquetes = scopeActive ? [enqueteActive] : toutesEnq;
  const statutsCfg  = settings.statuts; // [{ label, color, icon }]

  // Pour chaque statut, couleur et icône
  const statutMap = {};
  statutsCfg.forEach(s => { statutMap[s.label] = s; });

  // Couleur de fallback pour un statut inconnu
  function colorFor(label) {
    return (statutMap[label] && statutMap[label].color) || '#90a4ae';
  }
  function iconFor(label) {
    return (statutMap[label] && statutMap[label].icon) || '•';
  }

  // Tous les statuts présents dans les données (+ ceux de la config)
  const statutsPresents = new Set(statutsCfg.map(s => s.label));
  Object.values(enquetes).forEach(arr =>
    arr.forEach(c => statutsPresents.add(c.statut || statutDefaut()))
  );
  const statutsListe = [...statutsPresents];

  // Matrice : { [enquete]: { [statut]: count } }
  const matrice = {};
  let grandTotal = 0;
  const totauxParStatut = {};
  statutsListe.forEach(s => totauxParStatut[s] = 0);

  nomEnquetes.forEach(nom => {
    matrice[nom] = {};
    statutsListe.forEach(s => matrice[nom][s] = 0);
    (enquetes[nom] || []).forEach(c => {
      const st = c.statut || statutDefaut();
      if (!matrice[nom][st]) matrice[nom][st] = 0;
      matrice[nom][st]++;
      totauxParStatut[st] = (totauxParStatut[st] || 0) + 1;
      grandTotal++;
    });
  });

  // Totaux par enquête
  const totauxParEnquete = {};
  nomEnquetes.forEach(nom => {
    totauxParEnquete[nom] = Object.values(matrice[nom]).reduce((a,b) => a+b, 0);
  });

  // ── KPI cards ────────────────────────────────────────────────────
  // Trouver "Fait" et "À faire" dynamiquement
  const doneStatuts  = statutsCfg.filter(s => s.done).map(s => s.label);
  const rdvStatuts   = statutsCfg.filter(s => s.rdv).map(s => s.label);

  const nbFait   = doneStatuts.reduce((acc, s) => acc + (totauxParStatut[s] || 0), 0);
  const nbAfaire = (totauxParStatut[statutDefaut()] || 0);
  const nbRdv    = rdvStatuts.reduce((acc, s) => acc + (totauxParStatut[s] || 0), 0);
  const pctFait  = grandTotal ? Math.round(nbFait / grandTotal * 100) : 0;

  let kpiHtml = `
    <div class="kpi-card" style="border-top-color:#1a237e">
      <div class="kpi-val">${grandTotal}</div>
      <div class="kpi-lbl">${t('res_total_contacts')}</div>
      <div class="kpi-pct">${labelNbEnquetes(nomEnquetes.length)}</div>
    </div>`;

  statutsCfg.forEach(s => {
    const nb  = totauxParStatut[s.label] || 0;
    const pct = grandTotal ? Math.round(nb / grandTotal * 100) : 0;
    kpiHtml += `
    <div class="kpi-card" style="border-top-color:${s.color}">
      <div class="kpi-val" style="color:${s.color}">${nb}</div>
      <div class="kpi-lbl">${esc(s.icon)} ${esc(statutLabel(s.label))}</div>
      <div class="kpi-pct">${pct}%</div>
    </div>`;
  });

  // ── Barre de progression empilée ─────────────────────────────────
  let barHtml = '<div class="progress-stacked">';
  statutsCfg.forEach(s => {
    const nb  = totauxParStatut[s.label] || 0;
    if (!nb || !grandTotal) return;
    const pct = (nb / grandTotal * 100).toFixed(1);
    barHtml += `<div class="progress-seg" style="width:${pct}%;background:${s.color}" title="${esc(statutLabel(s.label))} : ${nb} (${pct}%)"></div>`;
  });
  barHtml += '</div>';

  let legendHtml = '<div class="progress-legend">';
  statutsCfg.forEach(s => {
    const nb  = totauxParStatut[s.label] || 0;
    if (!nb) return;
    const pct = grandTotal ? (nb / grandTotal * 100).toFixed(1) : 0;
    legendHtml += `
      <div class="prog-leg-item">
        <div class="prog-leg-dot" style="background:${s.color}"></div>
        <span>${esc(s.icon)} ${esc(statutLabel(s.label))} — <strong>${nb}</strong> (${pct}%)</span>
      </div>`;
  });
  legendHtml += '</div>';

  // ── Tableau croisé ───────────────────────────────────────────────
  let thStatuts = statutsCfg.map(s =>
    `<th style="border-bottom:3px solid ${s.color}">${esc(s.icon)}<br>${esc(statutLabel(s.label))}</th>`
  ).join('');

  let tableHtml = `
    <div class="resume-table-wrap">
      <table class="resume-table">
        <thead>
          <tr>
            <th>${t('res_col_survey')}</th>
            ${thStatuts}
            <th>${t('res_col_total')}</th>
          </tr>
        </thead>
        <tbody>`;

  nomEnquetes.forEach(nom => {
    const tot = totauxParEnquete[nom] || 0;
    let cells = statutsCfg.map(s => {
      const nb = matrice[nom][s.label] || 0;
      if (!nb) return `<td><span class="cell-zero">—</span></td>`;
      const pct = tot ? Math.round(nb/tot*100) : 0;
      return `<td>
        <div class="cell-bar-wrap">
          <span class="cell-badge" style="background:${s.color}22;color:${s.color}">${nb}</span>
          <span style="font-size:10px;color:var(--text3)">${pct}%</span>
        </div>
      </td>`;
    }).join('');

    // Barre mini de progression dans la colonne Total
    let miniBar = '<div style="height:6px;border-radius:3px;overflow:hidden;display:flex;min-width:60px;margin-top:4px">';
    statutsCfg.forEach(s => {
      const nb = matrice[nom][s.label] || 0;
      if (!nb || !tot) return;
      const pct = (nb/tot*100).toFixed(1);
      miniBar += `<div style="width:${pct}%;background:${s.color};height:100%"></div>`;
    });
    miniBar += '</div>';

    tableHtml += `
      <tr>
        <td title="${esc(nom)}">${esc(nom)}</td>
        ${cells}
        <td>
          <strong>${tot}</strong>
          ${miniBar}
        </td>
      </tr>`;
  });

  // Ligne totaux
  let totalCells = statutsCfg.map(s => {
    const nb = totauxParStatut[s.label] || 0;
    const pct = grandTotal ? Math.round(nb/grandTotal*100) : 0;
    return nb
      ? `<td><span class="cell-badge" style="background:${s.color}22;color:${s.color}">${nb}</span> <small style="color:var(--text3)">${pct}%</small></td>`
      : `<td><span class="cell-zero">—</span></td>`;
  }).join('');

  tableHtml += `
        <tr class="resume-total">
          <td>${t('res_total_row')}</td>
          ${totalCells}
          <td><strong>${grandTotal}</strong></td>
        </tr>
        </tbody>
      </table>
    </div>`;

  // ── Assemblage final ──────────────────────────────────────────────
  box.innerHTML = `
    <div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div>
          <div class="resume-title">${t('res_title')} — ${labelNbEnquetes(nomEnquetes.length)}</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
            <button class="resume-scope-btn${resumeScope === 'all' ? ' actif' : ''}" onclick="setResumeScope('all')">🗂️ ${t('res_scope_all')} (${toutesEnq.length})</button>
            <button class="resume-scope-btn${resumeScope === 'active' ? ' actif' : ''}" onclick="setResumeScope('active')"${!enqueteActive ? ' disabled' : ''}>📋 ${enqueteActive ? esc(enqueteActive) : t('res_scope_active')}</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">
            ${t('res_updated')} ${new Date().toLocaleTimeString(localeApp(), {hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
        <div class="resume-export-bar">
          <button class="btn-export btn-export-xlsx" onclick="exporterResumeXLSX()">${t('btn_xlsx')}</button>
          <button class="btn-export btn-export-pdf"  onclick="exporterResumePDF()">${t('btn_pdf')}</button>
        </div>
      </div>
      <div class="resume-print-header" style="margin-top:8px;font-size:11px;color:#666;">
        Statbel – Interviews · ${t('res_exported')} ${new Date().toLocaleDateString(localeApp(), {day:'2-digit',month:'long',year:'numeric'})}
      </div>
    </div>
    <div>
      <div class="resume-section-title">${t('res_kpi')}</div>
      <div class="kpi-grid">${kpiHtml}</div>
    </div>
    <div>
      <div class="resume-section-title">${t('res_progress')}</div>
      ${barHtml}
      ${legendHtml}
    </div>
    <div>
      <div class="resume-section-title">${t('cumul_title')}</div>
      ${renderCourbeAvancement(scopeActive ? enqueteActive : null)}
    </div>
    <div>
      <div class="resume-section-title">${t('res_table')}</div>
      ${tableHtml}
    </div>`;
}


// Migration vers le pivot anglais : convertit statuts et états civils FR → EN
// dans les paramètres et toutes les enquêtes. Idempotent (sans effet si déjà EN).
function migrerVersAnglais() {
  let chg = false;
  (settings.statuts || []).forEach(s => { const en = statutCanon(s.label); if (en !== s.label) { s.label = en; chg = true; } });
  Object.values(enquetes).forEach(arr => arr.forEach(c => {
    if (c.statut) { const en = statutCanon(c.statut); if (en !== c.statut) { c.statut = en; chg = true; } }
    if (c.marital_status) { const m = maritalCanon(c.marital_status); if (m !== c.marital_status) { c.marital_status = m; chg = true; } }
    if (Array.isArray(c.historique)) c.historique.forEach(h => {
      if (h && h.statut) { const en = statutCanon(h.statut); if (en !== h.statut) { h.statut = en; chg = true; } }
    });
  }));
  if (filtreActif && filtreActif !== 'Tous') filtreActif = statutCanon(filtreActif);
  if (chg) { saveSettings(); sauver(); }
}

async function init() {
  chargerSettings();
  appliquerTheme();
  appliquerPolice();
  appliquerLangue();

  // Persistance du stockage : demande au navigateur de ne pas purger IndexedDB/
  // localStorage (sinon iOS/Safari peut tout effacer après 7 jours d'inactivité,
  // Android sous pression de stockage). Best-effort, silencieux si refusé.
  try {
    if (navigator.storage && navigator.storage.persist) {
      const deja = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (!deja) await navigator.storage.persist();
    }
  } catch (e) { /* API indisponible : on continue */ }

  // Verrouillage PIN affiché AVANT tout rendu : l'overlay opaque (z-index 9999)
  // recouvre l'écran dès le départ → aucune donnée nominative ne « flashe ».
  pinVerifierAuDemarrage();

  await charger();
  migrerVersAnglais();   // pivot EN : convertit les anciennes données FR

  // Purger les coordonnées invalides ou hors Belgique du localStorage
  Object.keys(localStorage).forEach(k => {
    if (!k.startsWith('coords_')) return;
    if (/bte\s*\d+|ET\w+|b\d{2,}/i.test(k)) { localStorage.removeItem(k); return; }
    try {
      const v = JSON.parse(localStorage.getItem(k));
      if (!v||!v.lat||!v.lng||v.lat<49.5||v.lat>51.5||v.lng<2.5||v.lng>6.5)
        localStorage.removeItem(k);
    } catch(e) { localStorage.removeItem(k); }
  });

  refreshSelect();
  rendu();
  restaurerIndicateur();
  setupA11y();
  document.querySelectorAll('.app-version').forEach(el => el.textContent = APP_VERSION);

  pinSurveillerInactivite();
}

// ── Pont de compatibilité (module → global) ───────────────────────
// app.js est un module ES (scope isolé). Les gestionnaires inline du HTML
// (onclick=…) et les tests headless attendent ces fonctions dans le scope
// global : on les y réexpose explicitement. (L'état mutable partagé — settings,
// enquetes, enqueteActive, db, filtreActif, _lastSaved — est déclaré via
// globalThis plus haut.) À mesure que les onclick migrent vers
// addEventListener, cette liste se réduira.
Object.assign(window, {
  validerSettings, validerStatuts,
  debounce, esc, correspondRecherche, regionPourCP, chargerSettings, saveSettings,
  statutDefs, statutDefaut, statutDef, ouvrirDB, idbReq, idbTx, majEtatSauvegarde,
  signalerEchecSauvegarde, sauver, charger, coordsCache, saveCoords, majIndicateurReseau,
  restaurerIndicateur, setupA11y, majBackupBanner, fermerBackupBanner, contacts,
  contactsFiltres, refreshSelect, changerEnquete, renommerEnquete, fermerRename,
  confirmerRename, supprimerEnquete, parseAdresse, composeAdresse, adresseSansBoite,
  mapsUrl, todayStr, nowHHMM, dateFrToISO, dateISOToFr, formatDateJour, changerStatut,
  sauverBientot, flushSauver, changerNotes, changerEmail, changerGsm, formaterGsm,
  formatHeureSaisie, lireRdvFields, changerRdvDH, ouvrirCalendrierRdv, majAge, formatRdv,
  calcAge, maritalCanon, etatCivilGenre, paysNom, normaliserPays, paysAffiche,
  detecterNonTraduits, renderNonTraduits, detecterIncoherences, renderCoherence,
  statutCanon, statutLabel, ligneDemographie, toggleEdit, ouvrirEdit, buildEditForm,
  sauverEdit, filtrer, champLabel, parseCSVRows, parseCSV, splitLine, importerFichier,
  ouvrirModalImport, preparerImport, renderExclus, majComparaisonImport,
  renderImportApercu, confirmerImport, fermerModal, csvGuard, csvDeguard, csvCell,
  sepRegionalAuto, sepCSVexport, genererCSV, exporterCSV, exporterVCard, renderFilters,
  rendu, haversine, formatDist, distanceBadge, afficherToast, toggleMaPosition,
  demanderPosition, placerMarqueurMoi, recentrerCarte, changerStatutCarte,
  ouvrirFicheDepuisCarte, renderLegend, initCarte, redessinerCourbeApresLayout,
  afficherMarqueurs, filtrerActiviteJour, ouvrirFicheEvtIdx, rdvTitreStatut,
  renderRdvFilters, filtrerRdv, renduRdv, buildHistoriqueHTML, rafraichirHistorique,
  trierHistorique, syncStatutCourant, majCarteStatut, apresModifHistorique,
  ajouterHistorique, modifierStatutHistorique, modifierRdvHistorique, formatDateFrSaisie,
  ouvrirCalendrierHist, ouvrirCalendrierRdvHist, changerDateHistorique,
  supprimerHistorique, buildRdvCard, setView, appliquerTheme, appliquerPolice, t, tf,
  tPlural, appliquerLangue, changerLangue, localeApp, nomJourCourt, labelNbEnquetes,
  ouvrirSettings, fermerSettings, renderAide, ouvrirAide, fermerAide, majSettingsUI,
  changerProvider, regionDominante, fondEffectif, rafraichirFond, buildBackupDetailHTML,
  _contactKey, apparieurAnciens, jourValide, valeurIncoherente, diffHistorique,
  recordEnErreur, raisonsErreur, _diffContacts, buildCompareHTML, fermerBackupDetail,
  renommerCles, contactVersEN, contactVersInterne, enquetesVersEN, enquetesVersInterne,
  exporterBackup, majLastBackupInfo, majComparaisonRestore, importerBackup,
  viderCacheCoords, listerNonGeocodees, renderNonGeo, allerAFiche, renderStatutsEditor,
  rafraichirStatutsVues, modifierStatut, ajouterStatut, supprimerStatut, toggleKebab,
  emailSuggest, choisirSuggestion, fermerSuggestions, emailKeydown, exporterResumeXLSX,
  exporterResumePDF, collecterVisites, renderActiviteQuotidienne, renderProgressionGlobale,
  renderCourbeAvancement, dessinerCourbeProgression, renderEvenementsChrono,
  setResumeScope, renduResume, _pinHash, pinEstActif, renderLockDots, renderLockKeypad,
  pinToucheAppuyee, pinAfficherErreur, pinValiderSaisie, ouvrirLockScreen,
  fermerLockScreen, ouvrirGestionPin, fermerModalPin, pinChanger, pinDesactiver, majPinUI,
  pinVerifierAuDemarrage, pinSurveillerInactivite, migrerVersAnglais, init
});

init();
