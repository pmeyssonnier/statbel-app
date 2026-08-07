/*
 * js/ui/stats.js — Graphes et journal du tableau de bord : collecte des visites,
 * histogramme d'activité quotidienne, progression globale, courbe d'avancement
 * (SVG) et journal chronologique cliquable. Partagé par les vues « Suivi »
 * (renduRdv) et « Résumé » (renduResume). Extrait de js/app.js (modules ES).
 *
 * Imports : esc, dateFrToISO, dateISOToFr (util) ; t, tPlural (i18n) ;
 * statutLabel (canon). Le reste (enquetes, settings, statutDef/Defaut,
 * formatDateJour, filtrerActiviteJour, ouvrirFicheEvtIdx, _activiteJour,
 * _journalEvents) est global (pont / globalThis).
 */
import { esc, dateFrToISO, dateISOToFr } from '../core/util.js';
import { t, tPlural } from '../core/i18n.js';
import { statutLabel } from '../data/canon.js';

// Graphe « activité quotidienne » : nombre de visites par statut et par jour,
// depuis le 1er passage enregistré jusqu'à aujourd'hui. Source : c.historique
// (chaque passage « done » daté — y compris plusieurs absences pour un contact).
// Collecte tous les « événements » (visites datées) de toutes les enquêtes,
// triés chronologiquement. Base commune du graphe et du journal.
// Source : historique daté + état courant « terminé » non encore dans l'historique.
// enqFilter : si fourni, ne collecte que les visites de cette enquête.
export function collecterVisites(enqFilter) {
  const ev = [];
  Object.entries(enquetes).forEach(([enq, arr]) => {
    if (enqFilter && enq !== enqFilter) return;
    arr.forEach(c => {
      const dCur = statutDef(c.statut || '');

      // ── Historique des passages (done ET en cours), daté du jour de visite ──
      const visites = (c.historique || [])
        .filter(h => h && h.date && h.statut)
        .map(h => ({ statut: h.statut, date: h.date, heure: h.heure || '', rdv: h.rdv || '' }));

      // État courant done : inclus si pas déjà dans l'historique (contacts importés)
      if (c.statut && c.date && dCur && dCur.done) {
        if (!visites.some(v => v.statut === c.statut && v.date === c.date)) {
          visites.push({ statut: c.statut, date: c.date, heure: c.heure || '' });
        }
      }

      // RDV planifié : événement distinct à la date du RDV (marqué isRdv)
      if (c.statut && c.rdv && dCur && dCur.rdv) {
        const parts   = (c.rdv + ' ').split(' ');
        const dateRdv = dateISOToFr(parts[0] || '');
        const heure   = (parts[1] || '').trim();
        if (dateRdv) visites.push({ statut: c.statut, date: dateRdv, heure, isRdv: true });
      }

      visites.forEach(v => {
        const iso = dateFrToISO(v.date);
        if (!iso) return;
        ev.push({
          iso:    v.heure ? iso + 'T' + v.heure : iso,
          date:   v.date,
          heure:  v.heure || '',
          isRdv:  !!v.isRdv,
          statut: v.statut,
          prenom: c.prenom, nom: c.nom, ordre: c.ordre, enq,
        });
      });
    });
  });
  ev.sort((a, b) => a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0);
  return ev;
}

