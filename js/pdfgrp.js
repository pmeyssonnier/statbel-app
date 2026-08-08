/*
 * js/pdfgrp.js — Parseur de listing GRP au format PDF (GRP_2026xxxxxxxxxxx.pdf)
 * → lignes { COLONNE: valeur } au format export GRP Statbel (30 colonnes).
 *
 * Utilisé par le Convertisseur (statbel_converter.html) et par l'outil autonome
 * PDF→XLSX/CSV (statbel_pdf2grp.html). Dépendance : pdf.js (global pdfjsLib),
 * chargé avant ce script.
 *
 * Le PDF n'expose PAS la date de naissance complète (DT_MB_BTH) ni la commune
 * de naissance (CD_MB_BTH_REFNIS) — seulement l'âge et le pays en toutes
 * lettres : ces deux colonnes restent vides.
 */
(function (global) {
'use strict';

var SEX = { 'Masculin': '1', 'Féminin': '2' };
var MRTL = { 'Célibataire': '1', 'Marié(e)': '2', 'Divorcé(e)': '3', 'Veuve/veuf': '4',
  'Divorcé(e), séparé(e) de fait': '5', 'Séparé(e) de corps et de biens': '6' };

// Codes nationalité NIS Statbel (nom FR officiel → code) — table complète.
var PAYS = {"Abu Dhabi":"269", "Afars et Issas (France)":"380", "Afghanistan":"251", "Afrique du Sud":"325", "Albanie":"101", "Algérie":"351", "Allemagne":"173", "Allemagne (République Démocratique)":"104", "Allemagne (République Fédérale)":"103", "Andorre":"102", "Angola":"341", "Angola (Portugal)":"381", "Anguilla (Royaume-Uni)":"490", "Antigua (Royaume-Uni)":"491", "Antigua-et-Barbuda":"403", "Antilles néerlandaises":"482", "Arabie saoudite":"252", "Argentine":"511", "Arménie":"249", "Australie":"611", "Autriche":"105", "Azerbaïdjan":"250", "Bahamas":"425", "Bahamas (Royaume-Uni)":"484", "Bahreïn":"268", "Bangladesh":"237", "Belgique":"150", "Belize":"430", "Bermudes (Royaume-Uni)":"485", "Bhoutan":"223", "Birmanie":"232", "Bolivie":"512", "Bophutatswana":"397", "Bosnie-Herzégovine":"149", "Botswana":"302", "Brunéi":"224", "Brésil":"513", "Bulgarie":"106", "Burkina Faso":"308", "Burundi":"303", "Bélarus":"142", "Bénin":"310", "Cabinda":"382", "Cambodge":"216", "Cameroun":"304", "Canada":"401", "Chili":"514", "Chine":"218", "Chine (Hong Kong SAR)":"230", "Chine (Macao SAR)":"231", "Chypre":"107", "Colombie":"515", "Comores":"343", "Comores (France)":"386", "Congo (République démocratique)":"306", "Congo (République populaire)":"307", "Congo (République)":"362", "Congo belge":"359", "Corée du Nord":"219", "Corée du Sud":"206", "Costa Rica":"411", "Croatie":"146", "Cuba":"412", "Côte d'Ivoire":"309", "Dahomey":"310", "Danemark":"108", "Djibouti":"345", "Dominica":"427", "Dominica (Royaume-Uni)":"480", "Egypte":"352", "El Salvador":"421", "Emirats arabes unis":"260", "Equateur":"516", "Erythrée":"349", "Espagne":"109", "Estonie":"136", "Eswatini":"366", "Fernando Poo":"392", "Fiji":"617", "Finlande":"110", "France":"111", "Gabon":"312", "Gambie":"313", "Ghana":"314", "Gibraltar (Royaume-Uni)":"180", "Grenade":"426", "Groenland (Danemark)":"498", "Grèce":"114", "Guadeloupe (France)":"496", "Guam (États-Unis)":"681", "Guatemala":"413", "Guinée":"315", "Guinée portugaise (Portugal)":"391", "Guinée équatoriale":"337", "Guinée-Bissau":"338", "Guyana":"521", "Guyane (France)":"581", "Guyane néerlandaise":"583", "Géorgie":"253", "Haute-Volta":"316", "Haïti":"419", "Honduras":"414", "Hong Kong (Royaume-Uni)":"280", "Hongrie":"115", "Iles Canaries (Espagne)":"398", "Inde":"207", "Indonésie":"208", "Irak":"254", "Iran":"233", "Irlande":"116", "Islande":"117", "Israël":"256", "Italie":"128", "Jamaïque":"415", "Japon":"209", "Jordanie":"257", "Jérusalem":"272", "Kampuchea":"211", "Kazakhstan":"225", "Kenya":"336", "Kirghizstan":"226", "Kiribati":"607", "Kosovo":"153", "Koweït":"264", "La Barbade":"423", "La Réunion (France)":"387", "Laos":"210", "Lesotho":"301", "Lettonie":"135", "Liban":"258", "Libye":"353", "Libéria":"318", "Liechtenstein":"118", "Lituanie":"137", "Luxembourg":"113", "Macao (Portugal)":"281", "Macédoine (ex-République yougoslave)":"148", "Macédoine du Nord":"154", "Madagascar":"324", "Madère (Portugal)":"399", "Malaisie":"212", "Malawi":"358", "Maldives":"222", "Mali":"319", "Malte":"119", "Maroc":"354", "Martinique (France)":"497", "Maurice":"317", "Mauritanie":"355", "Mexique":"416", "Micronésie":"602", "Moldavie":"144", "Monaco":"120", "Mongolie":"221", "Montserrat (Royaume-Uni)":"493", "Monténégro":"151", "Mozambique":"340", "Mozambique (Portugal)":"383", "Myanmar":"201", "Namibie":"384", "Nauru":"615", "Nicaragua":"417", "Niger":"321", "Nigéria":"322", "Niué":"604", "Niué (Nouvelle-Zélande)":"685", "Norvège":"121", "Nouvelle-Calédonie (France)":"683", "Nouvelle-Zélande":"613", "Nouvelles-Hébrides":"618", "Népal":"213", "Oman":"266", "Ouganda":"323", "Ouzbékistan":"227", "Pakistan":"259", "Palestine":"271", "Panama":"418", "Papouasie Nouvelle Guinée":"619", "Pays-Bas":"129", "Philippines":"214", "Pitcairn (Royaume-Uni)":"692", "Pologne":"122", "Polynésie française (France)":"684", "Porto-Rico (États-Unis)":"487", "Portugal":"123", "Pérou":"518", "Qatar":"267", "Rhodésie":"326", "Roumanie":"124", "Royaume-Uni":"112", "Ruanda-Urundi":"361", "Russie":"145", "Rwanda":"327", "République Dominicaine":"420", "République Khmère":"202", "République Tchèque":"140", "République centrafricaine":"305", "Sahara occidental":"388", "Saint-Barthélemy (France)":"499", "Saint-Christophe-et-Nièves":"431", "Saint-Kitts-et-Nevis (Royaume-Uni)":"494", "Saint-Marin":"125", "Saint-Pierre-et-Miquelon (France)":"495", "Saint-Vincent-et-les-Grenadines":"429", "Sainte-Hélène (Royaume-Uni)":"389", "Sainte-Lucie":"428", "Samoa":"606", "Samoa américaines (Etats-Unis)":"690", "Samoa occidentales":"614", "Sao Tomé et Principe (Portugal)":"393", "Senégambie":"348", "Serbie":"152", "Serbie-et-Monténégro":"132", "Seychelles":"342", "Seychelles (Royaume-Uni)":"390", "Sierra Leone":"328", "Singapour":"205", "Slovaquie":"141", "Slovénie":"147", "Somalie":"329", "Soudan":"356", "Soudan du Sud":"365", "Sri Lanka":"203", "Suisse":"127", "Suriname":"522", "Suède":"126", "Swaziland":"347", "Swaziland (Protectorat Britannique)":"395", "Syrie":"261", "São Tomé et Príncipe":"346", "Sénégal":"320", "Tadjikistan":"228", "Taiwan":"204", "Tanzanie":"332", "Tchad":"333", "Tchécoslovaquie":"130", "Territoire palestinien":"273", "Thaïlande":"235", "Timor (Portugal)":"282", "Timor-Oriental":"215", "Togo":"334", "Tokelau (Nouvelle-Zélande)":"686", "Tonga":"616", "Transkei":"396", "Trinité-et-Tobago":"422", "Tunisie":"357", "Turkménistan":"229", "Turquie":"262", "Tuvalu":"621", "Ukraine":"143", "Union des Républiques Socialistes Soviétiques":"172", "Uruguay":"519", "Vanuatu":"624", "Vatican":"133", "Venezuela":"520", "Vietnam":"220", "Vietnam (République démocratique)":"236", "Vietnam (République)":"279", "Wallis et Futuna (France)":"689", "Yougoslavie":"169", "Yémen":"270", "Yémen (République arabe)":"263", "Yémen (République populaire démocratique)":"265", "Zambie":"335", "Zaïre":"364", "Zimbabwe":"344", "États-Unis d'Amérique":"402", "Éthiopie":"311", "Îles Caïmanes (Royaume-Uni)":"492", "Îles Cook":"605", "Îles Cook (Nouvelle-Zélande)":"687", "Îles Gilbert":"622", "Îles Malouines (Royaume-Uni)":"580", "Îles Marshall":"603", "Îles Solomon":"623", "Îles Turques-et-Caïques (Royaume-Uni)":"488", "Îles Vierges américaines (États-Unis)":"478", "Îles Vierges britanniques (Royaume-Uni)":"479", "Îles du Cap Vert":"339", "Îles du Cap Vert (Portugal)":"385", "Îles du Pacifique":"620"};
// Recherche tolérante : le PDF orthographie parfois autrement (parenthèses
// ajoutées/abrégées, apostrophes typographiques). Ordre : exact normalisé →
// alias → sans parenthèses (si non ambigu). Inconnu → '' (signalé).
function norm(s){ return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’‘`´]/g,"'").replace(/\s+/g,' ').trim(); }
function base(s){ return norm(s.replace(/\([^)]*\)/g,'')); }
var PAYS_NORM = {}, PAYS_BASE = {}, baseCount = {};
Object.keys(PAYS).forEach(function(n){ PAYS_NORM[norm(n)] = PAYS[n]; var b = base(n); baseCount[b] = (baseCount[b]||0)+1; });
Object.keys(PAYS).forEach(function(n){ var b = base(n); if (baseCount[b] === 1) PAYS_BASE[b] = PAYS[n]; });
var PAYS_ALIAS = { 'allemagne (rep.fed.)': '103', 'allemagne (rep.dem.)': '104' };
function paysCode(txt){
  if (!txt) return '';
  var n = norm(txt);
  if (PAYS_NORM[n]) return PAYS_NORM[n];
  if (PAYS_ALIAS[n]) return PAYS_ALIAS[n];
  return PAYS_BASE[base(txt)] || '';
}

var HH_LABELS = ['NR_DBENQ_HH','Contact name','Size','HH N','Address','Wave','User ID','Phone','CATI / CAWI','Password','EMail','Language'];
var MB_COLS = ['Nr_MB','First name','Last name','Age','Sex','Country birth','Nationality','Marital status'];
var GRP_COLS = ['NR_GRP','NR_HH','NR_DBENQ_MB','NR_YEAR','NR_SEQ','NR_WAVE','NR_REF_WK','TX_WEB_USER_ID',
  'TX_WEB_USER_PSWRD','CD_CNTCT_LG','FL_MB_CNTCT','TX_MB_NM_FST','TX_MB_NM_LST','CD_MB_SEX','DT_MB_BTH',
  'MS_MB_AGE','CD_MB_BTH_REFNIS','CD_MB_NLTY','CD_MB_MRTL_STS','TX_ADRS_USTR_NM','CD_ADRS_HS','CD_ADRS_BX',
  'CD_ADRS_ZIP','TX_ADRS_REFNIS_NM','TX_DBENQ_GRP','TX_DBENQ_HH','NR_PHONE','TX_EMAIL','CD_WSH_CLCT_MTHD',
  'TX_GRP_LISTING_XLS'];
var pad = function(n,w){ return String(n).padStart(w,'0'); };

// « Rue X, 12, ETSS 1030 Schaerbeek » → [rue, n°, boîte, CP, commune].
function parseAddr(a){
  var parts = a.split(',').map(function(s){ return s.trim(); });
  var street = parts[0] || '';
  var tail = parts.slice(1).join(' , ');
  var m = tail.match(/^(\d+[A-Za-z]?)\s*,?\s*(?:([A-Za-z0-9]+)\s+)?(\d{4})\s+(.+)$/);
  if (!m) return [street, tail, '', '', ''];
  return [street, m[1], m[2] || '', m[3], m[4]];
}

// PDF (ArrayBuffer) → lignes visuelles (items groupés par Y, triés par X).
function extractRows(data){
  if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js indisponible');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc)
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  return pdfjsLib.getDocument({ data: data }).promise.then(function(pdf){
    var rows = [], chain = Promise.resolve();
    for (var n = 1; n <= pdf.numPages; n++) (function(n){
      chain = chain.then(function(){ return pdf.getPage(n); }).then(function(pg){ return pg.getTextContent(); })
        .then(function(tc){
          var byY = {};
          tc.items.forEach(function(it){ var s = (it.str||'').trim(); if (!s) return;
            var y = Math.round(it.transform[5]); (byY[y] = byY[y] || []).push({ x: it.transform[4], s: s }); });
          Object.keys(byY).map(Number).sort(function(a,b){ return b-a; })
            .forEach(function(y){ rows.push(byY[y].sort(function(a,b){ return a.x-b.x; })); });
        });
    })(n);
    return chain.then(function(){ return rows; });
  });
}

// Lignes visuelles → lignes GRP + codes inconnus.
function grpRows(rows){
  var out = [], unknown = { nlty: [], mrtl: [] };
  var isLabel = function(s){ return HH_LABELS.indexOf(s) >= 0; };
  var i = 0;
  while (i < rows.length){
    var r = rows[i];
    if (r[0] && r[0].s.indexOf('Group Info') === 0) { i++; continue; }
    if (!(r[0] && r[0].s === 'Identification')) { i++; continue; }
    i++;
    var info = {};
    while (i < rows.length && !rows[i].some(function(t){ return t.s === 'Nr_MB'; }) && !(rows[i][0] && rows[i][0].s === 'Identification')){
      if (rows[i][0] && rows[i][0].s.indexOf('Group Info') === 0) { i++; continue; }
      var cur = null;
      rows[i].forEach(function(t){ if (isLabel(t.s)) { cur = t.s; if (!(cur in info)) info[cur] = ''; }
        else if (cur) { info[cur] = info[cur] ? info[cur] + ' ' + t.s : t.s; } });
      i++;
    }
    var anchors = null;
    if (i < rows.length && rows[i].some(function(t){ return t.s === 'Nr_MB'; })){
      anchors = MB_COLS.map(function(c){ var it = rows[i].find(function(t){ return t.s === c; }); return it ? it.x : null; });
      i++;
    }
    var size = parseInt(info['Size'] || '0', 10) || 0;
    var members = [], cnt = 0;
    while (cnt < size && i < rows.length && anchors){
      var items = rows[i];
      if (items[0] && (items[0].s === 'Identification' || items[0].s.indexOf('Group Info') === 0 || items.some(function(t){ return t.s === 'Nr_MB'; }))) break;
      var cells = new Array(MB_COLS.length).fill('');
      items.forEach(function(t){ var best = 0, bd = 1e9;
        anchors.forEach(function(ax, ci){ if (ax == null) return; var d = Math.abs(ax - t.x); if (d < bd) { bd = d; best = ci; } });
        cells[best] = cells[best] ? cells[best] + ' ' + t.s : t.s; });
      if (!/^\d{1,2}$/.test(cells[0])) break;
      members.push(cells); cnt++; i++;
    }
    var grp = (info['NR_DBENQ_HH'] || '').replace(/-\d+$/, '');
    var nrgrp = grp.replace(/-/g, '');
    var hn = parseInt(info['HH N'] || '0', 10);
    var ad = parseAddr(info['Address'] || '');
    members.forEach(function(m, mi){
      var mb = mi + 1;
      if (m[6] && !paysCode(m[6]) && unknown.nlty.indexOf(m[6]) < 0) unknown.nlty.push(m[6]);
      if (m[7] && !MRTL[m[7]] && unknown.mrtl.indexOf(m[7]) < 0) unknown.mrtl.push(m[7]);
      out.push({
        NR_GRP: nrgrp, NR_HH: String(hn), NR_DBENQ_MB: '' + nrgrp + pad(hn,3) + pad(mb,4),
        NR_YEAR: grp.slice(0,4), NR_SEQ: '2', NR_WAVE: info['Wave'] || '', NR_REF_WK: '23',
        TX_WEB_USER_ID: info['User ID'] || '', TX_WEB_USER_PSWRD: info['Password'] || '', CD_CNTCT_LG: info['Language'] || '',
        FL_MB_CNTCT: mb === 1 ? '1' : '0', TX_MB_NM_FST: m[1] || '', TX_MB_NM_LST: m[2] || '',
        CD_MB_SEX: SEX[m[4]] || '', DT_MB_BTH: '', MS_MB_AGE: m[3] || '', CD_MB_BTH_REFNIS: '',
        CD_MB_NLTY: paysCode(m[6]), CD_MB_MRTL_STS: m[7] ? (MRTL[m[7]] || '') : '',
        TX_ADRS_USTR_NM: ad[0], CD_ADRS_HS: ad[1], CD_ADRS_BX: ad[2], CD_ADRS_ZIP: ad[3], TX_ADRS_REFNIS_NM: ad[4],
        TX_DBENQ_GRP: grp, TX_DBENQ_HH: info['NR_DBENQ_HH'] || '',
        NR_PHONE: info['Phone'] || '', TX_EMAIL: info['EMail'] || '', CD_WSH_CLCT_MTHD: info['CATI / CAWI'] || '',
        TX_GRP_LISTING_XLS: ''
      });
    });
  }
  return { rows: out, unknown: unknown };
}

// API publique.
// pdfGrpParse(arrayBuffer) → Promise<{ rows, unknown }>
function pdfGrpParse(data){ return extractRows(data).then(function(r){ return grpRows(r); }); }
// pdfGrpVersRows(arrayBuffer) → Promise<rows>  (+ alerte sur codes inconnus) — utilisé par le Convertisseur.
function pdfGrpVersRows(data){
  return pdfGrpParse(data).then(function(res){
    var inc = res.unknown.nlty.concat(res.unknown.mrtl);
    if (inc.length) alert('Valeurs sans code (laissées vides) : ' + inc.join(', ')
      + '\nComplétez la table dans js/pdfgrp.js.');
    return res.rows;
  });
}
// pdfGrpToAoa(rows) → tableau de tableaux (en-tête + lignes) pour export XLSX/CSV.
function pdfGrpToAoa(rows){
  var aoa = [GRP_COLS.slice()];
  rows.forEach(function(r){ aoa.push(GRP_COLS.map(function(c){ return r[c] == null ? '' : r[c]; })); });
  return aoa;
}

global.pdfGrpParse = pdfGrpParse;
global.pdfGrpVersRows = pdfGrpVersRows;
global.pdfGrpToAoa = pdfGrpToAoa;
global.PDF_GRP_COLS = GRP_COLS;
})(window);
