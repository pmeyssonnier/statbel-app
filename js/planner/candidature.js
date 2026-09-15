/*
 * js/planner/candidature.js — Planner : onglet Candidature enqueteur — generation du
 * formulaire officiel .docx (moteur ZIP/CRC32 maison), coordonnees memorisees, ordre de
 * priorite des groupes, signature dessinee, validation. Extrait verbatim du <script> du
 * Planner. Script CLASSIQUE : lit la globale CAND_DOCX (js/cand-docx.js) + les globales du
 * coeur (selection, t, esc...) et expose candLoadInfos() etc. appelees par l'initialisation.
 */
// ══════════════════════════════════════════════════════════════════════
//  RÉGION — CANDIDATURE ENQUÊTEUR · coordonnées, signature, génération .docx/ZIP
// ══════════════════════════════════════════════════════════════════════
/* ===== Candidature EFT : modèle officiel embarqué + moteur .docx ===== */
/* ===== Générateur de candidature .docx (hors-ligne, sans dépendance) =====
   Remplit le modèle officiel EFT (embarqué dans CAND_DOCX) et assemble un
   fichier .docx (ZIP, méthode STORE) directement dans le navigateur. */

/* --- CRC32 (pour l'en-tête ZIP) --- */
const CAND_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function candCrc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CAND_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* --- helpers binaires / base64 / UTF-8 --- */
function candB64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const CAND_ENC = new TextEncoder();   // UTF-8
const CAND_DEC = new TextDecoder('utf-8');
function candStrToBytes(s) { return CAND_ENC.encode(s); }
function candBytesToStr(b) { return CAND_DEC.decode(b); }

/* --- échappement XML pour le contenu texte --- */
function candXmlEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* --- constructeur ZIP minimal (STORE, pas de compression) --- */
function candBuildZip(files) {
  // files: [{name, bytes:Uint8Array}]
  const enc = CAND_ENC;
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = n => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
  const u32 = n => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
  const push = (arr, ...parts) => { for (const p of parts) arr.push(p); };

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = candCrc32(f.bytes);
    const size = f.bytes.length;
    // local file header
    const local = [];
    push(local, u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0),
      nameBytes, f.bytes);
    for (const p of local) chunks.push(p);
    // central directory record
    push(central, u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes);
    offset += local.reduce((a, p) => a + p.length, 0);
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const p of central) centralSize += p.length;
  const end = [];
  push(end, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralSize), u32(centralStart), u16(0));

  const all = [...chunks, ...central, ...end];
  let total = 0;
  for (const p of all) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

/* --- remplissage du modèle + génération du .docx ---
   data = {
     nom, prenom, adresse, cp, commune,
     telPrive, heuresPrive, telPort, heuresPort, telBur, heuresBur,
     emailPrive, emailBur, nbGroupes, date,
     groupes: [{numero, commune}, ...]
   }
   Retourne un Uint8Array (contenu .docx). */