export function renderActiviteQuotidienne(enqFilter, statutFilter) {
  // Le graphe ne compte que les VISITES — pas les RDV à venir (évite le double
  // comptage avec le « Fait » du jour de l'interview).
  let events = collecterVisites(enqFilter).filter(e => !e.isRdv);
  if (statutFilter && statutFilter !== 'Tous') events = events.filter(e => e.statut === statutFilter);
  const parJour = {};                 // { isoDate: { statutLabel: count } }
  const presents = new Set();
  events.forEach(e => {
    const jour = e.iso.slice(0, 10);   // regrouper par date seule (les RDV ont une heure dans iso)
    (parJour[jour] = parJour[jour] || {})[e.statut] = (parJour[jour][e.statut] || 0) + 1;
    presents.add(e.statut);
  });
  const dates = Object.keys(parJour).sort();
  let html = `<div class="resume-section-title">${t('res_activity')}</div>`;
  if (!dates.length) return html + `<div style="font-size:12px;color:var(--text3);">${t('res_activity_none')}</div>`;

  // Statuts présents, dans l'ordre configuré
  const statutsOrdre = statutDefs().filter(s => presents.has(s.label));
  // Légende (+ courbe % faits, uniquement en vue non filtrée)
  const montreProg = !statutFilter || statutFilter === 'Tous' || statutFilter === 'Done';
  html += '<div class="progress-legend" style="margin-bottom:6px;">' + statutsOrdre.map(s =>
    `<div class="prog-leg-item"><div class="prog-leg-dot" style="background:${s.color}"></div>${esc(s.icon)} ${esc(statutLabel(s.label))}</div>`
  ).join('') + (montreProg
    ? `<div class="prog-leg-item"><span style="display:inline-block;width:16px;height:0;border-top:2px solid #283593;margin-right:3px;vertical-align:middle"></span>% ${t('prog_done')}</div>`
    : '') + '</div>';

  // Liste des jours : du 1er passage à aujourd'hui (inclus)
  const today = new Date().toISOString().slice(0, 10);
  const fin = today > dates[dates.length - 1] ? today : dates[dates.length - 1];
  const jours = [];
  for (let d = new Date(dates[0] + 'T00:00'); d.toISOString().slice(0, 10) <= fin; d.setDate(d.getDate() + 1)) {
    jours.push(d.toISOString().slice(0, 10));
  }
  const totalJour = iso => Object.values(parJour[iso] || {}).reduce((a, b) => a + b, 0);
  const maxTot = Math.max(1, ...jours.map(totalJour));

  // Repères horizontaux (axe) : ~4 graduations à des valeurs « rondes »
  const step = maxTot <= 5 ? 1 : maxTot <= 10 ? 2 : maxTot <= 25 ? 5 : Math.ceil(maxTot / 5 / 5) * 5;
  let grid = '<div class="activite-grid">';
  for (let v = step; v <= maxTot; v += step) {
    grid += `<div class="activite-gline" style="bottom:${(v / maxTot) * 100}%"><span class="activite-gval">${v}</span></div>`;
  }
  grid += '</div>';

  html += '<div class="activite-wrap">' + grid + '<div class="activite-chart">' + jours.map(iso => {
    const cpt = parJour[iso] || {};
    const tot = totalJour(iso);
    const segs = statutsOrdre.filter(s => cpt[s.label]).map(s => {
      const hPct = (cpt[s.label] / maxTot) * 100;
      const d = statutDef(s.label);
      return `<div class="activite-seg" style="height:${hPct}%;background:${s.color}" title="${esc(statutLabel(s.label))} : ${cpt[s.label]}">${cpt[s.label]}</div>`;
    }).join('');
    const [y, m, dd] = iso.split('-');
    const sel = (_activiteJour === iso) ? ' activite-col-sel' : (_activiteJour ? ' activite-col-dim' : '');
    return `<div class="activite-col${sel}" data-iso="${iso}" title="${dd}/${m}/${y} — ${tot} ${tPlural('res_visits', tot)}" onclick="filtrerActiviteJour('${iso}')">
      <div class="activite-bars">${segs}</div>
      <div class="activite-lbl">${dd}/${m}</div>
    </div>`;
  }).join('') + '</div></div>';
  return html;
}

/** Barre de progression globale : Fait / total (+ à traiter / clôturés autrement) */
export function renderProgressionGlobale(enqFilter) {
  const cs = enqFilter ? (enquetes[enqFilter] || []) : Object.values(enquetes).flat();
  const total = cs.length;
  if (!total) return '';
  let fait = 0, clos = 0, rest = 0;
  cs.forEach(c => {
    const st = c.statut || statutDefaut();
    if (st === 'Done') fait++;
    else if (statutDef(st).done) clos++;
    else rest++;
  });
  const pc = Math.round(fait / total * 100);
  const col = statutDef('Done').color;
  return `<div class="progress-global">
    <div class="pg-bar">
      <div class="pg-seg" style="width:${fait / total * 100}%;background:${col}"></div>
      <div class="pg-seg" style="width:${clos / total * 100}%;background:#b0bec5"></div>
      <div class="pg-seg" style="width:${rest / total * 100}%;background:#eceff1"></div>
    </div>
    <div class="pg-label">✓ <b>${fait}</b> / ${total} ${t('prog_done')} (${pc} %) · ⏳ ${rest} ${t('prog_pending')} · ⊘ ${clos} ${t('prog_closed')}</div>
  </div>`;
}

