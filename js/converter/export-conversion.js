/*
 * js/converter/export-conversion.js — Convertisseur : EXPORT (sérialisation CSV, en-tetes
 * traduits, telechargement, rapport texte de synthese) et CONVERSION PRINCIPALE (GRP ->
 * cibles/membres, recherche de groupe + rattachement des vagues, annexe planning, nom complet
 * de l'enquete). Extrait verbatim du <script> du Convertisseur. Script CLASSIQUE : globales
 * partagees (lit refdata, GRP_PLANNING, t()... au runtime).
 */
// ════════════════════════════════════════════════════════════════════════
//  RÉGION — EXPORT · sérialisation CSV & téléchargement
// ════════════════════════════════════════════════════════════════════════
// Séparateur d'export CSV — IDENTIQUE au module Interviews. Réglage partagé via
// localStorage['statbel_settings'].csvSep ('auto' | ',' | ';'), même origine.
// 'auto' = régional : les locales à virgule décimale (fr/nl/de-BE…) prennent
// « ; » — ce qu'attend Excel pour découper les colonnes automatiquement —,
// sinon « , ». Combiné au BOM UTF-8, le fichier s'ouvre directement dans Excel.
function csvSepRegional() {
  try { return (1.1).toLocaleString().includes(',') ? ';' : ','; } catch (e) { return ','; }
}
function csvSepExport() {
  let s = 'auto';
  try {
    const raw = JSON.parse(localStorage.getItem('statbel_settings') || '{}');
    if (raw && (raw.csvSep === ',' || raw.csvSep === ';' || raw.csvSep === 'auto')) s = raw.csvSep;
  } catch (e) {}
  return s === ';' ? ';' : s === ',' ? ',' : csvSepRegional();
}

