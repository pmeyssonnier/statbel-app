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
  toggleMaPosition, demanderPosition, placerMarqueurMoi, recentrerCarte,
  changerStatutCarte, ouvrirFicheDepuisCarte, renderLegend, initCarte,
  afficherMarqueurs, regionDominante, fondEffectif, rafraichirFond,
} from './ui/map.js';
import {
  contactsFiltres, changerStatut, changerNotes, changerEmail, changerGsm, changerMenage,
  lireRdvFields, changerRdvDH, ouvrirCalendrierRdv, majAge, formatRdv,
  ligneDemographie, toggleEdit, ouvrirEdit, buildEditForm, sauverEdit, filtrer,
  exporterVCard, renderFilters, rendu, distanceBadge, haversine, formatDist,
  buildHistoriqueHTML, majCarteStatut, buildRdvCard, emailSuggest, choisirSuggestion,
  fermerSuggestions, emailKeydown, allerAFiche, toggleKebab,
} from './ui/contacts.js';
import {
  filtrerActiviteJour, ouvrirFicheEvtIdx, rdvTitreStatut,
  renderRdvFilters, filtrerRdv, renduRdv,
} from './ui/rdv.js';
import {
  exporterResumeXLSX, exporterResumePDF, setResumeScope, renduResume,
} from './ui/resume.js';
import {
  majBackupBanner, fermerBackupBanner, buildBackupDetailHTML, fermerBackupDetail,
  renommerCles, contactVersEN, contactVersInterne, enquetesVersEN, enquetesVersInterne,
  exporterBackup, majLastBackupInfo, majKebabBackupInfo, majComparaisonRestore, importerBackup,
} from './features/backup.js';

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
const APP_VERSION = '3.17';

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


// ════════════════════════════════════════════════════════════════════
// STATE — Variables globales et sélecteur d'enquêtes
// ════════════════════════════════════════════════════════════════════

globalThis.enquetes      = {};    // globaux partagés (gestionnaires inline + tests)
globalThis.enqueteActive = '';
globalThis.filtreActif   = 'Tous';

function contacts() { return enquetes[enqueteActive] || []; }


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


// ════════════════════════════════════════════════════════════════════
// RENDU — Génération HTML des cards et filtres
// ════════════════════════════════════════════════════════════════════


// Sélecteur de statut du header (vue carte) — reflète le filtre actif


// ════════════════════════════════════════════════════════════════════
// GÉOLOC — Position GPS, Haversine, marqueur Ma position
// ════════════════════════════════════════════════════════════════════


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

// ── Popup « Mise à jour disponible » (opt-in) ─────────────────────────
// Appelé par le script de service worker (index.html) quand un nouveau SW est
// installé et en attente. L'utilisateur choisit de poser la maj (rechargement)
// ou de la reporter — aucune interruption automatique de la saisie en cours.
function signalerMajDispo() {
  if (!window.__swWaiting) return;                 // rien en attente
  if (document.getElementById('majDispo')) return; // déjà affiché
  const d = document.createElement('div');
  d.id = 'majDispo';
  d.className = 'maj-popup';
  d.setAttribute('role', 'status');
  d.innerHTML =
    `<span class="maj-ico" aria-hidden="true">⬆️</span>` +
    `<span class="maj-msg">${esc(t('maj_dispo'))}</span>` +
    `<button class="maj-poser" onclick="poserMaj()">${esc(t('maj_poser'))}</button>` +
    `<button class="maj-later" aria-label="${esc(t('maj_plus_tard'))}" title="${esc(t('maj_plus_tard'))}" onclick="fermerMajDispo()"><span aria-hidden="true">✕</span></button>`;
  document.body.appendChild(d);
}
function poserMaj() {
  const w = window.__swWaiting;
  const btn = document.querySelector('#majDispo .maj-poser');
  if (btn) { btn.disabled = true; btn.textContent = t('maj_en_cours'); }
  // Demande au SW en attente de prendre la main ; controllerchange (index.html)
  // rechargera la page une fois qu'il contrôle les clients.
  if (w) w.postMessage({ type: 'SKIP_WAITING' });
}
function fermerMajDispo() {
  const d = document.getElementById('majDispo');
  if (d) d.remove();
  // On garde __swWaiting : la maj sera reproposée au prochain lancement.
}