/** Courbe autonome (Résumé) : % de Fait cumulés dans le temps (SVG, axe % + infobulles) */
export function renderCourbeAvancement(enqFilter) {
  const events = collecterVisites(enqFilter).filter(e => !e.isRdv && e.statut === 'Done');
  const cs = enqFilter ? (enquetes[enqFilter] || []) : Object.values(enquetes).flat();
  const total = cs.length;
  const parJour = {};
  events.forEach(e => { const j = e.iso.slice(0, 10); parJour[j] = (parJour[j] || 0) + 1; });
  const dates = Object.keys(parJour).sort();
  if (!dates.length || !total) return `<div style="font-size:12px;color:var(--text3)">${t('res_activity_none')}</div>`;

  const today = new Date().toISOString().slice(0, 10);
  const fin = today > dates[dates.length - 1] ? today : dates[dates.length - 1];
  const jours = [];
  for (let d = new Date(dates[0] + 'T00:00'); d.toISOString().slice(0, 10) <= fin; d.setDate(d.getDate() + 1)) {
    jours.push(d.toISOString().slice(0, 10));
  }
  let cum = 0;
  const pts = jours.map(j => { cum += parJour[j] || 0; return { iso: j, pct: cum / total, cum }; });

  const W = 600, H = 150, padL = 30, padR = 14, padT = 12, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = jours.length;
  const X = i => padL + (n <= 1 ? plotW / 2 : i * (plotW / (n - 1)));
  const Y = pct => padT + plotH - pct * plotH;
  const col = statutDef('Done').color;

  const grid = [0, 0.5, 1].map(f =>
    `<line x1="${padL}" y1="${Y(f).toFixed(1)}" x2="${W - padR}" y2="${Y(f).toFixed(1)}" stroke="#cfd8dc" stroke-dasharray="3 3" stroke-width="1"/>` +
    `<text x="${padL - 5}" y="${(Y(f) + 3).toFixed(1)}" text-anchor="end" style="fill:var(--text3);font-size:9px">${Math.round(f * 100)}%</text>`
  ).join('');
  const stepX = Math.max(1, Math.ceil(n / 6));
  const xlabels = jours.map((j, i) => {
    if (i !== 0 && i !== n - 1 && i % stepX !== 0) return '';
    const [, m, dd] = j.split('-');
    return `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" style="fill:var(--text3);font-size:9px">${dd}/${m}</text>`;
  }).join('');
  const area = `M${X(0).toFixed(1)} ${Y(0).toFixed(1)} ` +
    pts.map((p, i) => `L${X(i).toFixed(1)} ${Y(p.pct).toFixed(1)}`).join(' ') +
    ` L${X(n - 1).toFixed(1)} ${Y(0).toFixed(1)} Z`;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.pct).toFixed(1)}`).join(' ');
  const hits = pts.map((p, i) => {
    const [, m, dd] = p.iso.split('-');
    return `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.pct).toFixed(1)}" r="8" fill="transparent" style="pointer-events:all"><title>${dd}/${m} — ${p.cum}/${total} ${t('prog_done')} (${Math.round(p.pct * 100)} %)</title></circle>`;
  }).join('');
  // Étiquettes = total cumulé de Fait sur chaque point où ça augmente (hors dernier)
  let prevCum = -1;
  const nums = pts.map((p, i) => {
    if (i === n - 1 || p.cum === prevCum || p.cum === 0) { prevCum = p.cum; return ''; }
    prevCum = p.cum;
    return `<text x="${X(i).toFixed(1)}" y="${(Y(p.pct) - 6).toFixed(1)}" text-anchor="middle" style="fill:${col};font-size:9px;font-weight:700">${p.cum}</text>`;
  }).join('');
  const lastPt = pts[pts.length - 1];
  const lastX = X(n - 1), lastY = Y(lastPt.pct);
  return `<svg class="cumul-chart" viewBox="0 0 ${W} ${H}" role="img">
    ${grid}
    <path d="${area}" fill="${col}" fill-opacity="0.15"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    ${hits}${nums}
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="${col}"/>
    <text x="${(lastX - 5).toFixed(1)}" y="${(lastY - 6).toFixed(1)}" text-anchor="end" style="fill:${col};font-size:11px;font-weight:700">${lastPt.cum} (${Math.round(lastPt.pct * 100)} %)</text>
    ${xlabels}
  </svg>`;
}

