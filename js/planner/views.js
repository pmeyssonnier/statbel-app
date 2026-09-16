/*
 * js/planner/views.js — Planner : VUES (setView/renderView + rendus liste, semaine, mois,
 * annee), NAVIGATION (navPrev/navNext/navToday, fenetres de dates) et UTILITAIRES (esc,
 * fmtDate, addDays, mondayOf, isoWeek...). Extrait verbatim du <script> du Planner. Script
 * CLASSIQUE : globales partagees du coeur ; fonctions appelees via onclick=/onchange=.
 */
// ══════════════════════════════════════════════════════════════════════
//  VUES
// ══════════════════════════════════════════════════════════════════════
function setView(v) {
  view = v;
  ['liste','semaine','mois','annee'].forEach(x => {
    document.getElementById('v'+x.charAt(0).toUpperCase()+x.slice(1))
      .classList.toggle('active', x === v);
  });
  document.getElementById('navControls').style.display = v === 'liste' ? 'none' : '';
  renderView();
}

function renderView() {
  if (view === 'liste')   renderListe();
  else if (view === 'semaine') renderSemaine();
  else if (view === 'mois')    renderMois();
  else renderAnnee();
}

// Groupes sélectionnés avec leurs données
function selectedRows() {
  return allRows.filter(r => selected.has(r.numero));
}

// Retourne la couleur CSS de vague pour une date donnée dans un groupe
function vagueForDate(row, d) {
  const ts = d.getTime();
  for (const v of row.vagues) {
    if (v.start && v.stop && ts >= v.start.getTime() && ts <= v.stop.getTime())
      return { cls: VAGUE_COLORS[v.idx-1], idx: v.idx, sem: v.sem };
  }
  return null;
}

// ── LISTE ────────────────────────────────────────────────────────────
function renderListe() {
  const rows = selectedRows();
  document.getElementById('navControls').style.display = 'none';

  // Aplatir toutes les vagues en lignes de tableau
  const items = [];
  rows.forEach(r => r.vagues.forEach(v => items.push({ row: r, v })));
  const isoOf = d => d ? isoLocal(d) : '';   // heure locale (toISOString décalerait d'un jour) — bug E3
  const data = items.map(({ row, v }) => ({
    numero:   row.numero,
    province: provLabel(row.province),
    commune:  row.commune.split('/')[0].trim(),
    quartier: row.quartier,
    vague:    v.idx,
    sem:      v.sem,
    debutIso: isoOf(v.start),
    finIso:   isoOf(v.stop),
    duree:    Math.round((v.stop - v.start) / 86400000) + 1,
  }));

  // Tableau triable (lib partagée js/charts.js) — clic sur un en-tête pour trier.
  if (window.Charts) {
    const frd = s => s ? s.split('-').reverse().join('/') : '';
    const cols = [
      { k: 'numero',   label: t('th_group'), render: x => `<strong>${esc(x)}</strong>` },
      { k: 'province', label: t('f_province') },
      { k: 'commune',  label: t('f_commune') },
      { k: 'quartier', label: t('th_quartier') },
      { k: 'vague',    label: t('th_wave'), num: true, render: x => `<span class="v-badge ${VAGUE_COLORS[x - 1]}">V${x}</span>` },
      { k: 'sem',      label: t('th_week_ref'), num: true, render: x => `S${esc(x)}` },
      { k: 'debutIso', label: t('th_start'), render: frd },
      { k: 'finIso',   label: t('th_end'),   render: frd },
      { k: 'duree',    label: t('th_duration'), num: true, render: x => `${x} ${t('unit_day')}` },
    ];
    Charts.table('agendaContent', cols, data, { key: 'debutIso', dir: 1 });
    return;
  }

  // Repli si la lib est absente : tableau statique trié par date de début.
  data.sort((a, b) => a.debutIso.localeCompare(b.debutIso));
  const frd = s => s ? s.split('-').reverse().join('/') : '';
  document.getElementById('agendaContent').innerHTML =
    `<table class="list-table"><thead><tr>
      <th>${esc(t('th_group'))}</th><th>${esc(t('f_province'))}</th><th>${esc(t('f_commune'))}</th><th>${esc(t('th_quartier'))}</th>
      <th>${esc(t('th_wave'))}</th><th>${esc(t('th_week_ref'))}</th><th>${esc(t('th_start'))}</th><th>${esc(t('th_end'))}</th><th>${esc(t('th_duration'))}</th>
    </tr></thead><tbody>` +
    data.map(d => `<tr>
      <td><strong>${esc(d.numero)}</strong></td><td>${esc(d.province)}</td>
      <td style="font-size:12px">${esc(d.commune)}</td><td style="font-size:12px">${esc(d.quartier)}</td>
      <td><span class="v-badge ${VAGUE_COLORS[d.vague-1]}">V${d.vague}</span></td>
      <td style="text-align:center;font-weight:700">S${esc(d.sem)}</td>
      <td>${frd(d.debutIso)}</td><td>${frd(d.finIso)}</td>
      <td style="text-align:center">${d.duree} ${esc(t('unit_day'))}</td>
    </tr>`).join('') + '</tbody></table>';
}

