/*
 * js/converter/import-normalisation.js — Convertisseur : IMPORT (lecture & decoupage des
 * fichiers : detection de separateur, CSV/TSV) et NORMALISATION (dates de naissance,
 * telephone belge -> e164, methode de collecte CATI/CAWI, refnisInfo() : arrondissement /
 * province / region / NUTS depuis un code REFNIS). Extrait verbatim du <script> du
 * Convertisseur. Script CLASSIQUE : globales partagees (refnisInfo lit ARROND/NUTS/GRP_PLANNING
 * definis plus loin, au runtime).
 */
// ════════════════════════════════════════════════════════════════════════
//  RÉGION — IMPORT · lecture & découpage des fichiers (séparateur, CSV/TSV)
// ════════════════════════════════════════════════════════════════════════
function detecterSep(ligne) {
  const t = (ligne.match(/\t/g)||[]).length;
  const s = (ligne.match(/;/g) ||[]).length;
  const c = (ligne.match(/,/g) ||[]).length;
  return t > s && t > c ? '\t' : s > c ? ';' : ',';
}

function parseCsv(text, sep) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0], sep).map(h => h.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line => {
    const vals = splitLine(line, sep);
    const row  = {};
    headers.forEach((h, i) => { row[h] = (vals[i]||'').replace(/^"|"$/g,'').trim(); });
    return row;
  });
}

function splitLine(line, sep) {
  const res = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === sep && !inQ) { res.push(cur); cur = ''; }
    else cur += c;
  }
  res.push(cur); return res;
}

// ════════════════════════════════════════════════════════════════════════
//  RÉGION — NORMALISATION · dates & adresses (formats bruts → canoniques)
// ════════════════════════════════════════════════════════════════════════
// Validité calendaire (jour existant pour le mois/année, années bissextiles).
// Local au Convertisseur (script classique) — équivalent de jourValide d'Interviews.
function jourValideConv(a, m, j) {
  if (!(m >= 1 && m <= 12) || j < 1) return false;
  const feb = (a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0)) ? 29 : 28;
  const dim = [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return j <= dim[m - 1];
}

