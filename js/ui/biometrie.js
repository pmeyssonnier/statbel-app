/*
 * js/ui/biometrie.js — Déverrouillage biométrique (WebAuthn, authentificateur de
 * plateforme : Touch ID / Face ID / empreinte Android / Windows Hello).
 *
 * COMPLÉMENT du code PIN, jamais un remplacement : le PIN reste le repli
 * obligatoire (la biométrie peut être indisponible — autre appareil, données du
 * site vidées, navigateur sans capteur).
 *
 * Modèle : porte d'accès LOCALE, PAS un chiffrement des données au repos (comme le
 * PIN — voir pin.js). On enrôle une clé de plateforme (`create`) puis, au
 * déverrouillage, on exige une vérification utilisateur (`get`,
 * userVerification:'required'). Le SUCCÈS de l'assertion — la biométrie validée par
 * l'OS — suffit à ouvrir : aucune vérification serveur (l'app est hors-ligne, sans
 * backend). L'identifiant de clé (public, non sensible) est stocké dans
 * settings.bioCredId.
 *
 * Contexte sécurisé requis (https ou 127.0.0.1/localhost) ; indisponible en file://.
 * Toute la détection est défensive : si l'API ou l'authentificateur manque, la
 * fonctionnalité se masque et le PIN prend le relais.
 *
 * Dépendances globales (pont) : settings, saveSettings.
 */

// ArrayBuffer ⇄ base64 (l'identifiant de clé est un binaire).
function _bufVersB64(buf) {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function _b64VersBuf(b64) {
  const s = atob(b64); const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b.buffer;
}
function _alea(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

// L'API WebAuthn est-elle utilisable ET un authentificateur de plateforme présent ?
export async function bioPlateformeDispo() {
  try {
    if (!window.isSecureContext || !window.PublicKeyCredential) return false;
    if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) { return false; }
}

// Une clé biométrique est-elle enrôlée sur cet appareil ?
export function bioEnrolee() { return !!(settings && settings.bioCredId); }

// Enrôle : crée une clé de plateforme et mémorise son identifiant. Renvoie true si OK.
export async function bioEnroler() {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: _alea(32),                 // local : jamais vérifié côté serveur
        rp: { name: 'Statbel Interviews' },    // rp.id = domaine courant par défaut
        user: { id: _alea(16), name: 'enqueteur', displayName: 'Enquêteur' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000, attestation: 'none',
      },
    });
    if (!cred || !cred.rawId) return false;
    settings.bioCredId = _bufVersB64(cred.rawId);
    saveSettings();
    return true;
  } catch (e) { return false; }   // annulation, refus, indispo → échec silencieux
}

// Vérifie la biométrie. Renvoie true = utilisateur validé localement ; false = annulé/échec.
export async function bioVerifier() {
  try {
    if (!bioEnrolee()) return false;
    const ass = await navigator.credentials.get({
      publicKey: {
        challenge: _alea(32),
        allowCredentials: [{ type: 'public-key', id: _b64VersBuf(settings.bioCredId), transports: ['internal'] }],
        userVerification: 'required', timeout: 60000,
      },
    });
    return !!ass;
  } catch (e) { return false; }
}

// Oublie la clé enrôlée (désactivation, ou perte de sens si le PIN est retiré).
export function bioDesactiver() { if (settings) { settings.bioCredId = ''; saveSettings(); } }
