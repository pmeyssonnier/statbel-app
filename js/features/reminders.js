/*
 * js/features/reminders.js — Rappels CATI/CAWI : message e-mail / SMS prérempli.
 *
 * construireRappel reste pure : contact, configuration et modèles sont fournis
 * en paramètres. Les modèles personnalisés emploient des variables {{nom}}.
 * Sans modèle personnalisé, le message i18n historique reste utilisé.
 */
import { classerMethode } from '../data/collect-method.js';
import { telBE, emailAffiche, dateISOToFr } from '../core/util.js';

// c.rdv est stocké au format INTERNE « YYYY-MM-DD HH:MM ». Le message envoyé au
// répondant doit afficher une date lisible « JJ/MM/AAAA HH:MM », pas l'ISO brut
// (bug E7). Neutre linguistiquement : le libellé autour (rappel_rdv) est traduit.
function rdvLisible(rdv) {
  const [d, h] = String(rdv || '').trim().split(' ');
  const fr = dateISOToFr(d || '');
  if (!fr) return '';
  return h ? `${fr} ${h}` : fr;
}
import { t, tf } from '../core/i18n.js';

export const RAPPEL_TEMPLATES_FR = Object.freeze({
  mailSubject: 'Rappel – Enquête {{enquete}} de Statbel',
  mailCati: `Bonjour {{prenom}},

Je me permets de vous rappeler que votre ménage a été sélectionné pour participer à l’enquête {{enquete}} organisée par Statbel.

{{rendez_vous}}
Si ce moment ne vous convient pas, vous pouvez me répondre directement.

Merci d’avance pour votre participation.

Bien cordialement,
{{signature}}`,
  mailCawi: `Bonjour {{prenom}},

Votre ménage a été sélectionné pour participer à l’enquête {{enquete}} organisée par Statbel.

Lien : {{lien}}
Identifiant : {{identifiant}}
Mot de passe : {{mot_de_passe}}

Merci d’avance pour votre participation.

Bien cordialement,
{{signature}}`,
  smsCati: 'Bonjour {{prenom}}, rappel Statbel pour l’enquête {{enquete}}. {{rendez_vous}} Merci, {{signature_courte}}',
  smsCawi: 'Bonjour {{prenom}}, enquête {{enquete}} de Statbel : {{lien}} – ID : {{identifiant}} – MDP : {{mot_de_passe}}. Merci, {{signature_courte}}',
});

export const RAPPEL_TEMPLATES_NL = Object.freeze({
  mailSubject: 'Herinnering – Enquête {{enquete}} van Statbel',
  mailCati: `Beste {{prenom}},

Ik wil u eraan herinneren dat uw huishouden werd geselecteerd om deel te nemen aan de enquête {{enquete}} van Statbel.

{{rendez_vous}}
Als dit moment u niet past, kunt u mij rechtstreeks antwoorden.

Alvast bedankt voor uw deelname.

Met vriendelijke groeten,
{{signature}}`,
  mailCawi: `Beste {{prenom}},

Uw huishouden werd geselecteerd om deel te nemen aan de enquête {{enquete}} van Statbel.

Link: {{lien}}
Gebruikersnaam: {{identifiant}}
Wachtwoord: {{mot_de_passe}}

Alvast bedankt voor uw deelname.

Met vriendelijke groeten,
{{signature}}`,
  smsCati: 'Beste {{prenom}}, herinnering Statbel voor de enquête {{enquete}}. {{rendez_vous}} Bedankt, {{signature_courte}}',
  smsCawi: 'Beste {{prenom}}, enquête {{enquete}} van Statbel: {{lien}} – ID: {{identifiant}} – WW: {{mot_de_passe}}. Bedankt, {{signature_courte}}',
});

export const RAPPEL_TEMPLATES_EN = Object.freeze({
  mailSubject: 'Reminder – {{enquete}} survey by Statbel',
  mailCati: `Hello {{prenom}},

I would like to remind you that your household has been selected to take part in the {{enquete}} survey organised by Statbel.

{{rendez_vous}}
If this time does not suit you, you can reply to me directly.

Thank you in advance for your participation.

Kind regards,
{{signature}}`,
  mailCawi: `Hello {{prenom}},

Your household has been selected to take part in the {{enquete}} survey organised by Statbel.

Link: {{lien}}
Username: {{identifiant}}
Password: {{mot_de_passe}}

Thank you in advance for your participation.

Kind regards,
{{signature}}`,
  smsCati: 'Hello {{prenom}}, Statbel reminder for the {{enquete}} survey. {{rendez_vous}} Thank you, {{signature_courte}}',
  smsCawi: 'Hello {{prenom}}, {{enquete}} survey by Statbel: {{lien}} – ID: {{identifiant}} – PW: {{mot_de_passe}}. Thank you, {{signature_courte}}',
});

