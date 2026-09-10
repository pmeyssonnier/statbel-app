/*
 * Test de non-régression — Convertisseur : capture des colonnes GRP
 * CD_WSH_CLCT_MTHD (méthode de collecte souhaitée) + TX_WEB_USER_ID /
 * TX_WEB_USER_PSWRD (identifiants d'accès web du ménage).
 *
 * Elles doivent être : lues par convertir() sur le référent (outCibles), et
 * présentes dans l'export « enquête » (en-têtes = noms de colonnes GRP conservés).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-import-fields.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

const GRP = [
  { NR_HH:'001', FL_MB_CNTCT:'1', TX_MB_NM_FST:'Jean', TX_MB_NM_LST:'Dubois', TX_DBENQ_GRP:'2026-13605',
    MS_MB_AGE:'40', TX_ADRS_REFNIS_NM:'Schaerbeek', CD_ADRS_ZIP:'1030',
    CD_WSH_CLCT_MTHD:'CAWI', TX_WEB_USER_ID:'user12345', TX_WEB_USER_PSWRD:'p@ss-Word!9',
    NR_GRP:'202613605', NR_YEAR:'2026', NR_WAVE:'1', NR_SEQ:'001', NR_REF_WK:'36' },
  // 2e membre (non-référent) : ne doit pas empêcher la capture sur le référent
  { NR_HH:'001', FL_MB_CNTCT:'0', TX_MB_NM_FST:'Marie', TX_MB_NM_LST:'Dubois', TX_DBENQ_GRP:'2026-13605',
    MS_MB_AGE:'16', TX_ADRS_REFNIS_NM:'Schaerbeek', NR_GRP:'202613605', NR_YEAR:'2026', NR_WAVE:'1', NR_SEQ:'001', NR_REF_WK:'36' },
];

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const r = await p.evaluate((rows) => {
    const res = convertir(rows);
    const c = res.outCibles[0] || {};
    const csv = toCsv(res.outEnquete, CSV_HEADERS_ENQUETE);
    const header = csv.split('\n')[0];
    const body = csv.split('\n').slice(1).join('\n');
    return {
      collect: c.collect_method, uid: c.web_user_id, pwd: c.web_user_pwd,
      header, body,
      inHeaders: CSV_HEADERS.includes('collect_method') && CSV_HEADERS.includes('web_user_id') && CSV_HEADERS.includes('web_user_pwd'),
    };
  }, GRP);

  A(r.collect === 'CAWI', `méthode de collecte captée sur le référent (got "${r.collect}")`);
  A(r.uid === 'user12345', `TX_WEB_USER_ID capté (got "${r.uid}")`);
  A(r.pwd === 'p@ss-Word!9', `TX_WEB_USER_PSWRD capté (got "${r.pwd}")`);
  A(/CD_WSH_CLCT_MTHD/.test(r.header) && /TX_WEB_USER_ID/.test(r.header) && /TX_WEB_USER_PSWRD/.test(r.header),
    'export enquête : en-têtes GRP présents');
  A(/user12345/.test(r.body) && /p@ss-Word!9|"p@ss-Word!9"/.test(r.body) && /CAWI/.test(r.body),
    'export enquête : valeurs présentes dans la ligne');
  A(r.inHeaders, 'colonnes ajoutées aussi à l\'export « cibles » (CSV_HEADERS)');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
