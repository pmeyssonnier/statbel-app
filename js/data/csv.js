/*
 * js/data/csv.js — Import/export CSV : tokenisation, mappage des colonnes
 * (CHAMPS_IMPORT), parsing en lignes de contacts et génération du CSV
 * d'export (round-trip préservé). Extrait de js/app.js (modules ES).
 *
 * Dépendances : csvGuard/csvDeguard (util), coordsCache (idb) ; les fonctions
 * de canonicalisation (statutCanon, normaliserPays, maritalCanon) et
 * contacts()/statutDefaut() sont des globaux (pont de compatibilité).
 */
import { csvGuard, csvDeguard, toISODate, toFrDateTime } from '../core/util.js';
import { coordsCache } from './idb.js';
import { statutCanon, normaliserPays, maritalCanon } from './canon.js';



// Champs reconnus : clé interne, libellé affiché, alias acceptés dans l'en-tête.
export const CHAMPS_IMPORT = [
  ['ordre',          'Ordre',           ['ordre','order','nr','no']],
  ['prenom',         'Prénom',          ['prenom','firstname','first_name','prénom']],
  ['nom',            'Nom',             ['nom','lastname','last_name','name']],
  ['adresse',        'Adresse',         ['adresse','address','adr']],
  ['statut',         'Statut',          ['statut','status','etat']],
  ['date',           'Date interview',  ['date_interview','interview_date','date','date_fait']],
  ['notes',          'Notes',           ['notes','note','remarques']],
  ['rdv',            'Rendez-vous',     ['rdv','date_rdv','rendez_vous','appointment']],
  ['sexe',           'Sexe',            ['sexe','sex','genre','gender']],
  ['birth_date',     'Date naissance',  ['birth_date','date_naissance','dob']],
  ['age',            'Âge',             ['age']],
  ['birth_country',  'Pays naissance',  ['birth_country','pays_naissance','country_birth']],
  ['nationality',    'Nationalité',     ['nationality','nationalite','nationalité']],
  ['marital_status', 'État civil',      ['marital_status','etat_civil','état_civil']],
  ['taille_menage',  'Taille ménage',   ['taille_menage','taille_ménage','household_size','taille','menage','ménage']],
  ['nb_cibles',      'Cibles ≥15',      ['nb_cibles','members_15plus','targets_15','cibles_15','nb_15']],
  ['gsm',            'Téléphone',       ['gsm','tel','telephone','phone','gsm_tel','mobile_number']],
  ['email',          'Email',           ['email','mail','e_mail']],
  ['history',        'Historique',      ['history','historique']],
  ['lat',            'Latitude',        ['lat','latitude']],
  ['lng',            'Longitude',       ['lng','lon','long','longitude']],
];