// ════════════════════════════════════════════════════════════════════
// CARTE — Leaflet, marqueurs, géocodage UrbIS (CIRB, Région bruxelloise)
// ════════════════════════════════════════════════════════════════════


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


// ════════════════════════════════════════════════════════════════════
// ÉTAT DU JOURNAL D'ACTIVITÉ — partagé entre ui/rdv.js et ui/stats.js
// ════════════════════════════════════════════════════════════════════
globalThis._activiteJour = null;   // jour ISO sélectionné dans le graphe (filtre le journal) — partagé avec ui/stats.js
globalThis._journalEvents = [];    // événements affichés dans le journal (clic → fiche) — partagé avec ui/stats.js


/** Insère les barres obliques pendant la saisie : 12062026 → 12/06/2026 */
function formatDateFrSaisie(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}


// ════════════════════════════════════════════════════════════════════
// UI — Navigation vues, thème, menu ⋮, email autocomplete
// ════════════════════════════════════════════════════════════════════

globalThis.vueActive = 'liste';   // vue courante (liste/carte/rdv/resume) — global partagé

function setView(v) {
  vueActive = v;
  ['liste','carte','rdv','resume'].forEach(id => {
    const btn = document.getElementById('btn'+id.charAt(0).toUpperCase()+id.slice(1));
    if (btn) { const on = v===id; btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', on); }  // a11y : vue active exposée
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


// Remplace le fond de carte sans recréer la carte entière

// ── Sauvegarde / restauration complète (toutes les enquêtes) ────────


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


// Rafraîchit toutes les vues dépendant des statuts (sans toucher à l'éditeur)
function rafraichirStatutsVues() {
  renderFilters();
  renderLegend();
  rendu();
  if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
  if (vueActive === 'rdv') renduRdv();
  majSettingsUI();
}


document.addEventListener('click', e => {
  const wrap=document.querySelector('.kebab-wrap');
  if (wrap&&!wrap.contains(e.target)) document.getElementById('kebabMenu').classList.remove('open');
});


// ════════════════════════════════════════════════════════════════════
// INIT — Démarrage asynchrone de l'application
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// EXPORT RÉSUMÉ — XLSX et PDF (impression navigateur)
// ════════════════════════════════════════════════════════════════════


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

  // Mise à jour PWA détectée avant que le pont soit prêt (course de chargement) :
  // le script SW a posé le drapeau, on affiche le popup maintenant.
  if (window.__majDispo) signalerMajDispo();

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
  sauverBientot, flushSauver, changerNotes, changerEmail, changerGsm, changerMenage, formaterGsm,
  formatHeureSaisie, lireRdvFields, changerRdvDH, ouvrirCalendrierRdv, majAge, formatRdv,
  calcAge, maritalCanon, etatCivilGenre, paysNom, normaliserPays, paysAffiche,
  detecterNonTraduits, renderNonTraduits, detecterIncoherences, renderCoherence,
  statutCanon, statutLabel, ligneDemographie, toggleEdit, ouvrirEdit, buildEditForm,
  sauverEdit, filtrer, champLabel, parseCSVRows, parseCSV, splitLine, importerFichier,
  ouvrirModalImport, preparerImport, renderExclus, majComparaisonImport,
  renderImportApercu, confirmerImport, fermerModal, csvGuard, csvDeguard, csvCell,
  sepRegionalAuto, sepCSVexport, genererCSV, exporterCSV, exporterVCard, renderFilters,
  rendu, haversine, formatDist, distanceBadge, afficherToast,
  signalerMajDispo, poserMaj, fermerMajDispo, toggleMaPosition,
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
  exporterBackup, majLastBackupInfo, majKebabBackupInfo, majComparaisonRestore, importerBackup,
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
