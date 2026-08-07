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
import { esc, formaterGsm, formatHeureSaisie, calcAge, todayStr, nowHHMM,
         dateFrToISO, dateISOToFr, composeAdresse, parseAdresse, adresseSansBoite,
         correspondRecherche } from '../core/util.js';
import { t, tPlural, nomJourCourt } from '../core/i18n.js';
import { statutLabel, paysAffiche, etatCivilGenre, maritalCanon,
         MARITAL_I18N, PAYS_I18N } from '../data/canon.js';
import { coordsCache } from '../data/idb.js';
import { ajouterHistorique } from '../features/history.js';

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

export function changerEmail(i, val)  { contacts()[i].email = val;  sauverBientot(); }

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
  if (c.taille_menage) parts.push('👥 ' + esc(c.taille_menage) + ' ' + tPlural('persons', c.taille_menage));
  return parts.join(' · ');
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
  if (el.classList.contains('open')) document.getElementById('edit-prenom-'+i).focus();
}

// Ouvre (et construit si besoin) le formulaire d'édition d'une fiche
export function ouvrirEdit(i) {
  const el = document.getElementById('edit-'+i);
  if (!el) return null;
  if (!el.dataset.built) { el.innerHTML = buildEditForm(i); el.dataset.built = '1'; }
  el.classList.add('open');
  return el;
}

// Génère le contenu du formulaire d'édition d'une fiche (à la demande)
export function buildEditForm(i) {
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

export function sauverEdit(i) {
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
  if (c.email) vcard += 'EMAIL:'+c.email+CRLF;
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
  let html = `<button class="filter-btn${filtreActif==='Tous'?' active':''}" onclick="filtrer('Tous')">${t('f_all')}${total>0?' ('+total+')':''}</button>`;
  statutDefs().forEach((s, si) => {
    const n = cpt[s.label] || 0;
    const on = filtreActif === s.label;
    html += `<button class="filter-btn" style="border-color:${s.color};color:${on?'#fff':s.color};background:${on?s.color:'var(--filter-bg)'}" onclick="filtrer(statutDefs()[${si}].label)">${s.icon} ${esc(statutLabel(s.label))}${n>0?' ('+n+')':''}</button>`;
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
  // Barres de statut (carte + formulaire) : reflète le statut courant
  card.querySelectorAll('.statut-bar').forEach(bar => {
    bar.innerHTML = statutDefs().map((s, si) => {
      const on = s.label === c.statut;
      return `<button class="s-btn${on ? ' actif' : ''}" style="color:${s.color};${on ? `border-color:${s.color};background:${s.color}22;` : ''}" onclick="event.stopPropagation();changerStatut(${i},statutDefs()[${si}].label)">${s.icon} ${esc(statutLabel(s.label))}</button>`;
    }).join('');
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

export function toggleKebab() { document.getElementById('kebabMenu').classList.toggle('open'); }

export function emailSuggest(input, sugId) {
  const val=input.value, at=val.indexOf('@'), box=document.getElementById(sugId);
  if (!box) return;
  if (at<0){fermerSuggestions(sugId);return;}
  const avant=val.slice(0,at+1), apres=val.slice(at+1).toLowerCase();
  const filtres=EMAIL_DOMAINES.filter(d=>d.startsWith(apres));
  if (!filtres.length){fermerSuggestions(sugId);return;}
  box.innerHTML=filtres.map((d,idx)=>`<button class="email-sug-item" data-idx="${idx}" onmousedown="choisirSuggestion(event,'${sugId}','${avant}${d}')">${avant}${d}</button>`).join('');
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