// ── SEMAINE ──────────────────────────────────────────────────────────
function renderSemaine() {
  document.getElementById('navControls').style.display = '';
  // Trouver le lundi de la semaine courante
  const mon = mondayOf(navDate);
  document.getElementById('navLabel').textContent = tf('js_week_range',{w:isoWeek(mon),d1:fmtDate(mon),d2:fmtDate(addDays(mon,6))});

  const rows = selectedRows();
  const today = new Date(); today.setHours(0,0,0,0);

  let html = '<div class="week-grid">';
  // En-têtes
  html += '<div class="week-grp-label" style="border:none;font-size:10px;color:var(--ink3);font-weight:700">'+esc(t('js_group_upper'))+'</div>';
  for (let d = 0; d < 7; d++) {
    const day = addDays(mon, d);
    const isToday = day.toDateString() === today.toDateString();
    html += `<div class="week-head" style="${isToday?'color:var(--accent);':''}">${joursNoms()[d]}<br><strong>${day.getDate()}</strong></div>`;
  }

  rows.forEach(row => {
    html += `<div class="week-grp-label"><div>
      <div style="font-size:11px;font-weight:700">${esc(row.numero)}</div>
      <div style="font-size:9px;color:var(--ink3)">${esc(row.quartier.split(' ')[0])}</div>
    </div></div>`;
    for (let d = 0; d < 7; d++) {
      const day = addDays(mon, d);
      const vague = vagueForDate(row, day);
      const isToday = day.toDateString() === today.toDateString();
      if (vague) {
        html += `<div class="week-day ${vague.cls}${isToday?' today':''}">V${vague.idx}</div>`;
      } else {
        html += `<div class="week-day${isToday?' today':''}" style="background:var(--bg)"></div>`;
      }
    }
  });
  html += '</div>';
  document.getElementById('agendaContent').innerHTML = html;
}