function toCsv(rows, headers) {
  const sep = csvSepExport();
  // Guillemets si la cellule contient un séparateur possible (« , » ou « ; »),
  // un guillemet ou un saut de ligne → sûr quel que soit le séparateur choisi.
  const esc = v => {
    const s = String(v==null?'':v);
    return /[",;\n\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  };
  const headerLine = headers.map(h => esc(EN_LABEL[h] || h)).join(sep);   // en-têtes anglais
  return [headerLine, ...rows.map(r => headers.map(h => esc(r[h]||'')).join(sep))].join('\n');
}

function telecharger(contenu, nom, bom = false) {
  // bom=true  → UTF-8 BOM  (pour le CSV cibles, compatible Excel)
  // bom=false → UTF-8 pur  (pour membres et rapport)
  const prefix = bom ? '\uFEFF' : '';
  const blob = new Blob([prefix + contenu], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nom; a.click();
  URL.revokeObjectURL(url);
}

// Ouvre la fenêtre d'export (boutons CSV/rapport de la source active)
function ouvrirExport() {
  if (!_resultat) { alert(t('al_no_source_file')); return; }
  document.getElementById('expNom').textContent = nomEnquete(_resultat);
  majLabels(_resultat);
  document.getElementById('modalExport').classList.add('open');
}
function fermerExport() {
  document.getElementById('modalExport').classList.remove('open');
}

// Rapport texte de synthèse (nationalités, état civil, taille des ménages)
function genererRapport(grpId, outCibles, outMembres) {
  const nltyC = {}, mrtlC = {}, tailleC = {};
  outCibles.forEach(r => {
    nltyC[r.nationality]    = (nltyC[r.nationality]   ||0)+1;
    mrtlC[r.marital_status] = (mrtlC[r.marital_status]||0)+1;
    tailleC[r.taille_menage]= (tailleC[r.taille_menage]||0)+1;
  });
  const ligne = s => s;
  return [
    '='.repeat(60), '  STATBEL SURVEY EXTRACTION REPORT', '='.repeat(60), '',
    `Group   : ${grpId}`,
    `Date    : ${new Date().toLocaleString('en-GB')}`,
    `Targets : ${outCibles.length}`,
    `Members : ${outMembres.length}`, '',
    'NATIONALITIES (ISO):',
    ...Object.entries(nltyC).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${(k||'—').padEnd(12)} : ${v}`),
    '', 'MARITAL STATUS:',
    ...Object.entries(mrtlC).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${(k||'—').padEnd(35)} : ${v}`),
    '', 'HOUSEHOLD SIZE DISTRIBUTION:',
    ...Object.entries(tailleC).sort((a,b)=>Number(a[0])-Number(b[0])).map(([t,c])=>`  ${t} member(s) : ${c}`),
    '', '='.repeat(60),
  ].join('\n');
}

// ════════════════════════════════════════════════════════════════════════
//  CONVERSION PRINCIPALE
// ════════════════════════════════════════════════════════════════════════

// ── Détection des codes nationalité/pays absents de NLTY_ISO ─────────────
// Parcourt le GRP et liste les CD_MB_NLTY et CD_MB_BTH_REFNIS (étrangers)
// qui n'ont pas de correspondance, avec le nombre d'occurrences. Permet de
// compléter NLTY_ISO à partir de données réelles, sans inventer de codes.
function detecterCodesManquants(srcRows) {
  const nlty    = {};   // code → [{ordre, nom}]  nationalité (CD_MB_NLTY)
  const bth     = {};   // code → [{ordre, nom}]  pays de naissance étranger (CD_MB_BTH_REFNIS non-belge)
  const commune = {};   // code → [{ordre, nom}]  commune belge REFNIS (5 chiffres) absente de REFNIS_COMMUNE
  const mrtl    = {};   // code → [{ordre, nom}]  statut matrimonial (CD_MB_MRTL_STS) absent de MRTL_FR
  const ajouter = (obj, code, r) => {
    const ordre = (r['NR_HH']||'').trim().padStart(3,'0');
    const nom   = ((r['TX_MB_NM_FST']||'').trim() + ' ' + (r['TX_MB_NM_LST']||'').trim()).trim() || '(sans nom)';
    (obj[code] = obj[code] || []).push({ ordre, nom });
  };
  srcRows.forEach(r => {
    // Nationalité
    const cn = (r['CD_MB_NLTY']||'').trim();
    if (cn && !NLTY_ISO[cn]) ajouter(nlty, cn, r);
    // Pays de naissance
    const cb = (r['CD_MB_BTH_REFNIS']||'').trim();
    if (cb) {
      if (cb.length === 5) {
        // commune belge : doit exister dans REFNIS_COMMUNE
        if (!REFNIS_COMMUNE[cb]) ajouter(commune, cb, r);
      } else if (!NLTY_ISO[cb]) {
        // code pays étranger inconnu
        ajouter(bth, cb, r);
      }
    }
    // Statut matrimonial
    const cm = (r['CD_MB_MRTL_STS']||'').trim();
    if (cm && !MRTL_FR[cm]) ajouter(mrtl, cm, r);
  });
  // → [{code, count, gens:[{ordre,nom}]}], trié par fréquence décroissante
  const fmt = obj => Object.entries(obj)
    .sort((a,b) => b[1].length - a[1].length)
    .map(([code, gens]) => ({ code, count: gens.length, gens }));
  return { nlty: fmt(nlty), bth: fmt(bth), commune: fmt(commune), mrtl: fmt(mrtl) };
}

function convertir(srcRows) {
  const tailleHH = {};
  const nb15HH = {};                      // membres ≥ âge min par ménage (personnes cibles interrogeables)
  const ageMin15 = ageMinCible();
  srcRows.forEach(r => {
    const hh = (r['NR_HH']||'').trim();
    tailleHH[hh] = (tailleHH[hh]||0) + 1;
    const a = parseInt(r['MS_MB_AGE'], 10);
    if (!isNaN(a) && a >= ageMin15) nb15HH[hh] = (nb15HH[hh]||0) + 1;
  });

  const cibles = srcRows.filter(r => (r['FL_MB_CNTCT']||'').trim() === '1');
  const grpId  = cibles.length ? (cibles[0]['TX_DBENQ_GRP']||'').trim() : 'enquete';

  const outCibles = cibles.map(r => {
    const hh = (r['NR_HH']||'').trim();
    const { birthCountry, birthCommune, birthCommuneNl, birthDistrict, birthProvince, birthRegion, birthNuts2, birthNuts3, nationality, maritalStatus } = decoder(
      r['CD_MB_BTH_REFNIS'], r['CD_MB_NLTY'], r['CD_MB_MRTL_STS']
    );
    return {
      ordre: hh.padStart(3,'0'), prenom: r['TX_MB_NM_FST']||'',
      nom: r['TX_MB_NM_LST']||'', adresse: composerAdresse(r),
      statut: 'À faire', date_interview: '', rdv: '',
      sexe: SEX_MAP[(r['CD_MB_SEX']||'').trim()]||'',
      birth_date: convertirDate(r['DT_MB_BTH']||''),
      age: r['MS_MB_AGE']||'', birth_country: birthCountry,
      birth_commune: birthCommune, birth_commune_nl: birthCommuneNl,   // FR + NL
      birth_district: birthDistrict, birth_province: birthProvince, birth_region: birthRegion,
      birth_nuts2: birthNuts2, birth_nuts3: birthNuts3,
      nationality, marital_status: maritalStatus,
      taille_menage: String(tailleHH[hh]||1),
      nb_cibles: String(nb15HH[hh]||0),   // personnes du ménage ≥ âge min (direct + proxy)
      gsm: r['NR_PHONE']||'', email: r['TX_EMAIL']||'', notes: '',
      // Méthode de collecte souhaitée (CATI/CAWI) + identifiants d'accès web du ménage.
      collect_method: (r['CD_WSH_CLCT_MTHD']||'').trim(),
      web_user_id:    reparerIdSci(r['TX_WEB_USER_ID']),
      web_user_pwd:   reparerIdSci(r['TX_WEB_USER_PSWRD']),
    };
  });

  const hhCount = {};
  const outMembres = srcRows.map(r => {
    const hh = (r['NR_HH']||'').trim();
    hhCount[hh] = (hhCount[hh]||0) + 1;
    const { birthCountry, birthCommune, birthCommuneNl, birthDistrict, birthProvince, birthRegion, birthNuts2, birthNuts3, nationality, maritalStatus } = decoder(
      r['CD_MB_BTH_REFNIS'], r['CD_MB_NLTY'], r['CD_MB_MRTL_STS']
    );
    return {
      nr_hh: hh.padStart(3,'0'), nr_membre: String(hhCount[hh]),
      fl_cntct: (r['FL_MB_CNTCT']||'').trim(),
      prenom: r['TX_MB_NM_FST']||'', nom: r['TX_MB_NM_LST']||'',
      sexe: SEX_MAP[(r['CD_MB_SEX']||'').trim()]||'',
      birth_date: convertirDate(r['DT_MB_BTH']||''),
      age: r['MS_MB_AGE']||'', birth_country: birthCountry,
      birth_commune: birthCommune, birth_commune_nl: birthCommuneNl, birth_district: birthDistrict, birth_province: birthProvince, birth_region: birthRegion,
      birth_nuts2: birthNuts2, birth_nuts3: birthNuts3, nationality,
      marital_status: maritalStatus,
      taille_menage: String(tailleHH[hh]||1),
      adresse: composerAdresse(r),
    };
  });

  // Colonnes administratives fixes (identiques pour toutes les lignes du fichier)
  const adminCols = {
    NR_GRP:    (srcRows[0] && srcRows[0]['NR_GRP'])    || '',
    NR_YEAR:   (srcRows[0] && srcRows[0]['NR_YEAR'])   || '',
    NR_SEQ:    (srcRows[0] && srcRows[0]['NR_SEQ'])    || '',
    NR_WAVE:   (srcRows[0] && srcRows[0]['NR_WAVE'])   || '',
    NR_REF_WK: (srcRows[0] && srcRows[0]['NR_REF_WK']) || '',
  };

  // Planning LFS du groupe (annexe) : enrichit chaque cible avec commune/quartier
  // et la période terrain de la vague en cours (issus de GRP_PLANNING).
  const planning = planningPourGRP(adminCols);
  const planCols = {
    planning_commune: planning.commune, planning_quartier: planning.quartier,
    wave: String(planning.wave || ''), ref_week: planning.sem,
    field_start: planning.start, field_stop: planning.stop,
  };
  outCibles.forEach(r => Object.assign(r, planCols));

  const outEnquete = outCibles.map(r => ({ ...adminCols, ...r }));

  // Localisation par défaut : commune la plus fréquente (TX_ADRS_REFNIS_NM)
  const communes = {};
  srcRows.forEach(r => { const v = (r['TX_ADRS_REFNIS_NM']||'').trim(); if (v) communes[v] = (communes[v]||0)+1; });
  const communeDom = Object.entries(communes).sort((a,b)=>b[1]-a[1])[0];
  const localisation = communeDom ? communeDom[0].toUpperCase() : '';

  const codesManquants = detecterCodesManquants(srcRows);

  return { grpId, localisation, outCibles, outMembres, outEnquete, tailleHH, srcRows, adminCols, codesManquants, planning };
}

// Recherche EXACTE d'un groupe (5 chiffres) dans les plannings chargés (type LFS,
// index .grp), puis repli sur la table embarquée GRP_PLANNING (Q3 2026).
function chercherPlanningExact(code) {
  if (typeof _plannings !== 'undefined') {
    for (const p of Object.values(_plannings)) {
      if (p.grp && p.grp[code]) return { e: p.grp[code], source: p.nom, base: code };
    }
  }
  if (typeof GRP_PLANNING !== 'undefined' && GRP_PLANNING[code])
    return { e: GRP_PLANNING[code], source: 'Q3 2026 (embarqué)', base: code };
  return null;
}

// Recherche un groupe avec RATTACHEMENT DES VAGUES. Le planning n'est indexé que
// sur le numéro de la VAGUE 1 (« 1·SS·GG »), qui porte déjà les 4 interrogations.
// Un fichier de vague ≥ 2 a un numéro différent (« V·SS·GG », ex. 23605) absent du
// planning : on remonte alors au groupe INITIAL de MÊME GG dont l'interrogation Iᵥ
// (i[wave-1]) tombe sur la SEMAINE SS du numéro (ex. 23605 → 12305 : I2 = wk36).
// Renvoie { e, source, base } (base = clé du groupe initial) ou null.
function chercherPlanning(code, wave) {
  const direct = chercherPlanningExact(code);
  if (direct) return direct;
  const v = parseInt(wave, 10) || parseInt(code[0], 10) || 1;   // vague (1er chiffre = V)
  if (v < 2) return null;
  const ss = parseInt(code.slice(1, 3), 10);   // semaine de référence de la vague
  const gg = code.slice(3, 5);                  // numéro de groupe (localisation)
  const idx = v - 1;
  const ok = e => e && e.i && e.i[idx] && parseInt(e.i[idx][0], 10) === ss;
  if (typeof _plannings !== 'undefined') {
    for (const p of Object.values(_plannings)) {
      if (!p.grp) continue;
      for (const [k, e] of Object.entries(p.grp))
        if (k.slice(-2) === gg && ok(e)) return { e, source: p.nom, base: k };
    }
  }
  if (typeof GRP_PLANNING !== 'undefined') {
    for (const [k, e] of Object.entries(GRP_PLANNING))
      if (k.slice(-2) === gg && ok(e)) return { e, source: 'Q3 2026 (embarqué)', base: k };
  }
  return null;
}

// Annexe planning : retrouve commune/quartier + période terrain de la vague en cours
function planningPourGRP(adminCols) {
  const grp = String(adminCols.NR_GRP || '').trim();
  const code = grp.slice(-5);
  const wave = parseInt(adminCols.NR_WAVE, 10) || 1;
  const m = chercherPlanning(code, wave);
  if (!m) return { found: false, code, wave, province: '', commune: '', quartier: '', sem: '', start: '', stop: '', source: '' };
  const e = m.e;
  const it = (e.i && e.i[wave - 1]) || ['', '', ''];
  return { found: true, code, wave, province: e.p, commune: e.c, quartier: e.q, sem: it[0], start: it[1], stop: it[2], source: m.source };
}

// Nom complet de l'enquête = identifiant groupe + localisation
function nomEnquete(res) {
  return res.grpId + (res.localisation ? ' - ' + res.localisation : '');
}