// Tokenise un CSV complet en lignes de cellules. Gère les champs entre
// guillemets contenant le séparateur, un saut de ligne, ou un guillemet
// échappé ("" → "). C'est ce qui garantit le round-trip des notes multilignes.
export function parseCSVRows(text, sep) {
  const rows = []; let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }   // "" → " (guillemet échappé)
        else inQ = false;
      } else cur += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === sep) {
      row.push(cur); cur = '';
    } else if (c === '\n') {
      row.push(cur); rows.push(row); row = []; cur = '';
    } else if (c === '\r') {
      if (text[i + 1] !== '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }  // \r isolé
    } else {
      cur += c;
    }
  }
  row.push(cur); rows.push(row);
  return rows;
}

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');             // BOM UTF-8 éventuel
  const nl = text.search(/\r?\n/);
  const firstLine = nl >= 0 ? text.slice(0, nl) : text;
  const sep = firstLine.includes(';') ? ';' : ',';
  const allRows = parseCSVRows(text, sep);
  // Ignore les lignes entièrement vides (dont un éventuel saut de ligne final)
  const nonEmpty = allRows.filter(r => r.some(c => c.trim() !== ''));
  if (nonEmpty.length < 2) return null;
  const headers = nonEmpty[0].map(h => h.toLowerCase().trim().replace(/\s+/g,'_').replace(/[^a-zàâäéèêëïîôöœûüçæ_0-9]/gi,''));

  // Associer chaque champ connu à une colonne ; mémoriser les colonnes utilisées
  const map = {}, used = new Set();
  CHAMPS_IMPORT.forEach(([key, , alias]) => {
    let i = -1;
    for (const n of alias) { const j = headers.indexOf(n); if (j >= 0) { i = j; break; } }
    map[key] = i;
    if (i >= 0) used.add(i);
  });
  if (map.prenom < 0 && map.nom < 0) return null;

  const reconnues = CHAMPS_IMPORT.filter(([k]) => map[k] >= 0).map(([k]) => k);
  const nonReconnues = headers
    .map((h, i) => ({ h, i }))
    .filter(x => x.h && !used.has(x.i))
    .map(x => x.h);

  const g = (cols, i) => i >= 0 ? csvDeguard((cols[i]||'').trim()) : '';
  const bodyRows = nonEmpty.slice(1);
  const rows = [];
  const motifs = { sansIdentite: 0, adresseVide: 0, doublonOrdre: 0 };
  const rejets = [];              // détail des lignes ignorées : { ligne, ordre, motif }
  const ordresVus = new Set();
  const coordsAImporter = [];     // {adresse,lat,lng} valides → cache de géocodage
  bodyRows.forEach((cols, bi) => {
    const prenom = g(cols, map.prenom), nom = g(cols, map.nom);
    const adresse = g(cols, map.adresse);
    const ordreVal = g(cols, map.ordre);
    const rejet = motifKey => rejets.push({ ligne: bi + 2, ordre: ordreVal || '—', motif: motifKey });
    if (!prenom && !nom) { motifs.sansIdentite++; rejet('motif_no_identity'); return; }
    if (!adresse)        { motifs.adresseVide++;  rejet('motif_no_address'); return; }
    if (ordreVal && ordresVus.has(ordreVal)) { motifs.doublonOrdre++; rejet('motif_dup_order'); return; }
    if (ordreVal) ordresVus.add(ordreVal);
    // Coordonnées lat/lng éventuelles → cache (évite un re-géocodage sur un autre appareil)
    if (map.lat >= 0 && map.lng >= 0) {
      const la = parseFloat(g(cols, map.lat).replace(',', '.'));
      const ln = parseFloat(g(cols, map.lng).replace(',', '.'));
      if (isFinite(la) && isFinite(ln) && la >= 49.5 && la <= 51.5 && ln >= 2.5 && ln <= 6.5)
        coordsAImporter.push({ adresse, lat: la, lng: ln });
    }
    // Historique « statut@date@heure@rdv » → {statut,date,heure?,rdv?} (rétro-compatible « statut@date »)
    const histArr = g(cols, map.history).split('|').map(p => p.trim()).filter(Boolean).map(p => {
      const seg = p.split('@');
      const e = { statut: statutCanon((seg[0] || '').trim()), date: toFrDateTime((seg[1] || '').trim()) };
      const heure = (seg[2] || '').trim();
      const rdv   = toFrDateTime((seg[3] || '').trim());
      if (heure) e.heure = heure;
      if (rdv)   e.rdv = rdv;
      return e;
    });
    // Dates : re-normalisées à l'import. Un aller-retour par Excel réécrit
    // silencieusement l'ISO en format local (JJ/MM/AAAA) ; on ré-canonicalise
    // birth_date en ISO (contrôle de cohérence + calcul d'âge) et date/rdv en
    // « JJ/MM/AAAA[ HH:mm] » (format interne d'affichage).
    const bdRaw = g(cols, map.birth_date);
    const bdIso = toISODate(bdRaw);
    rows.push({
      ordre:          ordreVal,   // vide si absent : ne PAS inventer un numéro (collision + faux appariement) — l'appariement se fait alors par nom/naissance/adresse
      prenom, nom, adresse,
      statut:         statutCanon(g(cols,map.statut)) || 'To do',
      date:           toFrDateTime(g(cols,map.date)),
      notes:          g(cols,map.notes),
      rdv:            toFrDateTime(g(cols,map.rdv)),
      sexe:           g(cols,map.sexe)   || null,
      birth_date:     (bdIso || bdRaw) || null,
      age:            map.age>=0 ? parseInt(cols[map.age])||null : null,
      birth_country:  normaliserPays(g(cols,map.birth_country)) || null,
      nationality:    normaliserPays(g(cols,map.nationality))  || null,
      marital_status: maritalCanon(g(cols,map.marital_status)) || null,
      taille_menage:  map.taille_menage>=0 ? (parseInt(cols[map.taille_menage])||null) : null,
      nb_cibles:      map.nb_cibles>=0 ? (parseInt(cols[map.nb_cibles])||null) : null,
      gsm:            g(cols,map.gsm),
      email:          g(cols,map.email),
      ...(histArr.length ? { historique: histArr } : {}),
    });
  });
  // Les coordonnées ne sont PAS écrites ici : elles ne le seront qu'à la
  // confirmation de l'import (sinon un simple aperçu puis Annuler modifierait
  // déjà le cache). On les retourne pour application dans confirmerImport().
  const rejetees = motifs.sansIdentite + motifs.adresseVide + motifs.doublonOrdre;
  return { rows, coords: coordsAImporter, stats: { lues: bodyRows.length, importees: rows.length, rejetees, motifs, rejets, reconnues, nonReconnues } };
}