/* data: URL (image/png) -> Uint8Array */
function candDataUrlToBytes(dataUrl) {
  return candB64ToBytes(String(dataUrl).split(',')[1] || '');
}
/* dimensions d'un PNG (chunk IHDR : largeur @16, hauteur @20, big-endian) */
function candPngSize(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}
/* XML d'une image inline pour la cellule Signature */
function candSignatureDrawing(cx, cy, relId) {
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  return '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
    + `<wp:extent cx="${cx}" cy="${cy}"/>`
    + '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
    + '<wp:docPr id="1001" name="Signature"/>'
    + `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${A}" noChangeAspect="1"/></wp:cNvGraphicFramePr>`
    + `<a:graphic xmlns:a="${A}"><a:graphicData uri="${PIC}">`
    + `<pic:pic xmlns:pic="${PIC}"><pic:nvPicPr><pic:cNvPr id="1001" name="Signature"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
    + '</a:graphicData></a:graphic></wp:inline></w:drawing>';
}

/* Case à cocher Wingdings : F0A8 (vide) → F0FE (cochée) pour l'option retenue.
   Les 3 cases du formulaire sont des symboles identiques ; on cible celle qui
   précède immédiatement le libellé d'ancrage (aucune autre case entre les deux),
   ce qui reste robuste à l'ordre des options. */
const CAND_CHOIX_ANCRE = { groupes: 'Nombre de groupes souhaités', pas: 'pas intéressé', plus: 'plus intéressé' };
function candCocherCase(doc, ancre) {
  const esc = String(ancre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<w:sym w:font="Wingdings" w:char="F0A8"/>(?=(?:(?!<w:sym).)*?' + esc + ')', 's');
  return doc.replace(re, '<w:sym w:font="Wingdings" w:char="F0FE"/>');
}

// Traductions des libellés FIXES du formulaire officiel .docx (gabarit de base en
// français). Les jetons @@…@@ (données) sont conservés et remplis ensuite. À
// appliquer APRÈS candCocherCase (qui s'ancre sur le texte français des options).
// NB : traductions de convivialité — le formulaire officiel Statbel en langue
// régionale peut différer ; à vérifier avant tout usage administratif.
const CAND_DOCX_I18N = {
  'CANDIDATURE ENQUETEUR ': { nl:'KANDIDATUUR ENQUÊTEUR ', en:'INTERVIEWER APPLICATION ', de:'BEWERBUNG ALS BEFRAGER ' },
  'Nom:': { nl:'Naam:', en:'Last name:', de:'Name:' },
  'Prénom:': { nl:'Voornaam:', en:'First name:', de:'Vorname:' },
  'Adresse:': { nl:'Adres:', en:'Address:', de:'Adresse:' },
  'Code postal:': { nl:'Postcode:', en:'Postal code:', de:'Postleitzahl:' },
  'Commune:': { nl:'Gemeente:', en:'Municipality:', de:'Gemeinde:' },
  'Téléphone': { nl:'Telefoon', en:'Phone', de:'Telefon' },
  'Précisez ci-dessous les heures limites d’appel': { nl:'Geef hieronder de uiterste beluren op', en:'Specify the call time limits below', de:'Geben Sie unten die Anrufzeitfenster an' },
  'privé:': { nl:'privé:', en:'private:', de:'privat:' },
  'portable:': { nl:'gsm:', en:'mobile:', de:'Mobil:' },
  'bureau:': { nl:'kantoor:', en:'office:', de:'Büro:' },
  'Adresse E-mail  privé': { nl:'E-mailadres  privé', en:'E-mail address  private', de:'E-Mail-Adresse  privat' },
  'bureau': { nl:'kantoor', en:'office', de:'Büro' },
  'Communes choisies ': { nl:'Gekozen gemeenten ', en:'Chosen municipalities ', de:'Gewählte Gemeinden ' },
  '(indiquez le numéro des groupes pour @@ABBR@@ ainsi que le nom des communes)': { nl:'(vermeld het groepsnummer voor @@ABBR@@ en de naam van de gemeenten)', en:'(indicate the group number for @@ABBR@@ and the name of the municipalities)', de:'(geben Sie die Gruppennummer für @@ABBR@@ sowie den Namen der Gemeinden an)' },
  'Num Groupe @@ABBR@@': { nl:'Groepsnr. @@ABBR@@', en:'Group No. @@ABBR@@', de:'Gruppennr. @@ABBR@@' },
  'Commune': { nl:'Gemeente', en:'Municipality', de:'Gemeinde' },
  '   Nombre de groupes souhaités : @@NBGROUPES@@': { nl:'   Gewenst aantal groepen: @@NBGROUPES@@', en:'   Desired number of groups: @@NBGROUPES@@', de:'   Gewünschte Anzahl Gruppen: @@NBGROUPES@@' },
  '   pas intéressé(e) pour effectuer des enquêtes @@ABBR@@ @@PERIOD@@': { nl:'   Niet geïnteresseerd in het afnemen van enquêtes voor @@ABBR@@ @@PERIOD@@', en:'   Not interested in conducting @@ABBR@@ @@PERIOD@@ surveys', de:'   Nicht interessiert an der Durchführung von @@ABBR@@ @@PERIOD@@-Erhebungen' },
  '   n’est plus intéressé(e) pour effectuer des enquêtes ': { nl:'   Niet langer geïnteresseerd in het afnemen van enquêtes ', en:'   No longer interested in conducting surveys ', de:'   Nicht mehr an der Durchführung von Erhebungen interessiert ' },
  'Date:': { nl:'Datum:', en:'Date:', de:'Datum:' },
  'Signature': { nl:'Handtekening', en:'Signature', de:'Unterschrift' },
};
// Normalisation pour l'appariement : le gabarit officiel emploie la typographie FR
// (espace insécable U+00A0 / fine U+202F avant « : », apostrophe courbe U+2019).
// On compare des formes normalisées pour rester robuste à ces variantes.
function candNorm(s) { return String(s).replace(/[  ]/g, ' ').replace(/’/g, "'"); }
function candLocaliserLabels(doc) {
  if (uiLang === 'fr') return doc;
  const idx = {};
  for (const fr in CAND_DOCX_I18N) {
    const tr = CAND_DOCX_I18N[fr][uiLang];
    if (tr != null) idx[candNorm(fr)] = tr;
  }
  // Remplace le texte de chaque nœud <w:t> dont la forme normalisée est un libellé
  // connu (appariement exact sur le nœud entier → pas de collision de sous-chaînes).
  return doc.replace(/(<w:t[^>]*>)([^<]*)(<\/w:t>)/g, (m, open, text, close) => {
    const tr = idx[candNorm(text)];
    return tr != null ? open + candXmlEsc(tr) + close : m;
  });
}

function candGenerateDocxBytes(data) {
  const rowTpl = candBytesToStr(candB64ToBytes(CAND_DOCX.rowtpl));
  const rowsXml = (data.groupes || []).map(g =>
    rowTpl.replace('@@GRP@@', candXmlEsc(g.numero))
          .replace('@@COM@@', candXmlEsc(communeLabel(g.commune) + (g.quartier ? ' - ' + g.quartier : '')))
  ).join('');

  let doc = candBytesToStr(candB64ToBytes(CAND_DOCX.parts['word/document.xml']));
  // Titre centré de façon déterministe : le paragraphe de style "Title" n'a pas
  // de <w:jc>, son alignement dépend donc du rendu du style (gauche chez certains
  // lecteurs, centré chez d'autres). On force le centrage, cohérent avec l'encadré.
  doc = doc.replace('<w:pStyle w:val="Title"/><w:rPr>', '<w:pStyle w:val="Title"/><w:jc w:val="center"/><w:rPr>');
  // Case à cocher AVANT la traduction des libellés : candCocherCase s'ancre sur le
  // texte français des options ; ensuite on traduit les libellés fixes du formulaire.
  doc = candCocherCase(doc, CAND_CHOIX_ANCRE[data.choix] || CAND_CHOIX_ANCRE.groupes);
  doc = candLocaliserLabels(doc);   // libellés fixes → langue active (jetons @@…@@ conservés)
  doc = doc.replace('@@ROWS@@', rowsXml);
  const map = {
    '@@NOM@@': data.nom, '@@PRENOM@@': data.prenom, '@@ADRESSE@@': data.adresse,
    '@@CP@@': data.cp, '@@COMMUNE@@': data.commune,
    '@@TEL_PRIVE@@': data.telPrive, '@@HEURES_PRIVE@@': data.heuresPrive,
    '@@TEL_PORT@@': data.telPort, '@@HEURES_PORT@@': data.heuresPort,
    '@@TEL_BUR@@': data.telBur, '@@HEURES_BUR@@': data.heuresBur,
    '@@EMAIL_PRIVE@@': data.emailPrive, '@@EMAIL_BUR@@': data.emailBur,
    '@@NBGROUPES@@': '       ' + (data.nbGroupes != null ? data.nbGroupes : ''), '@@DATE@@': data.date,
  };
  for (const k in map) doc = doc.replace(k, candXmlEsc(map[k]));

  // ── Enquête : titre développé + sigle + période (une seule variable) ──
  //   @@TITLE@@  = nom complet développé + période (titre du document)
  //   @@ABBR@@   = sigle (ex. EFT) — intro, en-tête tableau, case à cocher
  //   @@PERIOD@@ = période (ex. 2026-Q4) — après le sigle
  doc = doc.split('@@TITLE@@').join(candXmlEsc(String(data.title != null ? data.title : '')));
  doc = doc.split('@@ABBR@@').join(candXmlEsc(String(data.abbrev != null ? data.abbrev : '')));
  doc = doc.split('@@PERIOD@@').join(candXmlEsc(String(data.period != null ? data.period : '')));

  // ── Signature (image PNG optionnelle) ──
  const SIG_RUN = '<w:r><w:t>@@SIGNATURE@@</w:t></w:r>';
  const SIG_REL = 'rIdSig100';
  let extraFiles = [];
  let relsOverride = null;
  if (data.signaturePng) {
    const sigBytes = candDataUrlToBytes(data.signaturePng);
    const sz = candPngSize(sigBytes);
    const EMU_PER_PX = 9525;
    let cx = sz.w * EMU_PER_PX, cy = sz.h * EMU_PER_PX;
    const MAXW = 45 * 36000;                 // largeur cible max ≈ 45 mm
    if (cx > MAXW) { cy = Math.round(cy * MAXW / cx); cx = MAXW; }
    doc = doc.replace(SIG_RUN, '<w:r>' + candSignatureDrawing(cx, cy, SIG_REL) + '</w:r>');
    let rels = candBytesToStr(candB64ToBytes(CAND_DOCX.parts['word/_rels/document.xml.rels']));
    rels = rels.replace('</Relationships>',
      `<Relationship Id="${SIG_REL}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/></Relationships>`);
    relsOverride = candStrToBytes(rels);
    extraFiles.push({ name: 'word/media/signature.png', bytes: sigBytes });
  } else {
    doc = doc.replace(SIG_RUN, '');
  }

  const files = CAND_DOCX.order.map(name => {
    if (name === 'word/document.xml') return { name, bytes: candStrToBytes(doc) };
    if (name === 'word/_rels/document.xml.rels' && relsOverride) return { name, bytes: relsOverride };
    return { name, bytes: candB64ToBytes(CAND_DOCX.parts[name]) };
  }).concat(extraFiles);
  return candBuildZip(files);
}


