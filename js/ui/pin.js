/*
 * js/ui/pin.js — Verrouillage par code PIN : écran de saisie (clavier tactile),
 * définition/confirmation du code, re-verrouillage sur inactivité et retour au
 * premier plan. Extrait de js/app.js (modules ES).
 *
 * Le hash du code (jamais le code en clair) est stocké dans settings.pinCode.
 * Dépendances : t() (i18n). settings et les actions UI (saveSettings,
 * afficherToast, fermerSettings) sont des globaux (pont de compatibilité).
 */
import { t, tf } from '../core/i18n.js';

// ══════════════════════════════════════════════════════════════════════
//  VERROUILLAGE PAR CODE PIN
// ══════════════════════════════════════════════════════════════════════
// Le hash du code (jamais le code en clair) est stocké dans settings.pinCode.
// Stratégie de hash simple (pas de crypto forte nécessaire : protection
// d'accès local sur l'appareil de l'enquêteur, pas un secret serveur).
export function _pinHash(code) {
  let h = 0;
  const s = 'statbel_pin_' + code;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h.toString(36);
}

// Temporisation anti-essais : après PIN_SEUIL_TEMPO échecs consécutifs, la
// saisie est gelée un court instant, croissant à chaque nouvel échec. Ce n'est
// PAS une protection cryptographique (les données sont locales, en clair au
// repos) mais un frein contre l'essai systématique par un tiers qui a l'appareil
// en main. Le compteur et l'échéance sont persistés (settings) → un rechargement
// ne remet pas les compteurs à zéro.
const PIN_SEUIL_TEMPO = 3;
const PIN_PALIERS_S = [30, 60, 120, 300]; // 3e→30 s, 4e→1 min, 5e→2 min, 6e+→5 min

// PURE : délai de gel (ms) pour `fails` échecs consécutifs (0 sous le seuil).
export function _pinDelaiTempo(fails) {
  if (fails < PIN_SEUIL_TEMPO) return 0;
  return PIN_PALIERS_S[Math.min(fails - PIN_SEUIL_TEMPO, PIN_PALIERS_S.length - 1)] * 1000;
}

let _pinSaisie = '';
let _pinLongueurCible = 4;
let _pinModeSetup = false;     // true pendant la définition d'un nouveau code
let _pinSetupEtape1 = '';      // 1er code saisi en mode setup (confirmation)
let _pinDernierActivite = Date.now();
let _pinVerrouille = false;
let _pinTempoTimer = null;     // intervalle du compte à rebours de temporisation

export function pinEstActif() { return !!(settings.pinCode && settings.pinCode.length); }

// Millisecondes restantes de gel de la saisie (0 = libre).
function pinTempoRestante() { return Math.max(0, (settings.pinLockUntil || 0) - Date.now()); }

