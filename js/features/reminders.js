/*
 * js/features/reminders.js — Rappels CATI/CAWI : message e-mail / SMS prérempli.
 *
 * construireRappel est une fonction PURE : aucun effet de bord, aucune lecture de
 * l'état applicatif (settings/enquetes). Toute la configuration arrive en
 * paramètres — en particulier le lien CAWI (cawiUrl) est passé explicitement, et
 * non lu depuis `settings`. Elle est donc testable par appel direct.
 *
 * Dépendances : classerMethode (data/collect-method) ; telBE (core/util) ; t/tf
 * (core/i18n). L'i18n lit la langue courante via son propre état — dette partagée
 * par tout le dépôt, hors périmètre de ce module.
 *
 * canal ∈ 'mail' | 'sms'. Le corps CAWI n'inclut que les lignes réellement
 * renseignées (lien, identifiant, mot de passe) ; le CATI est un simple rappel de
 * disponibilité, sans identifiants web. Renvoie { subject, body, href }.
 *
 * L'ouverture de l'appli mail/SMS (envoyerRappel) reste côté UI (ui/contacts.js) :
 * elle lit le contact courant + settings.cawiUrl et délègue la construction ici.
 */
import { classerMethode } from '../data/collect-method.js';
import { telBE } from '../core/util.js';
import { t, tf } from '../core/i18n.js';

export function construireRappel({ contact, canal, cawiUrl } = {}) {
  const c = contact || {};
  const m = classerMethode(c.collect_method);
  const lignes = [ tf('rappel_hello', { name: c.prenom || '' }) ];
  if (m === 'cawi') {
    lignes.push(t('rappel_intro_cawi'));
    const url = (cawiUrl || '').trim();
    if (url)            lignes.push(t('rappel_lbl_link')  + ' : ' + url);
    if (c.web_user_id)  lignes.push(t('rappel_lbl_login') + ' : ' + c.web_user_id);
    if (c.web_user_pwd) lignes.push(t('rappel_lbl_pwd')   + ' : ' + c.web_user_pwd);
  } else {
    lignes.push(t('rappel_intro_cati'));
    if (c.rdv) lignes.push(tf('rappel_rdv', { rdv: c.rdv }));
  }
  lignes.push(t('rappel_thanks'));
  const body    = lignes.filter(Boolean).join('\n');
  const subject = t(m === 'cawi' ? 'rappel_subject_cawi' : 'rappel_subject_cati');
  let href;
  if (canal === 'mail') {
    href = 'mailto:' + encodeURIComponent(c.email || '').replace(/%40/g, '@')
         + '?subject=' + encodeURIComponent(subject)
         + '&body='    + encodeURIComponent(body);
  } else {
    const tb  = c.gsm ? telBE(c.gsm) : null;
    const num = tb ? tb.e164 : (c.gsm || '');
    // « ?&body= » : forme compatible iOS et Android (le sujet n'existe pas en SMS).
    href = 'sms:' + num + '?&body=' + encodeURIComponent(body);
  }
  return { subject, body, href };
}
