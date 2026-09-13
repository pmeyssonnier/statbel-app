/*
 * js/features/reminders.js — Rappels CATI/CAWI : message e-mail / SMS prérempli.
 *
 * construireRappel reste pure : contact, configuration et modèles sont fournis
 * en paramètres. Les modèles personnalisés emploient des variables {{nom}}.
 * Sans modèle personnalisé, le message i18n historique reste utilisé.
 */
import { classerMethode } from '../data/collect-method.js';
import { telBE } from '../core/util.js';
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

const TEMPLATE_KEYS = Object.keys(RAPPEL_TEMPLATES_FR);

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

export function normaliserTemplates(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of TEMPLATE_KEYS) {
    if (typeof raw[key] === 'string') out[key] = raw[key].slice(0, 4000);
  }
  return out;
}

export function construireRappel({
  contact, canal, cawiUrl, surveyName, templates, signature, shortSignature,
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
    rendez_vous: c.rdv ? 'Rendez-vous prévu : ' + c.rdv : '',
    lien: (cawiUrl || '').trim(),
    identifiant: c.web_user_id || '',
    mot_de_passe: c.web_user_pwd || '',
    signature: signature || '',
    signature_courte: shortSignature || signature || '',
  };

  let body;
  if (perso[templateKey] && perso[templateKey].trim()) {
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
      if (c.rdv) lignes.push(tf('rappel_rdv', { rdv: c.rdv }));
    }
    lignes.push(t('rappel_thanks'));
    body = lignes.filter(Boolean).join('\n');
  }

  const subject = canal === 'mail' && perso.mailSubject && perso.mailSubject.trim()
    ? appliquerTemplate(perso.mailSubject, variables)
    : t(m === 'cawi' ? 'rappel_subject_cawi' : 'rappel_subject_cati');

  let href;
  if (canal === 'mail') {
    href = 'mailto:' + encodeURIComponent(c.email || '').replace(/%40/g, '@')
         + '?subject=' + encodeURIComponent(subject)
         + '&body=' + encodeURIComponent(body);
  } else {
    const tb = c.gsm ? telBE(c.gsm) : null;
    const num = tb ? tb.e164 : (c.gsm || '');
    href = 'sms:' + num + '?&body=' + encodeURIComponent(body);
  }
  return { subject, body, href };
}