// Date de naissance brute → ISO AAAA-MM-JJ (format attendu par le module Interviews).
// Tolérant (bug M3) : accepte le séparateur « - » OU « / », le format natif GRP
// JJ-MM-AAAA comme l'ISO AAAA-MM-JJ (qu'un aller-retour Excel peut avoir réécrit),
// et VALIDE la date (jour/mois impossibles → '') au lieu de produire un ISO absurde.
function convertirDate(dob) {
  if (!dob || dob.includes('#')) return '';
  const p = dob.trim().split(/[-/]/).map(s => s.trim());
  if (p.length !== 3 || p.some(x => x === '' || /\D/.test(x))) return '';
  let a, m, j;
  if (p[0].length === 4) {                 // AAAA-MM-JJ (ISO, p. ex. réécrit par Excel)
    [a, m, j] = p.map(Number);
  } else {                                 // JJ-MM-AAAA (format GRP natif)
    [j, m, a] = p.map(Number);
    if (p[2].length !== 4) {               // année sur 2 chiffres → pivot de siècle
      a = 2000 + a;                                   // 20xx par défaut
      if (a > new Date().getFullYear()) a -= 100;     // sauf si futur → 19xx
    }
  }
  if (!jourValideConv(a, m, j)) return '';
  return `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

// Décodage tolérant d'un CSV lu en binaire (ArrayBuffer) → texte. (bug M9)
// Le GRP Statbel historique est en ISO-8859-1, mais un CSV UTF-8 (ex. ré-import d'un
// export de l'app, souvent avec BOM) décodé en Latin-1 donne du mojibake (« Ã© »).
// On choisit donc : BOM UTF-8 → UTF-8 (BOM retiré) ; sinon octets UTF-8 valides →
// UTF-8 (décodage « fatal » qui lève si invalide) ; sinon repli ISO-8859-1.
function decoderCsv(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));       // BOM UTF-8 explicite
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);  // UTF-8 sans BOM mais valide
  } catch (e) {
    return new TextDecoder('iso-8859-1').decode(bytes);             // sinon Latin-1 (GRP historique)
  }
}

// ── Formats d'AFFICHAGE (les données exportées, elles, restent inchangées) ──
// Date de naissance ISO (AAAA-MM-JJ) → JJ/MM/AAAA. Repli : valeur telle quelle.
function fmtDateNaiss(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
}
// Téléphone → { e164:'+…' (liens tel:/sms:), disp }. Tolérant : chiffres seuls ;
// national « 0… » / « 32… » → Belgique (regroupement 3-2-2-2 mobile, 2-2-2-2 fixe).
// IMPORTANT : un numéro international EXPLICITE (« + » ou « 00 ») d'indicatif ≠ 32 est
// conservé tel quel — on ne « belgicise » pas un numéro étranger (sinon tel:/sms:
// appellent un mauvais numéro). Aligné sur telBE() d'Interviews (js/core/util.js).
function telBE(raw) {
  const s = String(raw || '').trim();
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (/^(?:\+|00)/.test(s)) {                 // notation internationale explicite
    if (d.startsWith('00')) d = d.slice(2);
    if (!d.startsWith('32')) { const e164 = '+' + d; return { e164, disp: e164 }; }  // étranger : tel quel
    d = d.slice(2);                            // +32 / 0032 → national belge
  } else if (d.startsWith('32')) {
    d = d.slice(2);
  } else if (d.startsWith('0')) {
    d = d.slice(1);
  }
  if (!d) return null;
  const e164 = '+32' + d;
  let disp;
  if (d.length === 9)      disp = `+32 ${d.slice(0,3)} ${d.slice(3,5)} ${d.slice(5,7)} ${d.slice(7,9)}`;
  else if (d.length === 8) disp = `+32 ${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,6)} ${d.slice(6,8)}`;
  else                     disp = '+32 ' + d;
  return { e164, disp };
}

// Préférence de méthode de collecte (CD_WSH_CLCT_MTHD) → libellé lisible + couleurs.
// Tolérant : reconnaît CATI/CAWI et les formes texte (téléphone/internet/web…).
// Valeur inconnue → null (on affiche alors la valeur brute telle quelle).
function collecteInfo(v) {
  const u = String(v == null ? '' : v).trim().toUpperCase();
  if (!u) return null;
  if (/CATI|T[ÉE]L|PHONE|TELEPH/.test(u))                 return { key: 'collect_cati', bg: '#e3f2fd', fg: '#1565c0' };
  if (/CAWI|WEB|INTERNET|ONLINE|EN\s?LIGNE/.test(u))       return { key: 'collect_cawi', bg: '#e8f5e9', fg: '#2e7d32' };
  return null;
}

function composerAdresse(r) {
  const rue   = (r['TX_ADRS_USTR_NM']||'').trim();
  const hs    = (r['CD_ADRS_HS']||'').trim();
  const bx    = (r['CD_ADRS_BX']||'').trim();
  const cp    = (r['CD_ADRS_ZIP']||'').trim();
  const ville = (r['TX_ADRS_REFNIS_NM']||'').trim();
  let adrs = rue + (hs ? ' '+hs : '');
  if (bx) {
    const bl = bx.toLowerCase();
    if (bl.startsWith('b') && /^\d+$/.test(bl.slice(1)))
      adrs += ' bte ' + parseInt(bx.slice(1));   // boîte numérotée : b011 → bte 11
    else
      adrs += ' ' + bx;                          // étage / autre : ET02, ETRC, 5…
  }
  if (cp && ville) adrs += ', '+cp+' '+ville;
  else if (cp) adrs += ', '+cp;
  return adrs.trim();
}

// Déduit arrondissement + province + région + NUTS2/NUTS3 d'un code REFNIS/NIS belge (5 chiffres).
// 2 premiers chiffres = arrondissement ; 1er chiffre = province ; pour le « 2 »
// (ex-Brabant) on distingue via les 2 premiers : 21 = Bruxelles, 23/24 = Brabant flamand, 25 = Brabant wallon.
function refnisInfo(refnis) {
  const vide = { district: '', province: '', region: '', nuts2: '', nuts3: '' };
  if (!/^\d{5}$/.test(refnis)) return vide;
  const d = refnis[0], pp = refnis.slice(0, 2);
  const district = ARROND[pp] || '';
  let province = '', region = '';
  switch (d) {
    case '1': province = 'Antwerp';        region = 'Flanders';  break;
    case '2':
      if (pp === '21') { province = 'Brussels-Capital'; region = 'Brussels'; }
      else if (pp === '25') { province = 'Walloon Brabant'; region = 'Wallonia'; }
      else { province = 'Flemish Brabant'; region = 'Flanders'; }   // 23, 24
      break;
    case '3': province = 'West Flanders'; region = 'Flanders';  break;
    case '4': province = 'East Flanders'; region = 'Flanders';  break;
    case '5': province = 'Hainaut';       region = 'Wallonia';  break;
    case '6': province = 'Liège';         region = 'Wallonia';  break;
    case '7': province = 'Limburg';       region = 'Flanders';  break;
    case '8': province = 'Luxembourg';    region = 'Wallonia';  break;
    case '9': province = 'Namur';         region = 'Wallonia';  break;
    default:  return vide;
  }
  const nuts2 = NUTS2_PROV[province] || '';
  const nuts3 = DE_COMMUNITY.has(refnis) ? 'BE336' : (ARR_NUTS3[pp] || '');
  return { district, province, region, nuts2, nuts3 };
}

function decoder(refnisRaw, nltyRaw, mrtlRaw) {
  const refnis = (refnisRaw||'').trim();
  const nlty   = (nltyRaw||'').trim();
  const mrtl   = (mrtlRaw||'').trim();
  // REFNIS à 5 chiffres = commune belge → né en Belgique ; sinon code pays étranger
  const estCommuneBE = refnis.length === 5 && /^\d{5}$/.test(refnis);
  const birthCountry = refnis
    ? (estCommuneBE ? 'BEL' : (NLTY_ISO[refnis] || ''))
    : (NLTY_ISO[nlty] || '');
  const info = estCommuneBE ? refnisInfo(refnis) : { district: '', province: '', region: '', nuts2: '', nuts3: '' };
  const com = REFNIS_COMMUNE[refnis] || null;
  return {
    birthCountry,
    birthCommune:   com ? com.fr : '',
    birthCommuneNl: com ? com.nl : '',
    birthDistrict: info.district,
    birthProvince: info.province,
    birthRegion:   info.region,
    birthNuts2:    info.nuts2,
    birthNuts3:    info.nuts3,
    nationality:   NLTY_ISO[nlty]||'',
    maritalStatus: MRTL_FR[mrtl]||'',
  };
}
