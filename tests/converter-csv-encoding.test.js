/*
 * Test de non-régression — bug M9 : le Convertisseur lisait TOUT CSV en ISO-8859-1.
 *
 * Un CSV UTF-8 (ex. ré-import d'un export de l'app, souvent avec BOM) décodé en
 * Latin-1 donnait du mojibake : « Café » → « CafÃ© », « François » → « FranÃ§ois ».
 * decoderCsv choisit désormais : BOM UTF-8 → UTF-8 ; octets UTF-8 valides → UTF-8 ;
 * sinon repli ISO-8859-1 (format GRP Statbel historique).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-csv-encoding.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const r = await p.evaluate(() => {
    if (typeof decoderCsv !== 'function') return { missing: true };
    const enc = new TextEncoder();   // UTF-8
    const buf = arr => new Uint8Array(arr).buffer;

    // UTF-8 AVEC BOM
    const utf8Bom = buf([0xEF, 0xBB, 0xBF, ...enc.encode('François;Café')]);
    // UTF-8 SANS BOM mais valide
    const utf8 = enc.encode('Mélanie;Église').buffer;
    // ISO-8859-1 : « Café » = 43 61 66 E9 (E9 seul = UTF-8 invalide → repli Latin-1)
    const latin1 = buf([0x43, 0x61, 0x66, 0xE9]);
    // Octets UTF-8 de « Café » (43 61 66 C3 A9) : l'ANCIEN code (Latin-1) donnait « CafÃ© »
    const utf8Cafe = enc.encode('Café').buffer;

    return {
      bom: decoderCsv(utf8Bom),
      bomStartsWithBom: decoderCsv(utf8Bom).charCodeAt(0) === 0xFEFF,
      noBom: decoderCsv(utf8),
      latin1: decoderCsv(latin1),
      utf8Cafe: decoderCsv(utf8Cafe),
    };
  });

  A(!r.missing, 'decoderCsv est exposée');
  A(r.bom === 'François;Café', `UTF-8 + BOM → accents corrects (got « ${r.bom} »)`);
  A(r.bomStartsWithBom === false, 'UTF-8 + BOM : le BOM (U+FEFF) est retiré');
  A(r.noBom === 'Mélanie;Église', `UTF-8 sans BOM → accents corrects (got « ${r.noBom} »)`);
  A(r.latin1 === 'Café', `ISO-8859-1 (GRP historique) → accents corrects (got « ${r.latin1} »)`);
  A(r.utf8Cafe === 'Café', `octets UTF-8 « Café » → « Café », pas « CafÃ© » (got « ${r.utf8Cafe} »)`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
