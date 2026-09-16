/*
 * js/ui/contacts.js — Vue liste et fiche contact : rendu de la liste filtrée,
 * cartes (statut, RDV, historique, démographie, distance), édition en place
 * (statut, notes, e-mail avec autocomplétion, GSM, RDV, âge), export vCard,
 * barre de filtres et navigation vers une fiche. Extrait de js/app.js.
 *
 * Imports : util (esc, formaterGsm, formatHeureSaisie, calcAge, dates, adresses,
 * correspondRecherche) ; i18n (t, tPlural, nomJourCourt) ; canon (statutLabel,
 * paysAffiche, etatCivilGenre, maritalCanon) ; idb (coordsCache) ; history
 * (ajouterHistorique). L'état et l'orchestration (contacts, enquetes,
 * enqueteActive, settings, statutDef(s), sauver(Bientot), mapsUrl,
 * formatDateJour, formatDateFrSaisie, afficherMarqueurs, vueActive,
 * markersLayer, maPosition, filtreActif, refreshSelect) sont globaux (pont).
 */
import { esc, formaterGsm, telBE, emailAffiche, calcAge, todayStr, nowHHMM,
         dateFrToISO, dateISOToFr, composeAdresse, parseAdresse,
         correspondRecherche } from '../core/util.js';
import { t, tf, tPlural, nomJourCourt } from '../core/i18n.js';
import { statutLabel, paysAffiche, etatCivilGenre, maritalCanon,
         MARITAL_I18N, PAYS_I18N } from '../data/canon.js';
import { coordsCache } from '../data/idb.js';
import { classerMethode } from '../data/collect-method.js';
import { construireRappel } from '../features/reminders.js';
// Note : formatHeureSaisie / ajouterHistorique sont appelés depuis des handlers
// inline (oninput/onclick) → résolus via le pont window, pas besoin de les importer ici.

// Domaines e-mail fréquents (autocomplétion de la saisie e-mail dans la fiche).
const EMAIL_DOMAINES = ['gmail.com','skynet.be','yahoo.com','hotmail.com','outlook.com','live.be','telenet.be','proximus.be','icloud.com'];



export function contactsFiltres() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  return contacts().filter(c => {
    if (filtreActif !== 'Tous' && (c.statut || statutDefaut()) !== filtreActif) return false;
    if (!correspondRecherche(c, q)) return false;
    return true;
  });
}

export function changerStatut(i, val) {
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

export function changerNotes(i, val)  { contacts()[i].notes = val;  sauverBientot(); }

// Édition manuelle de la composition du ménage : taille totale (`taille_menage`)
// et nombre de membres ≥15 ans (`nb_cibles`, cibles interrogeables). Entier ≥0,
// ou null si le champ est vidé. On ne borne pas ≥15 à la taille : l'enquêteur
// peut corriger l'un avant l'autre, et la valeur importée peut être erronée.
export function changerMenage(i, champ, val) {
  const v = String(val == null ? '' : val).trim();
  const n = v === '' ? null : parseInt(v, 10);
  contacts()[i][champ] = (n == null || isNaN(n) || n < 0) ? null : n;
  sauverBientot();
}

export function changerEmail(i, val)  { contacts()[i].email = emailAffiche(val);  sauverBientot(); }

export function changerGsm(i, input) {
  const f = formaterGsm(input.value);
  input.value = f;
  contacts()[i].gsm = f;
  sauver();
}

/** Lit les champs RDV (date jj/mm/aaaa + heure hh:mm) et renvoie la valeur
 *  stockée en interne « YYYY-MM-DD HH:MM » (ISO, pour tri/affichage). */
export function lireRdvFields(i) {
  const dFr = ((document.getElementById('edit-rdv-date-' +i)||{}).value||'').trim();
  let h     = ((document.getElementById('edit-rdv-heure-'+i)||{}).value||'').trim();
  const iso = dateFrToISO(dFr);                 // '' si incomplet/invalide
  if (h && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h)) h = '';  // heure 24h valide
  return iso ? (h ? iso + ' ' + h : iso) : '';
}

