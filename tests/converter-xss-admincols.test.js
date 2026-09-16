/*
 * Test de non-régression — bug E5 : XSS persistant via les colonnes
 * administratives du Convertisseur.
 *
 * Les valeurs NR_YEAR / NR_WAVE / NR_SEQ / NR_REF_WK proviennent DIRECTEMENT du
 * fichier importé (CSV/XLSX) et étaient injectées dans #adminCols en innerHTML
 * SANS échappement → un fichier GRP piégé exécutait du HTML/JS, ré-exécuté à
 * chaque réouverture (la source est persistée en IndexedDB). Elles doivent
 * passer par escHtml().
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-xss-admincols.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

const PAYLOAD = '<img src=x onerror="window.__xssE5=1">';
const GRP = [
  { NR_HH:'001', FL_MB_CNTCT:'1', TX_MB_NM_FST:'Jean', TX_MB_NM_LST:'Dubois', TX_DBENQ_GRP:'2026-13605',
    MS_MB_AGE:'40', DT_MB_BTH:'12-04-1985', CD_MB_SEX:'1',
    TX_ADRS_USTR_NM:'Rue A', CD_ADRS_HS:'10', CD_ADRS_ZIP:'1030', TX_ADRS_REFNIS_NM:'Schaerbeek',
    NR_PHONE:'0470 100000', TX_EMAIL:'jean@example.be',
    NR_GRP:'202613605', NR_YEAR:PAYLOAD, NR_WAVE:PAYLOAD, NR_SEQ:'001', NR_REF_WK:'36' },
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
    res.structureWarn = [];
    sources[res.grpId] = { res, fileName: 'x.xlsx' };
    sourceActive = res.grpId;
    afficher(res);
    return { html: document.getElementById('adminCols').innerHTML };
  }, GRP);

  await p.waitForTimeout(250);   // laisse le temps à un éventuel onerror de se déclencher
  const executed = await p.evaluate(() => window.__xssE5 === 1);

  A(executed === false, 'la charge XSS ne s\'exécute PAS (pas de onerror déclenché)');
  A(!/<img src=x onerror=/.test(r.html), 'aucune balise <img> brute injectée dans #adminCols');
  A(/&lt;img src=x onerror=/.test(r.html), 'la valeur NR_* est échappée (&lt;img…) et non interprétée');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