/* ══════════════════════════════════════════════════════════════════════
   CANDIDATURE — câblage interface (panneau + persistance + génération)
   ══════════════════════════════════════════════════════════════════════ */
const CAND_LS_KEY = 'lfs_candidature_infos';
// Champs mémorisés (coordonnées). NbGroupes et Date sont CALCULÉS (nb de groupes
// sélectionnés / date du jour) → ni mémorisés ni restaurés.
const CAND_FIELDS = ['Survey','Nom','Prenom','Adresse','Cp','Commune','TelPrive','HeuresPrive',
  'TelPort','HeuresPort','TelBur','HeuresBur','EmailPrive','EmailBur'];
// Sigle d'enquête -> nom complet en 4 langues (pour développer le titre du
// document). Le sigle inconnu est utilisé tel quel comme nom. Ajouter les
// enquêtes ici. Le nom affiché suit la langue active (repli FR).
const CAND_SURVEYS = {
  'EFT': { fr:'Enquête sur les Forces de Travail', nl:'Enquête naar de Arbeidskrachten', en:'Labour Force Survey', de:'Arbeitskräfteerhebung' },
};
// Sigle localisé de l'enquête (affiché dans le .docx : intro, en-tête tableau, case
// à cocher). EFT (FR) = EAK (NL) = LFS (EN) = AKE (DE).
const CAND_ABBR_I18N = {
  'EFT': { fr:'EFT', nl:'EAK', en:'LFS', de:'AKE' },
};