export const RAPPEL_TEMPLATES_DE = Object.freeze({
  mailSubject: 'Erinnerung – Erhebung {{enquete}} von Statbel',
  mailCati: `Guten Tag {{prenom}},

ich möchte Sie daran erinnern, dass Ihr Haushalt für die Teilnahme an der von Statbel durchgeführten Erhebung {{enquete}} ausgewählt wurde.

{{rendez_vous}}
Falls Ihnen dieser Zeitpunkt nicht passt, können Sie mir direkt antworten.

Vielen Dank im Voraus für Ihre Teilnahme.

Mit freundlichen Grüßen,
{{signature}}`,
  mailCawi: `Guten Tag {{prenom}},

Ihr Haushalt wurde für die Teilnahme an der von Statbel durchgeführten Erhebung {{enquete}} ausgewählt.

Link: {{lien}}
Benutzername: {{identifiant}}
Passwort: {{mot_de_passe}}

Vielen Dank im Voraus für Ihre Teilnahme.

Mit freundlichen Grüßen,
{{signature}}`,
  smsCati: 'Guten Tag {{prenom}}, Statbel-Erinnerung zur Erhebung {{enquete}}. {{rendez_vous}} Danke, {{signature_courte}}',
  smsCawi: 'Guten Tag {{prenom}}, Erhebung {{enquete}} von Statbel: {{lien}} – ID: {{identifiant}} – PW: {{mot_de_passe}}. Danke, {{signature_courte}}',
});

// Modèles proposés par langue (fr/nl/en/de). Les jetons {{var}} sont identiques
// dans toutes les langues ; seule la prose est traduite.
const RAPPEL_TEMPLATES = Object.freeze({
  fr: RAPPEL_TEMPLATES_FR,
  nl: RAPPEL_TEMPLATES_NL,
  en: RAPPEL_TEMPLATES_EN,
  de: RAPPEL_TEMPLATES_DE,
});

// Signatures par défaut : le nom reste identique, seul le rôle est localisé.
const SIGNATURE_DEFAUT = Object.freeze({
  fr: 'Pierre Meyssonnier – Enquêteur Statbel',
  nl: 'Pierre Meyssonnier – Statbel-enquêteur',
  en: 'Pierre Meyssonnier – Statbel interviewer',
  de: 'Pierre Meyssonnier – Statbel-Befrager',
});
const SIGNATURE_COURTE_DEFAUT = 'Pierre – Statbel';

// Renvoie les modèles + signatures proposés pour la langue active (repli FR).
export function modelesRappelDefaut(lang) {
  const l = RAPPEL_TEMPLATES[lang] ? lang : 'fr';
  return {
    templates: { ...RAPPEL_TEMPLATES[l] },
    signature: SIGNATURE_DEFAUT[l],
    signatureShort: SIGNATURE_COURTE_DEFAUT,
  };
}

const TEMPLATE_KEYS = Object.keys(RAPPEL_TEMPLATES_FR);

// Variables {{…}} reconnues par le moteur de rappel (toute autre est inconnue).
export const RAPPEL_VARIABLES = Object.freeze([
  'prenom', 'enquete', 'rendez_vous', 'lien', 'identifiant', 'mot_de_passe',
  'signature', 'signature_courte',
]);