/** Superpose au graphe d'activité la courbe de progression : % de Fait cumulés.
 *  La courbe est placée DANS le conteneur qui défile (.activite-chart) → elle suit
 *  les barres même en scroll horizontal (mobile). L'axe % reste fixe sur le wrap. */
export function dessinerCourbeProgression(enqFilter) {
  const wrap = document.querySelector('#rdvListe .activite-wrap');
  if (!wrap) return;
  const chart = wrap.querySelector('.activite-chart');
  wrap.querySelectorAll('.prog-overlay, .prog-axis').forEach(el => el.remove());
  const cols = chart ? [...chart.querySelectorAll('.activite-col')] : [];
  if (!chart || !cols.length) return;

  // Fait cumulés par jour
  const doneJour = {};
  collecterVisites(enqFilter).filter(e => !e.isRdv && e.statut === 'Done')
    .forEach(e => { const j = e.iso.slice(0, 10); doneJour[j] = (doneJour[j] || 0) + 1; });
  const cs = enqFilter ? (enquetes[enqFilter] || []) : Object.values(enquetes).flat();
  const total = Math.max(cs.length, 1);

  const cr = chart.getBoundingClientRect();
  const b0 = cols[0].querySelector('.activite-bars').getBoundingClientRect();
  const baseY = b0.bottom - cr.top;   // y du 0 % (relatif au graphe)
  const topY  = b0.top - cr.top;      // y du 100 %
  const yOf = pct => baseY - pct * (baseY - topY);

  let cum = 0;
  const pts = cols.map(c => {
    cum += doneJour[c.dataset.iso] || 0;
    const r = c.querySelector('.activite-bars').getBoundingClientRect();
    const [, m, d] = c.dataset.iso.split('-');
    // x dans le repère scrollable du graphe (suit le défilement)
    return { x: r.left + r.width / 2 - cr.left + chart.scrollLeft, pct: cum / total, cum, jour: `${d}/${m}` };
  });

  const cw = chart.scrollWidth, ch = chart.clientHeight, col = '#283593';
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${yOf(p.pct).toFixed(1)}`).join(' ');
  const dots = pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${yOf(p.pct).toFixed(1)}" r="2.2" fill="${col}"/>`).join('');
  const hits = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${yOf(p.pct).toFixed(1)}" r="9" fill="transparent" style="pointer-events:all"><title>${p.jour} — ${p.cum}/${total} ${t('prog_done')} (${Math.round(p.pct * 100)} %)</title></circle>`
  ).join('');
  const last = pts[pts.length - 1];
  // Étiquettes = total cumulé de Fait, sur chaque point où ça augmente (hors dernier)
  let prevCum = -1;
  const nums = pts.map((p, i) => {
    if (i === pts.length - 1 || p.cum === prevCum || p.cum === 0) { prevCum = p.cum; return ''; }
    prevCum = p.cum;
    return `<text x="${p.x.toFixed(1)}" y="${(yOf(p.pct) - 6).toFixed(1)}" text-anchor="middle" style="fill:${col};font-size:9px;font-weight:700">${p.cum}</text>`;
  }).join('');
  // Courbe DANS le graphe (défile avec les barres)
  const svg = `<svg class="prog-overlay" width="${cw}" height="${ch}" style="position:absolute;left:0;top:0;pointer-events:none;z-index:2;overflow:visible">
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
    ${dots}${hits}${nums}
    <text x="${(last.x - 5).toFixed(1)}" y="${(yOf(last.pct) - 6).toFixed(1)}" text-anchor="end" style="fill:${col};font-size:11px;font-weight:700">${last.cum} (${Math.round(last.pct * 100)} %)</text>
  </svg>`;
  chart.insertAdjacentHTML('beforeend', svg);

  // Axe % FIXE à droite (posé sur le wrap, ne défile pas)
  const wr = wrap.getBoundingClientRect();
  const yW = pct => (b0.bottom - wr.top) - pct * ((b0.bottom - wr.top) - (b0.top - wr.top));
  const axis = [0, 0.5, 1].map(f =>
    `<div class="prog-axis-lbl" style="top:${(yW(f) - 6).toFixed(1)}px">${Math.round(f * 100)}%</div>`
  ).join('');
  wrap.insertAdjacentHTML('beforeend', `<div class="prog-axis" style="color:${col}">${axis}</div>`);
}