function candEl(f){ return document.getElementById('cand'+f); }

function candEscHtml(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Date du jour (jj/mm/aaaa) dans le champ Date — appelée à chaque ouverture.
function candSetDateAujourdhui(){
  const d=candEl('Date'); if(d) d.value=new Date().toLocaleDateString('fr-BE');
}

// Dérive « <sigle> <année>-T<x> » du trimestre sélectionné dans le header.
// Renvoie null si « Tout » / aucun trimestre unique → on ne touche pas au champ.
// Repli sur le nom du planning si l'année/trimestre n'est pas reconnu.
function surveyDepuisPlanning(){
  const sel=document.getElementById('selPlanning');
  const id=sel?sel.value:'';
  if(!id || id==='__ALL__') return null;
  const p=(typeof _plannings!=='undefined' && _plannings[id])
        || (typeof _plans!=='undefined' && _plans.find(x=>x.id===id));
  if(!p) return null;
  const nom=p.nom||'';
  const sigle=(p.type && p.type.split('/')[0].trim()) || 'EFT';
  const m=nom.match(/(20\d{2})\D*?[QT]\s*([1-4])/i) || nom.match(/[QT]\s*([1-4])\D*?(20\d{2})/i);
  if(m){
    const year=/^\d{4}$/.test(m[1])?m[1]:m[2];
    const q   =/^\d{4}$/.test(m[1])?m[2]:m[1];
    return sigle+' '+year+'-T'+q;
  }
  return nom;   // repli
}

// Synchronise le champ titre #candSurvey sur le trimestre du header (reste éditable).
function syncCandSurvey(){
  const s=surveyDepuisPlanning();
  if(!s) return;
  const el=document.getElementById('candSurvey');
  if(el){ el.value=s; if(typeof candSaveInfos==='function') candSaveInfos(); }
}

function candLoadInfos(){
  let saved={};
  try{ saved=JSON.parse(localStorage.getItem(CAND_LS_KEY)||'{}'); }catch(e){}
  CAND_FIELDS.forEach(f=>{ const el=candEl(f); if(el && saved[f]!=null) el.value=saved[f]; });
  CAND_FIELDS.forEach(f=>{ const el=candEl(f); if(el) el.addEventListener('input',candSaveInfos); });
  candSetDateAujourdhui();          // Date = date du jour
  candSigInit();
  candSigLoad(localStorage.getItem(CAND_SIG_KEY));
  updateCandidaturePreview();       // NbGroupes = nb de groupes sélectionnés
}

function candSaveInfos(){
  const o={};
  CAND_FIELDS.forEach(f=>{ const el=candEl(f); if(el) o[f]=el.value; });
  try{ localStorage.setItem(CAND_LS_KEY,JSON.stringify(o)); }catch(e){}
}

// Ordre de priorité des entrées choisies (persistant tant que la sélection existe).
// Une entrée = commune + quartier : chaque quartier d'une commune est ordonnable
// SÉPARÉMENT (ex. « Schaerbeek — Gd. Rue au Bois » avant « Schaerbeek — Helmet »),
// au lieu de regrouper tous les groupes d'une commune en un seul bloc.
let candCommuneOrder = [];
const CAND_SEP = String.fromCharCode(1);   // separateur de cle commune|quartier (absent des donnees)

// Regroupe les groupes sélectionnés PAR COMMUNE + QUARTIER, dans l'ordre de priorité
// choisi. Met à jour candCommuneOrder : élague les entrées disparues, ajoute les
// nouvelles (tri commune puis quartier) à la fin.
// Retourne [{key, commune, communeFR, quartier, count, groups[]}].
function candCommunes(){
  const map=new Map();
  selectedRows().forEach(r=>{
    const commune=(r.commune||'').trim() || '—';
    const quartier=(r.quartier||'').trim();
    const key=commune+CAND_SEP+quartier;
    let e=map.get(key);
    if(!e){ e={key, commune, communeFR:commune.split('/')[0].trim()||commune, quartier, groups:[]}; map.set(key,e); }
    e.groups.push(r.numero);
  });
  const ordered=candCommuneOrder.filter(k=>map.has(k));
  [...map.keys()].filter(k=>!ordered.includes(k))
    .sort((a,b)=>{ const ea=map.get(a), eb=map.get(b);
      return ea.communeFR.localeCompare(eb.communeFR,'fr',{sensitivity:'base'})
          || ea.quartier.localeCompare(eb.quartier,'fr',{sensitivity:'base'}); })
    .forEach(k=>ordered.push(k));
  candCommuneOrder=ordered;
  return ordered.map(k=>{ const e=map.get(k);
    const grps=e.groups.slice().sort((a,b)=>{ const na=parseInt(a,10),nb=parseInt(b,10);
      return (!isNaN(na)&&!isNaN(nb)&&na!==nb)?na-nb:String(a).localeCompare(String(b)); });
    return { key:k, commune:e.commune, communeFR:e.communeFR, quartier:e.quartier, count:grps.length, groups:grps };
  });
}

// Groupes transmis au .docx : dans l'ordre de priorité (commune + quartier), puis par n°.
function candSelectedGroups(){
  const out=[];
  candCommunes().forEach(c=> c.groups.forEach(n=> out.push({ numero:n, commune:c.communeFR, quartier:c.quartier })));
  return out;
}

// Monte/descend une entrée (commune + quartier) dans l'ordre de priorité (i = rang affiché).
function candMoveCommune(i, dir){
  const keys=candCommunes().map(c=>c.key);
  const j=i+dir;
  if(j<0||j>=keys.length) return;
  [keys[i],keys[j]]=[keys[j],keys[i]];
  candCommuneOrder=keys;
  updateCandidaturePreview();
}

// Retire une entrée (commune + quartier) : désélectionne ses groupes et recalcule tout.
function candRemoveCommune(i){
  const c=candCommunes()[i];
  if(!c) return;
  c.groups.forEach(n=>selected.delete(n));
  candCommuneOrder=candCommuneOrder.filter(k=>k!==c.key);
  renderGroupsList();
  updateAgenda();               // → met à jour l'agenda + updateCandidaturePreview
}

function updateCandidaturePreview(){
  if(!document.getElementById('candGrpPreview')) return;
  const communes=candCommunes();
  const total=communes.reduce((s,c)=>s+c.count,0);
  const cnt=document.getElementById('candGrpCount');
  if(cnt) cnt.textContent=total;
  // Pastille de comptage sur l'onglet Candidature (mêmes groupes retenus).
  const cb=document.getElementById('candCount');
  if(cb){ cb.textContent=total; cb.hidden=total===0; }
  const ctab=document.getElementById('tab-candidature');
  if(ctab) ctab.setAttribute('data-tip', total ? tf('js_cand_count',{n:total}) : t('tab_candidature'));
  const box=document.getElementById('candGrpPreview');
  if(!communes.length){
    box.innerHTML='<div style="color:var(--ink3);font-size:12px">'+candEscHtml(t('cand_no_group'))+'</div>';
  }else{
    const last=communes.length-1;
    box.innerHTML=communes.map((c,i)=>
      '<div class="cand-line">'
      +'<span class="cand-rank" title="'+candEscHtml(tf('js_priority',{n:i+1}))+'">'+(i+1)+'</span>'
      +'<span class="cand-prio">'
        +'<button type="button" class="cand-mv" title="'+candEscHtml(t('js_move_up'))+'" onclick="candMoveCommune('+i+',-1)"'+(i===0?' disabled':'')+'>▲</button>'
        +'<button type="button" class="cand-mv" title="'+candEscHtml(t('js_move_down'))+'" onclick="candMoveCommune('+i+',1)"'+(i===last?' disabled':'')+'>▼</button>'
      +'</span>'
      +'<span class="cand-comm">'+candEscHtml(communeLabel(c.commune))
        +'<span class="cand-q">'+candEscHtml(c.groups.join(', ')+(c.quartier?(' - '+c.quartier):''))+'</span>'
      +'</span>'
      +'<span class="cand-cnt">'+c.count+' '+candEscHtml(t('cand_groupes_word'))+'</span>'
      +'<button type="button" class="cand-del" title="'+candEscHtml(t('js_remove_commune'))+'" aria-label="'+candEscHtml(tf('js_remove_commune_aria',{c:communeLabel(c.commune)+(c.quartier?(' — '+c.quartier):'')}))+'" onclick="candRemoveCommune('+i+')">✕</button>'
      +'</div>'
    ).join('');
  }
  // NbGroupes = total des groupes des communes retenues (champ calculé, recalculé).
  const nb=candEl('NbGroupes');
  if(nb) nb.value=String(total);
}

// Erreurs de validation de la candidature (document officiel).
function candClearErreurs(){
  document.querySelectorAll('#pane-candidature .champ-erreur').forEach(el=>{ el.classList.remove('champ-erreur'); el.removeAttribute('aria-invalid'); });
  document.querySelectorAll('#pane-candidature .err-msg.show').forEach(el=>{ el.classList.remove('show'); el.textContent=''; });
  const ge=document.getElementById('candErr'); if(ge){ ge.hidden=true; ge.textContent=''; }
}
function candMarquerErreur(suffix,msg){
  const el=candEl(suffix); if(el){ el.classList.add('champ-erreur'); el.setAttribute('aria-invalid','true'); }
  const em=document.getElementById('err-cand'+suffix); if(em){ em.textContent=msg; em.classList.add('show'); }
}
function candErrGlobale(msg){ const ge=document.getElementById('candErr'); if(ge){ ge.textContent=msg; ge.hidden=false; } }
async function genererCandidature(){
  const g=candEl;
  // Document officiel : bloquer la génération si des champs requis ou la signature manquent.
  candClearErreurs();
  let premierFautif=null;
  [['Nom','cand_nom'],['Prenom','cand_prenom'],['Adresse','cand_adresse']].forEach(([sfx,key])=>{
    const el=g(sfx);
    if(!el || !el.value.trim()){ candMarquerErreur(sfx,tf('js_field_required',{field:t(key)})); if(!premierFautif) premierFautif=el; }
  });
  let msgGlobal='';
  if(!candSigData){ msgGlobal=t('js_sig_required'); if(!premierFautif) premierFautif=document.getElementById('candSigCanvas'); }
  if(premierFautif || msgGlobal){
    candErrGlobale(msgGlobal || t('js_fix_fields'));
    if(premierFautif){ try{ premierFautif.focus(); }catch(_){} }
    return;
  }
  const data={
    nom:g('Nom').value, prenom:g('Prenom').value, adresse:g('Adresse').value,
    cp:g('Cp').value, commune:g('Commune').value,
    telPrive:g('TelPrive').value, heuresPrive:g('HeuresPrive').value,
    telPort:g('TelPort').value, heuresPort:g('HeuresPort').value,
    telBur:g('TelBur').value, heuresBur:g('HeuresBur').value,
    emailPrive:g('EmailPrive').value, emailBur:g('EmailBur').value,
    nbGroupes:g('NbGroupes').value, date:g('Date').value,
    groupes:candSelectedGroups(),
    signaturePng:candSigData,
  };
  // Case à cocher retenue (une seule) → transmise au .docx comme les autres champs.
  const choixEl=document.querySelector('input[name="candChoix"]:checked');
  data.choix=choixEl?choixEl.value:'groupes';
  // « Nombre de groupes souhaités » sans aucun groupe → génération bloquée.
  // (Les options « Pas / Plus intéressé » ne nécessitent pas de groupe.)
  if(data.choix==='groupes' && data.groupes.length===0){
    candErrGlobale(t('js_cand_no_group'));
    setTab('candidature');
    return;
  }
  // Une seule variable "EFT 2026-Q4" : le 1er mot = sigle, le reste = période.
  // Le sigle est développé (dictionnaire) pour le TITRE ; il est conservé tel
  // quel dans l'intro, l'en-tête du tableau et la case à cocher.
  const survey=(g('Survey').value||'').trim();
  const abbr=survey.split(/\s+/)[0]||'';
  const period=survey.slice(abbr.length).trim();
  const abbrKey=abbr.toUpperCase();
  const se=CAND_SURVEYS[abbrKey];
  const full=se ? (se[uiLang]||se.fr) : abbr;
  const ai=CAND_ABBR_I18N[abbrKey];
  data.abbrev=ai ? (ai[uiLang]||ai.fr||abbr) : abbr;   // sigle localisé (EFT/EAK/LFS/AKE)
  data.period=period;
  data.title=(full+' '+period).trim();
  try{
    const bytes=candGenerateDocxBytes(data);
    const TYPE='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const who=(data.nom||data.prenom)?('_'+(data.nom+data.prenom).replace(/[^A-Za-z0-9]/g,'')):'';
    const slug=(survey||'EFT').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'');
    const nomFichier='Candidature_'+slug+who+'.docx';
    candSaveInfos();
    // Pas de pop-up applicative. Sur mobile : partage natif (Gmail, WhatsApp,
    // Word, Enregistrer dans Fichiers…) via l'API Web Share si elle accepte les
    // fichiers. Sinon (bureau, navigateur non compatible) : téléchargement
    // classique — l'utilisateur clique lui-même le lien du navigateur.
    const file=new File([bytes], nomFichier, {type:TYPE});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file], title:nomFichier}); return; }
      catch(err){ if(err && err.name==='AbortError') return; /* sinon repli téléchargement */ }
    }
    const url=URL.createObjectURL(new Blob([bytes],{type:TYPE}));
    const a=document.createElement('a');
    a.href=url; a.download=nomFichier;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>{ try{URL.revokeObjectURL(url);}catch(_){} }, 60000);
  }catch(e){ candErrGlobale(tf('js_gen_error',{msg:e.message})); }
}

