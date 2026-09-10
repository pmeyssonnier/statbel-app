/*
 * Test de non-régression — export CSV du Convertisseur : séparateur régional
 * (« ; » ou « , ») + encodage UTF-8, et compatibilité avec l'import Interviews.
 *
 * Le Convertisseur reprend le RÉGLAGE PARTAGÉ localStorage['statbel_settings'].csvSep
 * ('auto' | ',' | ';'), exactement comme le module Interviews (même origine). On
 * vérifie :
 *   1. csvSep=';'  → séparateur « ; », en-têtes et lignes joints par « ; »,
 *      et toute cellule contenant « ; » est mise entre guillemets (échappement).
 *   2. csvSep=','  → séparateur « , ».
 *   3. csvSep='auto' → même valeur que csvSepRegional() (logique régionale).
 *   4. Aller-retour : l'export « enquête » (séparateur « ; » + BOM) est relu SANS
 *      erreur par parseCSV() du module Interviews (détection auto du séparateur,
 *      BOM ignoré), avec les bons champs (taille_menage, nb_cibles).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-csv-sep.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

// GRP synthétique minimal : 2 ménages. Le 1er a 2 membres (dont 1 ≥15) et une
// rue contenant « ; » pour exercer l'échappement.
const GRP = [
  { NR_HH:'001', FL_MB_CNTCT:'1', TX_MB_NM_FST:'Jean', TX_MB_NM_LST:'Dubois', TX_DBENQ_GRP:'2026-13605',
    MS_MB_AGE:'40', TX_ADRS_USTR_NM:'Rue A; coin B', CD_ADRS_HS:'10', CD_ADRS_ZIP:'1030', TX_ADRS_REFNIS_NM:'Schaerbeek',
    NR_GRP:'202613605', NR_YEAR:'2026', NR_WAVE:'1', NR_SEQ:'001', NR_REF_WK:'36' },
  { NR_HH:'001', FL_MB_CNTCT:'0', TX_MB_NM_FST:'Marie', TX_MB_NM_LST:'Dubois', TX_DBENQ_GRP:'2026-13605',
    MS_MB_AGE:'16', TX_ADRS_USTR_NM:'Rue A; coin B', CD_ADRS_HS:'10', CD_ADRS_ZIP:'1030', TX_ADRS_REFNIS_NM:'Schaerbeek',
    NR_GRP:'202613605', NR_YEAR:'2026', NR_WAVE:'1', NR_SEQ:'001', NR_REF_WK:'36' },
  { NR_HH:'002', FL_MB_CNTCT:'1', TX_MB_NM_FST:'Luc', TX_MB_NM_LST:'Peeters', TX_DBENQ_GRP:'2026-13605',
    MS_MB_AGE:'30', TX_ADRS_USTR_NM:'Avenue Rogier', CD_ADRS_HS:'5', CD_ADRS_ZIP:'1030', TX_ADRS_REFNIS_NM:'Schaerbeek',
    NR_GRP:'202613605', NR_YEAR:'2026', NR_WAVE:'1', NR_SEQ:'001', NR_REF_WK:'36' },
];

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const perr = [];

  // ── Convertisseur : produit les CSV enquête selon le séparateur réglé ──
  const conv = await b.newPage();
  conv.on('pageerror', e => perr.push('conv: ' + e.message));
  await conv.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await conv.waitForTimeout(300);

  const r = await conv.evaluate((rows) => {
    const setSep = v => localStorage.setItem('statbel_settings', JSON.stringify({ csvSep: v }));
    const res = convertir(rows);
    const out = {};
    // 1) « ; »
    setSep(';');
    out.semi = toCsv(res.outEnquete, CSV_HEADERS_ENQUETE);
    // 2) « , »
    setSep(',');
    out.comma = toCsv(res.outEnquete, CSV_HEADERS_ENQUETE);
    // 3) auto
    setSep('auto');
    out.autoSep = csvSepExport();
    out.regional = csvSepRegional();
    out.autoCsvFirstLine = toCsv(res.outEnquete, CSV_HEADERS_ENQUETE).split('\n')[0];
    // Données de contrôle
    out.headerSemi = out.semi.split('\n')[0];
    out.headerComma = out.comma.split('\n')[0];
    out.bodySemi = out.semi.split('\n').slice(1).join('\n');
    out.nbRef = res.outEnquete.length;
    return out;
  }, GRP);

  A(r.nbRef === 2, `2 référents (ménages) exportés (got ${r.nbRef})`);
  // 1) séparateur « ; »
  A(r.headerSemi.includes(';') && !/,/.test(r.headerSemi.replace(/"[^"]*"/g, '')),
    'csvSep=";" : en-tête joint par « ; » (pas de « , » hors guillemets)');
  // La rue « Rue A; coin B » contient « ; » → doit être entre guillemets
  A(/"Rue A; coin B[^"]*"/.test(r.bodySemi), 'csvSep=";" : cellule contenant « ; » mise entre guillemets');
  // 2) séparateur « , »
  A(r.headerComma.includes(',') && !r.headerComma.includes(';'),
    'csvSep="," : en-tête joint par « , »');
  // 3) auto == régional
  A(r.autoSep === r.regional && (r.autoSep === ';' || r.autoSep === ','),
    `csvSep="auto" suit la logique régionale (auto="${r.autoSep}", régional="${r.regional}")`);
  A(r.autoCsvFirstLine.includes(r.autoSep), 'csvSep="auto" : l\'export utilise bien le séparateur régional');
  await conv.close();

  // ── Interviews : parseCSV relit l'export « ; » + BOM sans erreur ──
  const iv = await b.newPage();
  iv.on('pageerror', e => perr.push('iv: ' + e.message));
  await iv.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await iv.waitForTimeout(400);

  const csvSemiBom = '﻿' + r.semi;   // tel que téléchargé (BOM UTF-8 + « ; »)
  const imp = await iv.evaluate((csv) => {
    const p = parseCSV(csv);              // fonction d'import d'Interviews (pont global)
    if (!p) return { ok: false };
    const byName = n => p.rows.find(x => x.nom === n) || {};
    return {
      ok: true,
      importees: p.stats.importees,
      reconnues: p.stats.reconnues,
      dubois: { taille: byName('Dubois').taille_menage, cibles: byName('Dubois').nb_cibles, adr: byName('Dubois').adresse },
      peeters: { taille: byName('Peeters').taille_menage, cibles: byName('Peeters').nb_cibles },
    };
  }, csvSemiBom);

  A(imp.ok && imp.importees === 2, `Interviews importe les 2 ménages depuis un CSV « ; » + BOM (got ${imp.importees})`);
  A(imp.reconnues && imp.reconnues.includes('taille_menage') && imp.reconnues.includes('nb_cibles'),
    `colonnes taille_menage + nb_cibles reconnues (got ${JSON.stringify(imp.reconnues)})`);
  A(imp.dubois.taille === 2 && imp.dubois.cibles === 2, `ménage Dubois : taille=2, cibles≥15=2 (got ${imp.dubois.taille}/${imp.dubois.cibles})`);
  A(imp.peeters.taille === 1 && imp.peeters.cibles === 1, `ménage Peeters : taille=1, cibles≥15=1 (got ${imp.peeters.taille}/${imp.peeters.cibles})`);
  A(/coin B/.test(imp.dubois.adr || ''), `cellule échappée « ; » relue correctement (adresse="${imp.dubois.adr}")`);
  await iv.close();

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