export function changerRdvDH(i) {
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
export function ouvrirCalendrierRdv(i) {
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

export function majAge(i) {
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

export function formatRdv(rdv) {
  if (!rdv) return '';
  const parts = (rdv+' ').split(' ');
  const [y,m,d] = (parts[0]||'').split('-');
  if (!y||!m||!d) return rdv;
  const h = (parts[1]||'').trim();
  const dateObj = new Date(+y,+m-1,+d);
  return nomJourCourt(dateObj)+' '+d.padStart(2,'0')+'/'+m.padStart(2,'0')+'/'+y+(h?' '+h:'');
}

// Construit « 45 ans · Mariée · Belgique » à partir des données disponibles
export function ligneDemographie(c) {
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
  if (c.taille_menage) {
    let m = '👥 ' + esc(c.taille_menage) + ' ' + tPlural('persons', c.taille_menage);
    const nc = parseInt(c.nb_cibles, 10);   // membres ≥15 (cibles interrogeables) — affiché si > 1
    if (!isNaN(nc) && nc > 1) m += ` (${nc} ≥15)`;
    parts.push(m);
  }
  return parts.join(' · ');
}

// Pastille « méthode de collecte » (CATI/CAWI, issue du Convertisseur), affichée
// sur la ligne des canaux de contact (à côté du téléphone/e-mail).
export function methodeBadge(c) {
  if (!c || !c.collect_method) return '';
  const m = classerMethode(c.collect_method);
  if (m === 'cati') return '<span class="badge badge-cati">📞 CATI</span>';
  if (m === 'cawi') return '<span class="badge badge-cawi">🌐 CAWI</span>';
  return `<span class="badge">📋 ${esc(c.collect_method)}</span>`;
}

// Ouvre l'appli mail/SMS de l'appareil avec le rappel prérempli (aucune donnée
// n'est transmise sans action de l'utilisateur). La construction du message est
// déléguée au module pur features/reminders.js ; ici on fournit le contact
// courant et le lien CAWI configuré (settings.cawiUrl).
export function envoyerRappel(i, canal) {
  const c = contacts()[i];
  if (!c) return;
  const { href, warnings } = construireRappel({
    contact: c,
    canal,
    cawiUrl: settings.cawiUrl,
    surveyName: enqueteActive,
    templates: settings.reminderTemplates,
    signature: settings.reminderSignature,
    shortSignature: settings.reminderSignatureShort,
    includePwd: settings.reminderIncludePwd !== false,
  });
  // Rappel CAWI référençant un identifiant/mot de passe absent de la fiche :
  // demander confirmation avant d'envoyer un message incomplet.
  if (warnings && warnings.missingData && warnings.missingData.length) {
    const libelles = { identifiant: t('rappel_lbl_login'), mot_de_passe: t('rappel_lbl_pwd') };
    const vars = warnings.missingData.map(k => libelles[k] || k).join(', ');
    if (!confirm(tf('rappel_cf_missing', { vars }))) return;
  }
  window.location.href = href;
  if (typeof afficherToast === 'function') afficherToast(t('toast_rappel'));
}

export function toggleEdit(i) {
  const el = document.getElementById('edit-'+i);
  // Édition paresseuse : le formulaire n'est construit qu'au premier clic,
  // pas pour les centaines de fiches à chaque rendu.
  if (!el.dataset.built) {
    el.innerHTML = buildEditForm(i);
    el.dataset.built = '1';
  }
  el.classList.toggle('open');
  const ouvert = el.classList.contains('open');
  el.closest('.card')?.classList.toggle('editing', ouvert);   // masque la barre de statut verrouillée
  if (ouvert) el.querySelector('.statut-bar .s-btn')?.focus();
}

// Ouvre (et construit si besoin) le formulaire d'édition d'une fiche
export function ouvrirEdit(i) {
  const el = document.getElementById('edit-'+i);
  if (!el) return null;
  if (!el.dataset.built) { el.innerHTML = buildEditForm(i); el.dataset.built = '1'; }
  el.classList.add('open');
  el.closest('.card')?.classList.add('editing');
  return el;
}

// Un bouton de statut (source unique de la puce et de la barre). `s` = définition
// {label,color,icon} ; `on` = statut courant (mis en avant). En mode éditable, le
// clic applique le statut (aria-pressed exposé) ; en mode verrouillé (data-editable
// « 0 » + s-btn-lock), il ouvre le formulaire d'édition — évite un changement au
// toucher accidentel. Délégation via data-act="statutBtn" (cf. js/app.js).
function statutBtnHTML(i, s, on, editable) {
  const style = `color:${s.color};${on ? `border-color:${s.color};background:${s.color}22;` : ''}`;
  const cls = `s-btn${on ? ' actif' : ''}${editable ? '' : ' s-btn-lock'}`;
  const ttl = editable ? '' : ` title="${esc(t('lock_status_edit'))}"`;
  const press = editable ? ` aria-pressed="${on}"` : '';   // l'emoji reste décoratif (aria-hidden)
  return `<button class="${cls}" style="${style}"${ttl}${press} data-act="statutBtn" data-i="${i}" data-editable="${editable ? 1 : 0}" data-label="${esc(s.label)}"><span aria-hidden="true">${esc(s.icon)}</span> ${esc(statutLabel(s.label))}</button>`;
}

// Barre éditable de tous les statuts (formulaire) : un clic applique le statut.
export function statutBarHTML(i, statut) {
  return statutDefs().map(s => statutBtnHTML(i, s, s.label === statut, true)).join('');
}

// Puce du statut COURANT seul (fiche compacte, gain de place mobile) : verrouillée,
// un clic ouvre le formulaire d'édition. Le choix parmi tous les statuts se fait
// dans le formulaire (barre éditable). `def` peut être passé pour éviter un
// second statutDef() quand l'appelant l'a déjà calculé.
export function statutChipHTML(i, statut, def = statutDef(statut)) {
  return statutBtnHTML(i, def, true, false);
}

// Génère le contenu du formulaire d'édition d'une fiche (à la demande)
export function buildEditForm(i) {
  const c      = contacts()[i];
  const statut = c.statut || statutDefaut();
  const def    = statutDef(statut);
  // En CATI/CAWI, le téléphone et l'e-mail proviennent de la donnée source
  // (Statbel) et servent à joindre le ménage : on les affiche en lecture seule
  // pour ne pas altérer la source. Le double-clic (tel:/mailto:) reste actif.
  // En CAPI (face-à-face), l'enquêteur les saisit sur le terrain → éditables.
  const distant = classerMethode(c.collect_method);
  const srcHint = distant ? ` <span class="src-hint" aria-hidden="true" title="${esc(t('src_readonly'))}">🔒</span>` : '';
  const gsmRO   = distant ? ` readonly class="input-source" aria-label="${esc(t('ed_gsm') + ' — ' + t('src_readonly'))}"` : '';
  const mailRO  = distant ? ` readonly class="input-source" aria-label="${esc(t('ed_email') + ' — ' + t('src_readonly'))}"` : '';
  // Édition volontairement limitée : statut, téléphone, e-mail, note et historique.
  // Les données démographiques (nom, adresse, ménage, âge…) sont affichées en tête
  // de fiche et ne sont pas ré-éditables ici → pas de doublon, pas de saisie à risque.
  return `
        ${buildHistoriqueHTML(c, i)}
        <div class="edit-row">
          <label>${t('ed_status')}</label>
          <div class="statut-bar">${statutBarHTML(i, statut)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start">
          <div class="edit-row" style="flex:0.45">
            <label>${t('ed_gsm')}${srcHint}</label>
            <input type="tel" placeholder="+32 4xx xx xx xx" value="${esc(c.gsm||'')}"
              data-act="editGsm" data-i="${i}"${gsmRO} style="max-width:150px">
          </div>
          <div class="edit-row" style="flex:1">
            <label>${t('ed_email')}${srcHint}</label>
            <div class="email-wrap">
              <input type="email" placeholder="${t('ph_email')}" value="${esc(emailAffiche(c.email))}"
                data-act="editEmail" data-i="${i}"${mailRO}
                autocomplete="off">
              <div class="email-suggestions" id="esug-${i}"></div>
            </div>
          </div>
        </div>
        <div class="edit-row">
          <label>${t('ed_notes')}</label>
          <textarea placeholder="${t('ph_notes')}" data-act="editNotes" data-i="${i}"
            style="padding:8px;border:1px solid #ccc;border-radius:8px;font-size:14px;font-family:Arial,sans-serif;resize:vertical;min-height:60px">${esc(c.notes||'')}</textarea>
        </div>
        ${def.rdv ? `
        <div class="edit-row edit-rdv-box">
          <label>${t('ed_rdv')}</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" inputmode="numeric" id="edit-rdv-date-${i}" value="${dateISOToFr((c.rdv||'').split(' ')[0]||'')}"
              placeholder="${esc(t('ph_date'))}" maxlength="10" data-act="editRdvDate" data-i="${i}"
              style="flex:1;">
            <button type="button" class="historique-cal" title="${esc(t('hist_open_cal'))}" aria-label="${esc(t('hist_open_cal'))}" data-act="ouvrirCalendrierRdv" data-i="${i}" style="font-size:16px;">📅</button>
            <input type="text" inputmode="numeric" id="edit-rdv-heure-${i}" value="${(c.rdv||'').split(' ')[1]||''}"
              placeholder="hh:mm" maxlength="5" data-act="editRdvHeure" data-i="${i}"
              style="width:70px;text-align:center;">
          </div>
        </div>` : ''}
        ${classerMethode(c.collect_method) ? `
        <div class="edit-row" style="flex-direction:row;gap:8px;flex-wrap:wrap;align-items:center">
          <label style="flex-basis:100%">${t('rappel_titre')}</label>
          ${c.email ? `<button type="button" class="btn-rappel" data-act="envoyerRappel" data-i="${i}" data-canal="mail" title="${esc(t('btn_rappel_mail'))}">✉️ ${esc(t('btn_rappel_mail'))}</button>` : ''}
          ${c.gsm   ? `<button type="button" class="btn-rappel" data-act="envoyerRappel" data-i="${i}" data-canal="sms" title="${esc(t('btn_rappel_sms'))}">💬 ${esc(t('btn_rappel_sms'))}</button>` : ''}
        </div>` : ''}
        <div class="edit-btns">
          <button class="btn-cancel-edit" data-act="toggleEdit" data-i="${i}">${t('btn_close')}</button>
          <button class="btn-vcard" data-act="exporterVCard" data-i="${i}" title="${esc(t('vcard_export'))}" aria-label="${esc(t('vcard_export'))}">📇 vCard</button>
          <button class="btn-save-edit" data-act="sauverEdit" data-i="${i}">${t('ed_save')}</button>
        </div>
  `;
}

export function sauverEdit(i) {
  // Édition limitée : statut / gsm / e-mail / notes sont déjà persistés à la volée
  // (oninput → sauverBientot). Ici on fige le RDV puis on referme et on rafraîchit.
  const c = contacts()[i];
  c.rdv = lireRdvFields(i);
  sauver();
  rendu();
  if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
}

export function filtrer(f) {
  filtreActif = f;
  renderFilters();
  if (vueActive === 'carte' && markersLayer) afficherMarqueurs();
  else rendu();
}

export function exporterVCard(i) {
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
  if (c.email) vcard += 'EMAIL:'+emailAffiche(c.email)+CRLF;
  if (c.notes) vcard += 'NOTE:'+c.notes.split('\n').join(' ')+CRLF;
  vcard += 'ORG:Statbel LFS'+CRLF+'END:VCARD';
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([vcard], {type:'text/vcard;charset=utf-8'})),
    download: prenom+'_'+nom+'.vcf'
  });
  a.click();
}