// La candidature est désormais un onglet plein (plus de modale) : on bascule dessus.
function openCandidature(){ setTab('candidature'); }

// ══════════════════════════════════════════════════════════════════════
//  ONGLETS — Planning / Agenda / Candidature
// ══════════════════════════════════════════════════════════════════════
const TABS = ['planning', 'agenda', 'candidature'];
function setTab(name){
  if(!TABS.includes(name)) name='planning';
  TABS.forEach(n=>{
    const t=document.getElementById('tab-'+n), pane=document.getElementById('pane-'+n);
    const on=(n===name);
    if(t){ t.classList.toggle('active', on); t.setAttribute('aria-selected', on?'true':'false'); t.tabIndex = on?0:-1; }
    if(pane) pane.hidden=!on;
  });
  // Planning : (ré)initialise la carte Leaflet (invalidateSize sur conteneur affiché).
  if(name==='planning' && typeof initPlanning==='function') initPlanning();
  // Candidature : prépare date du jour + aperçu des communes choisies + signature.
  if(name==='candidature'){
    if(typeof candSetDateAujourdhui==='function') candSetDateAujourdhui();
    if(typeof syncCandSurvey==='function') syncCandSurvey();   // titre = trimestre du header
    if(typeof candSigInit==='function') candSigInit();
    if(typeof updateCandidaturePreview==='function') updateCandidaturePreview();
  }
}