// Format « m:ss » pour le compte à rebours affiché.
function _fmtMMSS(ms) {
  const s = Math.ceil(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// Met à jour l'affichage du gel (message + pavé désactivé). Renvoie true si un
// gel est en cours.
function pinMajTempoUI() {
  const reste = pinTempoRestante();
  const keypad = document.getElementById('lockKeypad');
  if (reste > 0) {
    const err = document.getElementById('lockErrorMsg');
    if (err) err.textContent = tf('pin_locked_out', { t: _fmtMMSS(reste) });
    if (keypad) keypad.classList.add('disabled');
    return true;
  }
  if (keypad) keypad.classList.remove('disabled');
  return false;
}

// Démarre le compte à rebours : tick chaque 0,5 s jusqu'à expiration, puis
// réactive la saisie et efface le message.
function pinDemarrerTempo() {
  if (_pinTempoTimer) clearInterval(_pinTempoTimer);
  pinMajTempoUI();
  _pinTempoTimer = setInterval(() => {
    if (!pinMajTempoUI()) {
      clearInterval(_pinTempoTimer);
      _pinTempoTimer = null;
      const err = document.getElementById('lockErrorMsg');
      if (err) err.textContent = ' ';
      renderLockDots();
    }
  }, 500);
}

export function renderLockDots() {
  const wrap = document.getElementById('lockDots');
  wrap.innerHTML = '';
  for (let i = 0; i < _pinLongueurCible; i++) {
    const d = document.createElement('div');
    d.className = 'lock-dot' + (i < _pinSaisie.length ? ' filled' : '');
    wrap.appendChild(d);
  }
}

export function renderLockKeypad() {
  const wrap = document.getElementById('lockKeypad');
  wrap.innerHTML = '';
  const touches = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  touches.forEach(k => {
    if (k === '') {
      const filler = document.createElement('div');
      filler.className = 'lock-key empty';
      filler.setAttribute('aria-hidden', 'true');
      wrap.appendChild(filler);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lock-key';
    btn.textContent = k;
    btn.setAttribute('aria-label', k === '⌫' ? t('pin_backspace') : k);
    btn.onclick = () => pinToucheAppuyee(k);
    wrap.appendChild(btn);
  });
}

export function pinToucheAppuyee(t) {
  if (pinTempoRestante() > 0) return; // temporisation en cours : saisie gelée
  if (t === '⌫') {
    _pinSaisie = _pinSaisie.slice(0, -1);
    renderLockDots();
    return;
  }
  if (_pinSaisie.length >= 6) return; // garde-fou
  _pinSaisie += t;
  renderLockDots();

  // Auto-validation à 4 chiffres si on n'attend pas explicitement plus
  if (_pinSaisie.length === _pinLongueurCible) {
    setTimeout(pinValiderSaisie, 120);
  }
}

export function pinAfficherErreur(msg) {
  const el = document.getElementById('lockErrorMsg');
  el.textContent = msg;
  document.getElementById('lockDots').classList.add('lock-shake');
  document.querySelectorAll('.lock-dot').forEach(d => d.classList.add('error'));
  setTimeout(() => {
    document.getElementById('lockDots').classList.remove('lock-shake');
    document.querySelectorAll('.lock-dot').forEach(d => d.classList.remove('error'));
  }, 400);
}

export function pinValiderSaisie() {
  if (_pinModeSetup) {
    // Mode définition d'un nouveau code : 1ère saisie puis confirmation
    if (!_pinSetupEtape1) {
      _pinSetupEtape1 = _pinSaisie;
      _pinSaisie = '';
      document.getElementById('lockTitle').textContent = t('pin_confirm');
      renderLockDots();
      return;
    }
    if (_pinSaisie !== _pinSetupEtape1) {
      pinAfficherErreur(t('pin_mismatch'));
      _pinSetupEtape1 = '';
      _pinSaisie = '';
      document.getElementById('lockTitle').textContent = t('pin_setup');
      renderLockDots();
      return;
    }
    // Codes identiques → on enregistre
    settings.pinCode = _pinHash(_pinSaisie);
    saveSettings();
    _pinModeSetup = false;
    _pinSetupEtape1 = '';
    _pinSaisie = '';
    fermerLockScreen();
    afficherToast(t('toast_pin_on'), 2500);
    majPinUI();
    return;
  }

  // Mode vérification normale
  if (_pinHash(_pinSaisie) === settings.pinCode) {
    _pinSaisie = '';
    _pinVerrouille = false;
    _pinDernierActivite = Date.now();
    settings.pinFails = 0;
    settings.pinLockUntil = 0;
    saveSettings();
    fermerLockScreen();
  } else {
    _pinSaisie = '';
    settings.pinFails = (settings.pinFails || 0) + 1;
    const delai = _pinDelaiTempo(settings.pinFails);
    if (delai) settings.pinLockUntil = Date.now() + delai;
    saveSettings();
    pinAfficherErreur(t('pin_wrong'));
    setTimeout(renderLockDots, 200);
    if (delai) pinDemarrerTempo(); // remplace le message par le compte à rebours
  }
}

export function ouvrirLockScreen(modeSetup) {
  _pinModeSetup = !!modeSetup;
  _pinSetupEtape1 = '';
  _pinSaisie = '';
  document.getElementById('lockTitle').textContent = modeSetup
    ? t('pin_setup')
    : t('pin_enter');
  document.getElementById('lockErrorMsg').textContent = '\u00a0';
  document.getElementById('lockSetupHint').classList.toggle('hidden', !modeSetup);
  renderLockKeypad();
  renderLockDots();
  document.getElementById('lockScreen').classList.add('open');
  // Reprise du gel si une temporisation est encore en cours (ex. rechargement
  // pendant le délai) — hors mode définition de code.
  if (!modeSetup && pinTempoRestante() > 0) pinDemarrerTempo();
}

export function fermerLockScreen() {
  if (_pinTempoTimer) { clearInterval(_pinTempoTimer); _pinTempoTimer = null; }
  document.getElementById('lockScreen').classList.remove('open');
}

// Appelée depuis les Paramètres : définit le code, ou ouvre la modale de
// gestion (changer / désactiver) si un code est déjà actif.
export function ouvrirGestionPin() {
  if (pinEstActif()) {
    document.getElementById('modalPin').classList.add('open');
    return;
  }
  fermerSettings();
  ouvrirLockScreen(true);
}

export function fermerModalPin() {
  document.getElementById('modalPin').classList.remove('open');
}

// Modale PIN → « Changer le code »
export function pinChanger() {
  fermerModalPin();
  fermerSettings();
  ouvrirLockScreen(true);
}

// Modale PIN → « Désactiver le verrouillage »
export function pinDesactiver() {
  settings.pinCode = '';
  saveSettings();
  fermerModalPin();
  afficherToast(t('toast_pin_off'), 2000);
  majPinUI();
}

export function majPinUI() {
  const btn = document.getElementById('btnPinToggle');
  const hint = document.getElementById('pinStatusHint');
  if (!btn) return;
  if (pinEstActif()) {
    btn.textContent = t('pin_active');
    hint.textContent = t('hint_pin_on');
  } else {
    btn.textContent = t('pin_define');
    hint.textContent = t('hint_pin_off');
  }
  const sel = document.getElementById('setPinTimeout');
  if (sel) sel.value = String(settings.pinTimeout ?? 5);
}

// Vérifie au chargement si l'app doit démarrer verrouillée
export function pinVerifierAuDemarrage() {
  if (!pinEstActif()) return;
  _pinVerrouille = true;
  ouvrirLockScreen(false);
}

// Re-verrouillage automatique après inactivité (si pinTimeout > 0)
export function pinSurveillerInactivite() {
  ['click','keydown','touchstart','scroll'].forEach(evt => {
    document.addEventListener(evt, () => { _pinDernierActivite = Date.now(); }, { passive: true });
  });
  // Saisie au clavier physique quand l'écran de verrouillage est ouvert
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lockScreen').classList.contains('open')) return;
    if (/^[0-9]$/.test(e.key))      { e.preventDefault(); pinToucheAppuyee(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); pinToucheAppuyee('⌫'); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (_pinSaisie.length === _pinLongueurCible) pinValiderSaisie(); }
  });
  setInterval(() => {
    if (!pinEstActif() || _pinVerrouille) return;
    const timeoutMin = settings.pinTimeout ?? 5;
    if (!timeoutMin) return; // 0 = jamais de re-verrouillage auto
    if (Date.now() - _pinDernierActivite > timeoutMin * 60 * 1000) {
      _pinVerrouille = true;
      ouvrirLockScreen(false);
    }
  }, 15000);
  // Re-verrouiller aussi quand l'app repasse au premier plan après avoir
  // été masquée plus longtemps que le délai choisi (changement d'appli mobile)
  let _masqueDepuis = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _masqueDepuis = Date.now();
    } else if (_masqueDepuis && pinEstActif() && !_pinVerrouille) {
      const timeoutMin = settings.pinTimeout ?? 5;
      const seuil = timeoutMin ? timeoutMin * 60 * 1000 : 0;
      if (seuil && Date.now() - _masqueDepuis > seuil) {
        _pinVerrouille = true;
        ouvrirLockScreen(false);
      }
      _masqueDepuis = null;
    }
  });
}