// ── MOIS ─────────────────────────────────────────────────────────────
function renderMois() {
  document.getElementById('navControls').style.display = '';
  const yr = navDate.getFullYear(), mo = navDate.getMonth();
  document.getElementById('navLabel').textContent = `${moisNoms()[mo]} ${yr}`;

  const firstDay = new Date(yr, mo, 1);
  const lastDay  = new Date(yr, mo+1, 0);
  const today    = new Date(); today.setHours(0,0,0,0);
  const rows     = selectedRows();

  let html = '<div class="month-grid">';
  joursNoms().forEach(j => html += `<div class="month-head">${j}</div>`);

  // Remplir les jours vides avant le 1er
  let dow = (firstDay.getDay() + 6) % 7; // 0=lun
  for (let i = 0; i < dow; i++) {
    const prev = new Date(yr, mo, 1-dow+i);
    html += `<div class="month-day other-month"><div class="day-num">${prev.getDate()}</div></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const cur = new Date(yr, mo, d);
    const isToday = cur.toDateString() === today.toDateString();
    const events = rows.flatMap(row => {
      const v = vagueForDate(row, cur);
      return v ? [{ row, v }] : [];
    });
    const lbl = `${d} ${moisNoms()[mo]} ${yr}` + (events.length
      ? tf('js_waves_count',{n:events.length}) + events.map(e => `${e.row.numero} V${e.v.idx}`).join(', ')
      : t('js_no_wave'));
    html += `<div class="month-day${isToday?' today':''}" tabindex="0" aria-label="${esc(lbl)}">
      <div class="day-num" aria-hidden="true">${d}</div>
      <div class="day-events" aria-hidden="true">
        ${events.slice(0,4).map(({row,v}) => `
          <div class="day-ev ${VAGUE_COLORS[v.idx-1]}" title="${esc(row.numero + ' — ' + row.quartier)}">
            ${esc(row.numero)} V${v.idx}
          </div>`).join('')}
        ${events.length > 4 ? `<div style="font-size:9px;color:var(--ink3)">+${events.length-4}…</div>` : ''}
      </div>
    </div>`;
  }

  // Compléter la dernière semaine
  const remain = (7 - ((dow + lastDay.getDate()) % 7)) % 7;
  for (let i = 1; i <= remain; i++) {
    html += `<div class="month-day other-month"><div class="day-num">${i}</div></div>`;
  }
  html += '</div>';
  document.getElementById('agendaContent').innerHTML = html;
}

// ── ANNÉE ────────────────────────────────────────────────────────────
function renderAnnee() {
  document.getElementById('navControls').style.display = '';
  const yr = navDate.getFullYear();
  document.getElementById('navLabel').textContent = String(yr);

  const rows  = selectedRows();
  // Tri par date de début de V1
  const rowsSorted = [...rows].sort((a, b) => {
    const va = a.vagues.find(v => v.idx === 1) || a.vagues[0];
    const vb = b.vagues.find(v => v.idx === 1) || b.vagues[0];
    return (va?.start?.getTime()||0) - (vb?.start?.getTime()||0);
  });
  if (!rowsSorted.length) {
    document.getElementById('agendaContent').innerHTML =
      '<div class="empty"><div class="em-icon">📅</div>'+esc(t('no_group_selected'))+'</div>';
    return;
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const JOURS_COURT = joursNoms().map(j => j.charAt(0).toUpperCase());   // initiales localisées
  let html = '';
  rowsSorted.forEach(row => {
    html += `<div style="margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:8px;
                  padding:5px 10px;background:var(--bg);border-radius:6px;
                  display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex:none"></span>
        ${esc(row.numero)} — ${esc(row.quartier)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:6px">`;

    for (let mo = 0; mo < 12; mo++) {
      const daysInMonth = new Date(yr, mo+1, 0).getDate();
      // Jour de semaine du 1er du mois (0=lun … 6=dim)
      const firstDow = (new Date(yr, mo, 1).getDay() + 6) % 7;

      html += `<div>
        <div style="font-size:9px;font-weight:700;text-align:center;color:var(--accent);
                    margin-bottom:4px;text-transform:uppercase">${moisNoms()[mo].slice(0,3)}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">`;

      // En-tête L M M J V S D
      JOURS_COURT.forEach(j => {
        html += `<div style="font-size:7px;text-align:center;color:var(--ink3);font-weight:700;
                             padding-bottom:2px">${j}</div>`;
      });

      // Cases vides avant le 1er
      for (let i = 0; i < firstDow; i++) {
        html += `<div style="height:10px"></div>`;
      }

      // Jours du mois
      for (let d = 1; d <= daysInMonth; d++) {
        const cur = new Date(yr, mo, d);
        const v   = vagueForDate(row, cur);
        const isT = cur.toDateString() === today.toDateString();
        const bg  = v ? `var(--${VAGUE_COLORS[v.idx-1]}l)` : '#f0f0f0';
        const brd = v ? `2px solid var(--${VAGUE_COLORS[v.idx-1]})` : '1px solid transparent';
        html += `<div title="${fmtDate(cur)}${v?' — V'+v.idx:''}"
          style="height:10px;border-radius:2px;background:${bg};border:${brd};
                 ${isT?'outline:1px solid var(--accent);outline-offset:1px;':''}
                 display:flex;align-items:center;justify-content:center;cursor:default">
          ${v?`<span style="font-size:7px;font-weight:700;line-height:1;color:var(--ink)">${v.idx}</span>`:''}
        </div>`;
      }
      html += '</div></div>';
    }
    html += '</div></div>';
  });

  if (!html) html = '<div class="empty"><div class="em-icon">📅</div>'+esc(t('no_group_selected'))+'</div>';
  document.getElementById('agendaContent').innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════════════
function navPrev() {
  if (view === 'semaine') navDate = addDays(navDate, -7);
  else if (view === 'mois') navDate = new Date(navDate.getFullYear(), navDate.getMonth()-1, 1);
  else navDate = new Date(navDate.getFullYear()-1, 0, 1);
  renderView();
}
function navNext() {
  if (view === 'semaine') navDate = addDays(navDate, 7);
  else if (view === 'mois') navDate = new Date(navDate.getFullYear(), navDate.getMonth()+1, 1);
  else navDate = new Date(navDate.getFullYear()+1, 0, 1);
  renderView();
}
function navToday() { navDate = new Date(); renderView(); }

// ══════════════════════════════════════════════════════════════════════
//  UTILITAIRES
// ══════════════════════════════════════════════════════════════════════
function esc(s) { return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(d) {
  if (!d) return '';
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function mondayOf(d) {
  const r = new Date(d); r.setHours(0,0,0,0);
  const dow = (r.getDay()+6)%7;
  r.setDate(r.getDate()-dow);
  return r;
}
function isoWeek(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}
