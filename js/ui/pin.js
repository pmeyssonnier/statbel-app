/*
 * js/ui/pin.js — Verrouillage par code PIN : écran de saisie (clavier tactile),
 * définition/confirmation du code, re-verrouillage sur inactivité et retour au
 * premier plan. Extrait de js/app.js (modules ES).
 *
 * Le hash du code (jamais le code en clair) est stocké dans settings.pinCode.
 * Dépendances : t() (i18n). settings et les actions UI (saveSettings,
 * afficherToast, fermerSettings) sont des globaux (pont de compatibilité).
 */
import { t } from '../core/i18n.js';

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

let _pinSaisie = '';
let _pinLongueurCible = 4;
let _pinModeSetup = false;     // true pendant la définition d'un nouveau code
let _pinSetupEtape1 = '';      // 1er code saisi en mode setup (confirmation)
let _pinDernierActivite = Date.now();
let _pinVerrouille = false;

export function pinEstActif() { return !!(settings.pinCode && settings.pinCode.length); }

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
    fermerLockScreen();
  } else {
    pinAfficherErreur(t('pin_wrong'));
    _pinSaisie = '';
    setTimeout(renderLockDots, 200);
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
}

export function fermerLockScreen() {
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