export function splitLine(line, sep) {
  const result = []; let cur='', inQ=false;
  for (const c of line) {
    if (c==='"') inQ=!inQ;
    else if (c===sep && !inQ) { result.push(cur.trim()); cur=''; }
    else cur+=c;
  }
  result.push(cur.trim());
  return result;
}

export function csvCell(v) {
  const str = csvGuard((v||'').toString().trim());
  const escaped = str.replace(/"/g,'""');
  // Guillemets si la cellule contient un séparateur possible (, ou ;), un guillemet ou un saut de ligne
  return /[,;"\r\n]/.test(str) || escaped !== str ? '"'+escaped+'"' : escaped;
}

// Séparateur décimal de l'appareil → ',' (Europe) signifie qu'Excel attend ';' en CSV
export function sepRegionalAuto() {
  try { return (1.1).toLocaleString().includes(',') ? ';' : ','; } catch (e) { return ','; }
}

// Séparateur d'export effectif selon le réglage (auto = régional)
export function sepCSVexport() {
  const s = settings.csvSep || 'auto';
  return s === ';' ? ';' : s === ',' ? ',' : sepRegionalAuto();
}

export function genererCSV() {
  const rows = [['order','first_name','last_name','address','status','interview_date','appointment','sex','birth_date','age','birth_country','nationality','marital_status','household_size','members_15plus','phone','email','notes','history','lat','lng']];
  contacts().forEach(c => {
    const cc = coordsCache(c.adresse);
    // Historique sérialisé : « status@date | status@date » (statut canonique EN)
    // Historique sérialisé « statut@date@heure@rdv » (champs vides finaux omis)
    const hist = (c.historique || []).map(h => {
      const parts = [h.statut, h.date || ''];
      if (h.heure || h.rdv) parts.push(h.heure || '');
      if (h.rdv) parts.push(h.rdv);
      return parts.join('@');
    }).join(' | ');
    rows.push([
      csvCell(c.ordre||''), csvCell(c.prenom||''), csvCell(c.nom||''), csvCell(c.adresse||''),
      csvCell(c.statut||statutDefaut()), csvCell(c.date||''), csvCell(c.rdv||''), csvCell(c.sexe||''),
      csvCell(c.birth_date||''), csvCell(c.age||''), csvCell(c.birth_country||''), csvCell(c.nationality||''),
      csvCell(c.marital_status||''), csvCell(c.taille_menage||''), csvCell(c.nb_cibles||''), csvCell(c.gsm||''), csvCell(c.email||''), csvCell(c.notes||''),
      csvCell(hist), csvCell(cc?cc.lat:''), csvCell(cc?cc.lng:'')
    ]);
  });
  const sep = sepCSVexport();
  return '\ufeff' + rows.map(r => r.join(sep)).join('\n');
}