export function renderFilters() {
  const all = contacts(), total = all.length, cpt = {};
  all.forEach(c => { const s = c.statut||statutDefaut(); cpt[s]=(cpt[s]||0)+1; });
  let html = `<button class="filter-btn${filtreActif==='Tous'?' active':''}" data-act="filtrer" data-label="Tous">${t('f_all')}${total>0?' ('+total+')':''}</button>`;
  statutDefs().forEach((s) => {
    const n = cpt[s.label] || 0;
    const on = filtreActif === s.label;
    html += `<button class="filter-btn" style="border-color:${s.color};color:${on?'#fff':s.color};background:${on?s.color:'var(--filter-bg)'}" data-act="filtrer" data-label="${esc(s.label)}">${s.icon} ${esc(statutLabel(s.label))}${n>0?' ('+n+')':''}</button>`;
  });
  document.querySelector('.filters').innerHTML = html;
  document.getElementById('filters') && (document.getElementById('filters').innerHTML = html);
}

export function rendu() {
  renderFilters();
  majBackupBanner();
  const liste = document.getElementById('liste');
  liste.innerHTML = '';
  const all = contacts();
  if (all.length === 0) {
    liste.innerHTML = `<div class="empty-state">${t('empty_state')}<button data-act="declencherImport">${t('menu_import')}</button></div>`;
    return;
  }
  const q = (document.getElementById('searchInput')?.value||'').toLowerCase().trim();
  all.forEach((c, i) => {
    const statut = c.statut || statutDefaut();
    if (filtreActif !== 'Tous' && statut !== filtreActif) return;
    if (!correspondRecherche(c, q)) return;
    const def = statutDef(statut);
    const badges = [];
    const mb = methodeBadge(c);
    if (mb)      badges.push(mb);                 // méthode CATI/CAWI en tête des canaux de contact
    if (c.gsm)   { const tb = telBE(c.gsm); badges.push(`<a class="badge badge-tel" href="tel:${esc(tb?tb.e164:c.gsm)}">📞 ${esc(tb?tb.disp:c.gsm)}</a>`); }
    if (c.email) { const em = emailAffiche(c.email); badges.push(`<a class="badge badge-mail" href="mailto:${esc(em)}">✉️ ${esc(em)}</a>`); }
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
        <button class="btn-edit" data-act="toggleEdit" data-i="${i}" title="${esc(t('aria_edit'))}" aria-label="${esc(t('aria_edit'))}">🖊️</button>
      </div>
      ${(() => { const d = ligneDemographie(c); return d ? `<div class="card-demo">👤 ${d}</div>` : ''; })()}
      <div class="card-adresse-row">
        <a class="card-adresse" href="${mapsUrl(c.adresse)}" target="_blank" rel="noopener">📍 ${esc(c.adresse)}</a>
        ${distanceBadge(c.adresse)}
      </div>
      ${badges.length ? '<div class="card-badges">'+badges.join('')+'</div>' : ''}
      <div class="card-statut">
        <div class="statut-bar statut-bar-lock">${statutChipHTML(i, statut, def)}</div>
        ${dateStatut ? `<span class="card-statut-date">${esc(dateStatut)}</span>` : ''}
      </div>
      ${!coordsCache(c.adresse) ? `<div class="no-coords">${t('no_coords')}</div>` : ''}
      <div class="edit-area" id="edit-${i}"></div>
    `;
    liste.appendChild(card);
  });
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R=6371000, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export function formatDist(m) { return m<1000 ? Math.round(m)+' m' : (m/1000).toFixed(1)+' km'; }

export function distanceBadge(adresse) {
  if (!maPosition) return '';
  const c = coordsCache(adresse);
  if (!c) return '';
  const d = haversine(maPosition.lat, maPosition.lng, c.lat, c.lng);
  return `<span class="badge-dist" style="display:inline-block;margin-top:3px;">🚶 ${formatDist(d)}</span>`;
}

/** Bloc historique éditable d'un contact (statut + date + RDV + ajout/suppression).
 *  Toujours rendu (avec bouton ➕) pour permettre de compléter un historique vide. */
export function buildHistoriqueHTML(c, i) {
  const hist = Array.isArray(c.historique) ? c.historique : [];
  // Du plus récent au plus ancien (idx = position réelle conservée)
  const lignes = hist.map((h, idx) => ({ h, idx })).reverse().map(({ h, idx }) => {
    const def = statutDef(h.statut);
    const opts = statutDefs().map(s =>
      `<option value="${esc(s.label)}"${s.label === h.statut ? ' selected' : ''}>${esc(s.icon)} ${esc(statutLabel(s.label))}</option>`
    ).join('');
    let rdvField = '';
    if (def.rdv) {
      const p = (h.rdv ? h.rdv + ' ' : ' ').split(' ');
      const rdvFr = h.rdv ? (dateISOToFr(p[0]) + (p[1] ? ' ' + p[1].trim() : '')) : '';
      rdvField = `<input type="text" class="hist-rdv" value="${esc(rdvFr)}" placeholder="${t('hist_rdv_ph')}" data-act="histRdv" data-i="${i}" data-idx="${idx}" title="${esc(t('hist_rdv_tip'))}"><button class="historique-cal" title="${esc(t('hist_open_cal'))}" aria-label="${esc(t('hist_open_cal'))}" data-act="ouvrirCalendrierRdvHist" data-i="${i}" data-idx="${idx}" data-rdv="${esc(h.rdv || '')}">📅</button>`;
    }
    return `<div class="historique-ligne">
      <div class="historique-dot" style="background:${def.color}"></div>
      <select class="hist-statut" data-act="histStatut" data-i="${i}" data-idx="${idx}">${opts}</select>
      <input type="text" class="historique-date" value="${esc(h.date)}" readonly tabindex="-1" title="${esc(t('hist_date_tip'))}">
      <button class="historique-cal" title="${esc(t('hist_edit_date'))}" aria-label="${esc(t('hist_edit_date'))}" data-act="ouvrirCalendrierHist" data-i="${i}" data-idx="${idx}" data-date="${esc(h.date)}">📅</button>
      ${rdvField}
      <button class="historique-del" title="${esc(t('hist_del_entry'))}" aria-label="${esc(t('hist_del_entry'))}" data-act="supprimerHistorique" data-i="${i}" data-idx="${idx}">✕</button>
    </div>`;
  }).join('');
  return `<div class="historique-wrap" id="hist-${i}">
    <div class="historique-title">${t('hist_title')} (${hist.length})</div>
    ${lignes}
    <button class="btn-secondary" style="align-self:flex-start;font-size:12px;padding:4px 10px;margin-top:4px;" data-act="ajouterHistorique" data-i="${i}">${t('hist_add')}</button>
  </div>`;
}

/** Met à jour la carte (bordure, badge statut, date) + les boutons de statut du
 *  formulaire d'édition, en place (sans refermer la fiche) */
export function majCarteStatut(i) {
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
  // Barres de statut (carte + formulaire) : reflète le statut courant. La barre du
  // formulaire (dans .edit-area) est éditable ; celle de la carte est verrouillée.
  card.querySelectorAll('.statut-bar').forEach(bar => {
    const inEdit = !!bar.closest('.edit-area');
    // Formulaire : barre complète éditable ; carte compacte : puce du statut courant.
    bar.innerHTML = inEdit ? statutBarHTML(i, c.statut) : statutChipHTML(i, c.statut, def);
  });
}

export function buildRdvCard(c, i, today, def) {
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
      <button class="btn-edit" data-act="editDepuisRdv" data-i="${i}">🖊️</button>
    </div>
    ${(() => { const d = ligneDemographie(c); return d ? `<div class="card-demo">👤 ${d}</div>` : ''; })()}
    <div class="card-adresse-row">
      <a class="card-adresse" href="${mapsUrl(c.adresse)}" target="_blank" rel="noopener">📍 ${esc(c.adresse)}</a>
      ${distHtml}
    </div>
    ${(() => { const mb = methodeBadge(c); const tb = c.gsm ? telBE(c.gsm) : null; const tel = c.gsm ? `<a class="badge badge-tel" href="tel:${esc(tb?tb.e164:c.gsm)}">📞 ${esc(tb?tb.disp:c.gsm)}</a>` : ''; return (mb || tel) ? `<div class="card-badges" style="margin-top:4px">${mb}${tel}</div>` : ''; })()}
    ${c.notes ? `<div style="margin-top:6px;font-size:12px;color:var(--text3);">📝 ${esc(c.notes)}</div>` : ''}
    ${buildHistoriqueHTML(c, i)}`;
  return div;
}

export function allerAFiche(enq, idx) {
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

export function toggleKebab() {
  const m = document.getElementById('kebabMenu');
  const ouverture = !m.classList.contains('open');
  m.classList.toggle('open');
  const btn = document.getElementById('btnKebab');
  if (btn) btn.setAttribute('aria-expanded', ouverture ? 'true' : 'false');   // a11y : état du menu
  // À l'ouverture, rafraîchir la ligne d'état de sauvegarde (dernière sauvegarde /
  // modifications non sauvegardées) — réexposée via le pont window.
  if (ouverture && typeof majKebabBackupInfo === 'function') majKebabBackupInfo();
}

export function emailSuggest(input, sugId) {
  const val=input.value, at=val.indexOf('@'), box=document.getElementById(sugId);
  if (!box) return;
  if (at<0){fermerSuggestions(sugId);return;}
  const avant=val.slice(0,at+1), apres=val.slice(at+1).toLowerCase();
  const filtres=EMAIL_DOMAINES.filter(d=>d.startsWith(apres));
  if (!filtres.length){fermerSuggestions(sugId);return;}
  box.innerHTML=filtres.map((d,idx)=>`<button class="email-sug-item" data-idx="${idx}" data-act="choisirSuggestion" data-sugid="${esc(sugId)}" data-val="${esc(avant+d)}">${avant}${d}</button>`).join('');
  box.classList.add('open');
}

export function choisirSuggestion(e, sugId, valeur) {
  e.preventDefault();
  const box=document.getElementById(sugId); if(!box) return;
  const input=box.closest('.email-wrap').querySelector('input'); if(!input) return;
  input.value=valeur;
  changerEmail(parseInt(sugId.replace('esug-','')), valeur);
  fermerSuggestions(sugId); input.focus();
}

export function fermerSuggestions(sugId) { const b=document.getElementById(sugId); if(b) b.classList.remove('open'); }

export function emailKeydown(e, sugId) {
  const box=document.getElementById(sugId); if(!box||!box.classList.contains('open')) return;
  const items=box.querySelectorAll('.email-sug-item'), focused=box.querySelector('.focused');
  let idx=focused?parseInt(focused.dataset.idx):-1;
  if (e.key==='ArrowDown'){e.preventDefault();if(focused)focused.classList.remove('focused');items[(idx+1)%items.length].classList.add('focused');}
  else if (e.key==='ArrowUp'){e.preventDefault();if(focused)focused.classList.remove('focused');items[(idx-1+items.length)%items.length].classList.add('focused');}
  else if (e.key==='Enter'&&focused){e.preventDefault();focused.dispatchEvent(new MouseEvent('mousedown'));}
  else if (e.key==='Escape') fermerSuggestions(sugId);
}
