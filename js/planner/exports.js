/*
 * js/planner/exports.js — Planner : exports de l'agenda — Excel (.xls via SheetJS),
 * iCal/Google Agenda (.ics RFC 5545), detection de chevauchements, et CSV compatible
 * l'app Interviews. Extrait verbatim du <script> du Planner. Script CLASSIQUE : lit les
 * globales du coeur (selection, allRows, t, esc, XLSX...) ; fonctions appelees via onclick=.
 */
// ══════════════════════════════════════════════════════════════════════
//  EXPORT EXCEL (XLS)
// ══════════════════════════════════════════════════════════════════════
function exportXls() {
  const rows = selectedRows();
  if (!rows.length) { alert(t('js_no_group_alert')); return; }

  const items = [];
  rows.forEach(r => r.vagues.forEach(v => {
    const days = v.start && v.stop ? Math.round((v.stop - v.start) / 86400000) + 1 : '';
    items.push({
      'N° Groupe':  r.numero,
      'Province':   r.province,
      'Commune':    r.commune.split('/')[0].trim(),
      'Quartier':   r.quartier,
      'Vague':      'V' + v.idx,
      'Sem. réf.':  'S' + v.sem,
      'Date début': v.start ? fmtDate(v.start) : '',
      'Date fin':   v.stop  ? fmtDate(v.stop)  : '',
      'Durée (j)':  days,
    });
  }));
  items.sort((a, b) => {
    const da = parseFrDate(a['Date début']), db = parseFrDate(b['Date début']);
    return da - db;
  });

  const ws = XLSX.utils.json_to_sheet(items);
  // Largeurs colonnes
  ws['!cols'] = [10,10,22,25,7,8,13,13,10].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planning LFS');
  const fname = 'Planning_LFS_' + new Date().toISOString().slice(0,10) + '.xlsx';
  XLSX.writeFile(wb, fname);
}

function parseFrDate(s) {
  if (!s) return 0;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(+m[3], +m[2]-1, +m[1]).getTime() : 0;
}