// Remplace uniquement les variables connues. Une variable absente devient vide,
// puis les espaces/lignes laissés par les valeurs optionnelles sont nettoyés.
export function appliquerTemplate(template, variables = {}) {
  return String(template || '')
    .replace(/\{\{([a-z_]+)\}\}/gi, (_, nom) =>
      Object.prototype.hasOwnProperty.call(variables, nom) ? String(variables[nom] ?? '') : '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Liste triée et dédupliquée des variables {{…}} INCONNUES trouvées dans un jeu de
// modèles (ou une seule chaîne). Sert à avertir l'enquêteur au lieu de remplacer
// silencieusement par du vide. Accepte un objet {clé:modèle} ou une chaîne.
export function variablesInconnues(templates) {
  const chaines = typeof templates === 'string'
    ? [templates]
    : Object.values(templates && typeof templates === 'object' ? templates : {});
  const found = new Set();
  for (const s of chaines) {
    if (typeof s !== 'string') continue;
    const re = /\{\{([a-z_]+)\}\}/gi;
    let m;
    while ((m = re.exec(s))) { if (!RAPPEL_VARIABLES.includes(m[1])) found.add(m[1]); }
  }
  return [...found].sort();
}

// Estimation indicative du découpage SMS : au-delà de Latin-1 (émojis, tirets longs,
// apostrophes courbes…) l'opérateur bascule en UCS-2, dont les segments sont plus
// courts (70 puis 67) qu'en GSM-7 (160 puis 153).
export function smsInfo(text) {
  const s = String(text || '');
  const cps = [...s];
  const len = cps.length;                    // points de code (les émojis comptent)
  // Au-delà de Latin-1 (> U+00FF) l’opérateur bascule en UCS-2 (segments plus courts).
  const unicode = cps.some(ch => ch.codePointAt(0) > 0xff);
  const par = unicode ? (len <= 70 ? 70 : 67) : (len <= 160 ? 160 : 153);
  const segments = len === 0 ? 0 : Math.ceil(len / par);
  return { len, segments, unicode };
}

export function normaliserTemplates(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of TEMPLATE_KEYS) {
    if (typeof raw[key] === 'string') out[key] = raw[key].slice(0, 4000);
  }
  return out;
}

export function construireRappel({
  contact, canal, cawiUrl, surveyName, templates, signature, shortSignature, includePwd = true,
} = {}) {
  const c = contact || {};
  const m = classerMethode(c.collect_method);
  const perso = normaliserTemplates(templates);
  const templateKey = canal === 'mail'
    ? (m === 'cawi' ? 'mailCawi' : 'mailCati')
    : (m === 'cawi' ? 'smsCawi' : 'smsCati');

  const variables = {
    prenom: c.prenom || '',
    enquete: surveyName || '',
    rendez_vous: rdvLisible(c.rdv) ? tf('rappel_rdv', { rdv: rdvLisible(c.rdv) }) : '',
    lien: (cawiUrl || '').trim(),
    identifiant: c.web_user_id || '',
    // Option de confidentialité : ne pas inclure le mot de passe CAWI dans le message.
    mot_de_passe: includePwd ? (c.web_user_pwd || '') : '',
    signature: signature || '',
    signature_courte: shortSignature || signature || '',
  };

  const custom = perso[templateKey] && perso[templateKey].trim();
  // Avertissements pour l'appelant (aperçu / envoi) : variables inconnues du modèle
  // personnalisé utilisé, et données CAWI référencées mais absentes de la fiche.
  const warnings = { unknownVars: custom ? variablesInconnues(perso[templateKey]) : [], missingData: [] };
  if (m === 'cawi') {
    const refId  = custom ? /\{\{identifiant\}\}/.test(perso[templateKey])  : true;
    const refPwd = custom ? /\{\{mot_de_passe\}\}/.test(perso[templateKey]) : true;
    if (refId  && !c.web_user_id)               warnings.missingData.push('identifiant');
    if (refPwd && includePwd && !c.web_user_pwd) warnings.missingData.push('mot_de_passe');
  }

  let body;
  if (custom) {
    body = appliquerTemplate(perso[templateKey], variables);
  } else {
    const lignes = [tf('rappel_hello', { name: c.prenom || '' })];
    if (m === 'cawi') {
      lignes.push(t('rappel_intro_cawi'));
      if (variables.lien)        lignes.push(t('rappel_lbl_link')  + ' : ' + variables.lien);
      if (variables.identifiant) lignes.push(t('rappel_lbl_login') + ' : ' + variables.identifiant);
      if (variables.mot_de_passe) lignes.push(t('rappel_lbl_pwd')  + ' : ' + variables.mot_de_passe);
    } else {
      lignes.push(t('rappel_intro_cati'));
      { const r = rdvLisible(c.rdv); if (r) lignes.push(tf('rappel_rdv', { rdv: r })); }
    }
    lignes.push(t('rappel_thanks'));
    body = lignes.filter(Boolean).join('\n');
  }

  const subject = canal === 'mail' && perso.mailSubject && perso.mailSubject.trim()
    ? appliquerTemplate(perso.mailSubject, variables)
    : t(m === 'cawi' ? 'rappel_subject_cawi' : 'rappel_subject_cati');

  let href;
  if (canal === 'mail') {
    href = 'mailto:' + encodeURIComponent(emailAffiche(c.email)).replace(/%40/g, '@')
         + '?subject=' + encodeURIComponent(subject)
         + '&body=' + encodeURIComponent(body);
  } else {
    const tb = c.gsm ? telBE(c.gsm) : null;
    const num = tb ? tb.e164 : (c.gsm || '');
    href = 'sms:' + num + '?&body=' + encodeURIComponent(body);
  }
  return { subject, body, href, warnings };
}