/* ── Signature (canvas → PNG intégré au .docx) ── */
const CAND_SIG_KEY='lfs_candidature_sig';
let candSigData=null, candSigCtx=null, candSigDrawing=false, candSigInited=false;
function candSigInit(){
  if(candSigInited) return;
  const c=document.getElementById('candSigCanvas'); if(!c) return;
  candSigCtx=c.getContext('2d');
  candSigCtx.lineWidth=2.2; candSigCtx.lineCap='round'; candSigCtx.lineJoin='round'; candSigCtx.strokeStyle='#12203a';
  const pos=e=>{ const r=c.getBoundingClientRect(); const t=(e.touches&&e.touches[0])||e;
    return { x:(t.clientX-r.left)*(c.width/r.width), y:(t.clientY-r.top)*(c.height/r.height) }; };
  const start=e=>{ e.preventDefault(); candSigDrawing=true; const p=pos(e); candSigCtx.beginPath(); candSigCtx.moveTo(p.x,p.y); };
  const move =e=>{ if(!candSigDrawing) return; e.preventDefault(); const p=pos(e); candSigCtx.lineTo(p.x,p.y); candSigCtx.stroke(); };
  const end  =()=>{ if(!candSigDrawing) return; candSigDrawing=false; candSigData=c.toDataURL('image/png'); candSaveSig(); candSigStatus(true);
    const ge=document.getElementById('candErr'); if(ge && !ge.hidden){ ge.hidden=true; ge.textContent=''; } };
  c.addEventListener('pointerdown',start); c.addEventListener('pointermove',move);
  window.addEventListener('pointerup',end); c.addEventListener('pointerleave',end);
  candSigInited=true;
}
function candSigStatus(has){ const s=document.getElementById('candSigStatus'); if(s) s.textContent = has ? t('cand_sig_filled') : t('cand_sig_empty'); }
function candSigClear(){
  const c=document.getElementById('candSigCanvas');
  if(c&&candSigCtx) candSigCtx.clearRect(0,0,c.width,c.height);
  candSigData=null; candSaveSig(); candSigStatus(false);
}
// Chemin non-souris : rend le nom saisi au clavier dans le canvas → même pipeline PNG.
function candSigFromName(){
  const inp=document.getElementById('candSigName'); const name=(inp&&inp.value||'').trim();
  if(!name){ if(inp) inp.focus(); return; }
  candSigInit(); const c=document.getElementById('candSigCanvas'); if(!c||!candSigCtx) return;
  candSigCtx.clearRect(0,0,c.width,c.height);
  candSigCtx.fillStyle='#12203a'; candSigCtx.textBaseline='middle';
  let fs=44; do { candSigCtx.font='italic '+fs+'px "Segoe Script","Brush Script MT",cursive'; if(candSigCtx.measureText(name).width<=c.width-24) break; fs-=2; } while(fs>16);
  candSigCtx.fillText(name,16,c.height/2);
  candSigData=c.toDataURL('image/png'); candSaveSig(); candSigStatus(true);
}
function candSigLoad(dataUrl){
  candSigData=dataUrl||null;
  candSigStatus(!!candSigData);
  const c=document.getElementById('candSigCanvas');
  if(!c||!candSigCtx||!dataUrl) return;
  const img=new Image();
  img.onload=()=>{ candSigCtx.clearRect(0,0,c.width,c.height); candSigCtx.drawImage(img,0,0,c.width,c.height); };
  img.src=dataUrl;
}
function candSaveSig(){
  try{ if(candSigData) localStorage.setItem(CAND_SIG_KEY,candSigData); else localStorage.removeItem(CAND_SIG_KEY); }catch(e){}
}