// Journal chronologique des événements.
// enqFilter : filtre sur une enquête; modeRdv : style brique sans colonne enquête.
// statutFilter : si fourni (≠ 'Tous'), ne montrer que les événements de ce statut.
// searchFilter : filtre texte sur nom/prénom.
export function renderEvenementsChrono(enqFilter, modeRdv, statutFilter, searchFilter, dateFilter) {
  let events = collecterVisites(enqFilter);
  if (dateFilter) {
    events = events.filter(e => e.iso.slice(0, 10) === dateFilter);
  }
  if (statutFilter && statutFilter !== 'Tous') {
    events = events.filter(e => e.statut === statutFilter);
  }
  if (searchFilter) {
    const q = searchFilter.toLowerCase();
    events = events.filter(e =>
      `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
      `${e.nom} ${e.prenom}`.toLowerCase().includes(q)
    );
  }
  if (modeRdv) {
    // Style brique, du plus récent au plus ancien, sans colonne enquête.
    // Lignes cliquables → ouvrent la fiche (référence par index dans _journalEvents).
    const evInv = [...events].reverse();
    _journalEvents = evInv;
    if (!evInv.length) return `<div style="font-size:12px;color:var(--text3);padding:8px 0">${t('res_activity_none')}</div>`;
    return '<div class="evt-briques-header">'
      + `<span class="ebh-date">${t('col_date')}</span>`
      + `<span class="ebh-statut">${t('col_status')}</span>`
      + `<span class="ebh-nom">${t('col_contact')}</span>`
      + '</div>'
      + '<div class="evt-briques-wrap">' + evInv.map((e, i) => {
      const d = statutDef(e.statut);
      const dateLabel = formatDateJour(e.date) + (e.heure ? ' ' + e.heure : '');
      // Événement RDV : libellé « 📅 RDV » ; sinon icône + statut
      const statutCell = e.isRdv ? `📅 ${esc(t('rdv_label'))}` : `${esc(d.icon)} ${esc(statutLabel(e.statut))}`;
      const col = e.isRdv ? '#1565c0' : d.color;
      return `<div class="evt-brique" onclick="ouvrirFicheEvtIdx(${i})">
        <span class="eb-date">${esc(dateLabel)}</span>
        <span class="eb-statut" style="color:${col}">${statutCell}</span>
        <span class="eb-nom">${esc(e.prenom)} ${esc(e.nom)}</span>
      </div>`;
    }).join('') + '</div>';
  }
  // Style tableau (vue Résumé, toutes enquêtes)
  let html = `<div class="resume-section-title">${t('res_events')}</div>`;
  if (!events.length) return html + `<div style="font-size:12px;color:var(--text3);">${t('res_activity_none')}</div>`;
  html += '<div class="evt-list">' + events.map(e => {
    const d = statutDef(e.statut);
    return `<div class="evt-row">
      <span class="evt-date">${esc(formatDateJour(e.date))}</span>
      <span class="evt-statut" style="color:${d.color}">${esc(d.icon)} ${esc(statutLabel(e.statut))}</span>
      <span class="evt-nom">N°${esc(e.ordre)} ${esc(e.prenom)} ${esc(e.nom)}</span>
      <span class="evt-enq" title="${esc(e.enq)}">${esc(e.enq)}</span>
    </div>`;
  }).join('') + '</div>';
  return html;
}