// ══════════════════════════════════════════════════════════════════════
//  EXPORT iCAL / GOOGLE AGENDA
// ══════════════════════════════════════════════════════════════════════
function exportIcs() {
  const rows = selectedRows();
  if (!rows.length) { alert(t('js_no_group_alert')); return; }

  const dtstamp = icsStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LFS Planner//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEsc(t('ics_calname')),
    'X-WR-TIMEZONE:Europe/Brussels',
  ];

  const VAGUE_COLORS_ICS = ['1a237e','0e7c4a','7b22cc','cc4400'];

  rows.forEach(row => {
    row.vagues.forEach(v => {
      if (!v.start || !v.stop) return;
      const uid = `lfs-${row.numero}-v${v.idx}@lfsplanner`;
      const dtstart = icsDate(v.start);
      // DTEND = lendemain du stop (convention iCal : exclusif)
      const dtend   = icsDate(new Date(v.stop.getFullYear(), v.stop.getMonth(), v.stop.getDate() + 1));
      const summary = icsEsc(`LFS ${row.numero} — V${v.idx} (S${v.sem}) ${row.quartier}`);
      const desc    = icsEsc(
        `${t('ics_lbl_group')}: ${row.numero}\n${t('f_commune')}: ${communeLabel(row.commune)}\n` +
        `${t('ics_lbl_quartier')}: ${row.quartier}\n${t('ics_lbl_wave')}: ${v.idx}\n${t('ics_lbl_weekref')}: S${v.sem}`);

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        icsFold(`SUMMARY:${summary}`),
        icsFold(`DESCRIPTION:${desc}`),
        `COLOR:${VAGUE_COLORS_ICS[v.idx-1]}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      );
    });
  });

  lines.push('END:VCALENDAR');
  const ics = lines.join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'Planning_LFS_' + new Date().toISOString().slice(0,10) + '.ics';
  a.click();
  URL.revokeObjectURL(url);
  setTimeout(() => alert(t('js_ics_downloaded')), 300);
}

function icsDate(d) {
  // YYYYMMDD
  return d.getFullYear()
    + String(d.getMonth()+1).padStart(2,'0')
    + String(d.getDate()).padStart(2,'0');
}
// Horodatage UTC pour DTSTAMP (obligatoire RFC 5545) : YYYYMMDDTHHMMSSZ
function icsStamp(d) {
  const p = n => String(n).padStart(2,'0');
  return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())
    +'T'+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())+'Z';
}
// Échappement RFC 5545 des valeurs texte (backslash, ; , et sauts de ligne)
function icsEsc(s) {
  return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
}
// Pliage des lignes > 75 octets (les lignes de continuation débutent par une espace)
function icsFold(line) {
  if (line.length <= 74) return line;
  const parts = []; let s = line;
  while (s.length > 74) { parts.push(s.slice(0,74)); s = ' ' + s.slice(74); }
  parts.push(s);
  return parts.join('\r\n');
}
// ══════════════════════════════════════════════════════════════════════
//  DÉTECTION DE CHEVAUCHEMENTS
// ══════════════════════════════════════════════════════════════════════
function getChevauchements() {
  const periodes = [];
  selectedRows().forEach(r => r.vagues.forEach(v => {
    if (v.start && v.stop) periodes.push({ grp:r.numero, qtier:r.quartier, v, start:v.start, stop:v.stop });
  }));
  const conflits = [];
  for (let i = 0; i < periodes.length; i++) {
    for (let j = i+1; j < periodes.length; j++) {
      const a = periodes[i], b = periodes[j];
      if (a.grp === b.grp) continue;
      if (a.start <= b.stop && a.stop >= b.start) {
        const overStart = a.start > b.start ? a.start : b.start;
        const overStop  = a.stop  < b.stop  ? a.stop  : b.stop;
        const days = Math.round((overStop - overStart) / 86400000) + 1;
        conflits.push({ a, b, overStart, overStop, days });
      }
    }
  }
  const seen = new Set();
  return conflits.filter(c => {
    const k = [c.a.grp, c.b.grp, c.overStart.getTime()].sort().join('-');
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

function exportChevauchements() {
  const uniq = getChevauchements();
  if (!uniq.length) { afficherToast(t('js_no_overlap')); return; }
  const HDRS = ['Groupe A','Vague A','Groupe B','Vague B','Début chevauch.','Fin chevauch.','Durée (j)'];
  const rows = uniq.map(({a,b,overStart,overStop,days}) => ({
    'Groupe A': a.grp, 'Vague A': 'V'+a.v.idx,
    'Groupe B': b.grp, 'Vague B': 'V'+b.v.idx,
    'Début chevauch.': fmtDate(overStart),
    'Fin chevauch.':   fmtDate(overStop),
    'Durée (j)': days,
  }));
  const e2 = v => { const s=String(v??''); return s.includes(',')?'"'+s+'"':s; };
  const bom = '\uFEFF';
  const csv = bom + [HDRS.join(','), ...rows.map(r=>HDRS.map(h=>e2(r[h]??'')).join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='LFS_chevauchements_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  URL.revokeObjectURL(url);
  afficherToast(tf('js_overlaps_exported',{n:uniq.length}));
}

// ══════════════════════════════════════════════════════════════════════
//  EXPORT CSV COMPATIBLE enquetes_statbel.html
// ══════════════════════════════════════════════════════════════════════
function exportCsvApp() {
  const rows = selectedRows();
  if (!rows.length) { alert(t('js_no_group_alert')); return; }
  const vagueChoice = prompt('Quelle vague exporter ?\n1 = Vague 1\n2 = Vague 2\n3 = Vague 3\n4 = Vague 4\nVide = toutes','');
  if (vagueChoice === null) return;
  const vagueIdx = vagueChoice.trim() ? parseInt(vagueChoice) : null;
  const HDRS = ['ordre','prenom','nom','adresse','statut','date_interview','rdv',
                'sexe','birth_date','age','birth_country','nationality','marital_status',
                'taille_menage','gsm','email','notes','NR_GRP','NR_WAVE','NR_SEM','start','stop'];
  const csvRows = []; let ordre = 1;
  rows.forEach(row => {
    const commune = (row.commune || '').split('/')[0].trim();
    // Squelette importable : l'app enquête rejette les lignes sans nom NI adresse.
    // On renseigne donc un nom (« Groupe … ») et une adresse (commune — quartier) ;
    // l'enquêteur complétera les contacts réels ensuite.
    (vagueIdx ? row.vagues.filter(v=>v.idx===vagueIdx) : row.vagues).forEach(v => {
      csvRows.push({
        ordre: String(ordre++).padStart(3,'0'),
        prenom:'',
        nom:`Groupe ${row.numero}`,
        adresse: commune + (row.quartier ? ' — ' + row.quartier : ''),
        statut:'À faire', date_interview:'', rdv:'', sexe:'', birth_date:'', age:'',
        birth_country:'', nationality:'', marital_status:'', taille_menage:'',
        gsm:'', email:'',
        notes:`Groupe ${row.numero} — ${row.quartier} — V${v.idx} S${v.sem}` +
              (v.start&&v.stop?` (${fmtDate(v.start)}→${fmtDate(v.stop)})`:''),
        NR_GRP:row.numero, NR_WAVE:v.idx, NR_SEM:v.sem,
        start:v.start?fmtDate(v.start):'', stop:v.stop?fmtDate(v.stop):'',
      });
    });
  });
  const e2 = v => { const s=String(v??''); return (s.includes(',')||s.includes('"'))?'"'+s.replace(/"/g,'""')+'"':s; };
  const csv = '\uFEFF' + [HDRS.join(','), ...csvRows.map(r=>HDRS.map(h=>e2(r[h]??'')).join(','))].join('\n');
  const fname = `LFS_${rows.length===1?rows[0].numero:rows.length+'grp'}${vagueIdx?'_V'+vagueIdx:''}_${new Date().toISOString().slice(0,10)}.csv`;
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=fname; a.click();
  URL.revokeObjectURL(url);
}
