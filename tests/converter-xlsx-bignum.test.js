/*
 * Test de non-régression — Convertisseur : parseXlsx répare la notation
 * scientifique des identifiants numériques longs.
 *
 * Un fichier source .xlsx où TX_WEB_USER_ID est un NOMBRE long (format
 * « Standard ») est rendu « 2.02612E+11 » par SheetJS raw:false (perte de
 * précision). parseXlsx doit récupérer l'entier COMPLET via la valeur brute
 * (raw:true). Les colonnes texte/date restent inchangées.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-xlsx-bignum.test.js
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
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const r = await p.evaluate(() => {
    // Feuille avec un ID web NUMÉRIQUE long + un mot de passe numérique + un code
    // (NR_HH garde ses zéros de tête via le format texte) + une valeur texte normale.
    const ws = XLSX.utils.aoa_to_sheet([
      ['NR_HH', 'TX_WEB_USER_ID', 'TX_WEB_USER_PSWRD', 'TX_MB_NM_LST'],
      ['001', 202612345678, 30071999, 'Dubois'],
    ]);
    // NR_HH en texte pour préserver « 001 » (comme un vrai export)
    ws['A2'] = { t: 's', v: '001' };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    // Ce que raw:false SEUL produirait (pour prouver le bug d'origine)
    const naif = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })[1][1];

    const rows = parseXlsx(buf);
    const row = rows[0] || {};

    // Cas « fichier passé par Excel » : la cellule d'ID est du TEXTE contenant déjà
    // la notation scientifique (aucune valeur brute numérique à récupérer).
    const mkText = (v) => {
      const w = XLSX.utils.aoa_to_sheet([['NR_HH', 'TX_WEB_USER_ID', 'TX_MB_NM_LST'], ['001', 0, 'X']]);
      w['A2'] = { t: 's', v: '001' }; w['B2'] = { t: 's', v };
      const wbk = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wbk, w, 'S');
      return parseXlsx(XLSX.write(wbk, { type: 'array', bookType: 'xlsx' }))[0]['TX_WEB_USER_ID'];
    };

    return {
      naif,                              // "2.02612E+11" attendu
      uid: row['TX_WEB_USER_ID'],
      pwd: row['TX_WEB_USER_PSWRD'],
      hh:  row['NR_HH'],
      nom: row['TX_MB_NM_LST'],
      // texte scientifique RÉCUPÉRABLE (mantisse complète) → entier exact
      textLossless: mkText('3.0071999E+7'),
      // texte scientifique NON récupérable (mantisse tronquée) → reste scientifique
      textLossy: mkText('2.02612E+11'),
      // cellule CAWI : la valeur corrompue est marquée d'un ⚠, la valeur saine est brute
      cellBad: cawiCellule('2.02612E+11'),
      cellOk:  cawiCellule('202612345678'),
    };
  });

  A(/E\+/i.test(r.naif), `pré-condition : raw:false seul casse l'ID (got "${r.naif}")`);
  A(r.uid === '202612345678', `TX_WEB_USER_ID reconstruit en entier complet (got "${r.uid}")`);
  A(r.pwd === '30071999', `mot de passe numérique intact (got "${r.pwd}")`);
  A(r.hh === '001', `NR_HH garde ses zéros de tête (got "${r.hh}")`);
  A(r.nom === 'Dubois', `valeur texte inchangée (got "${r.nom}")`);

  A(r.textLossless === '30071999', `texte scientifique complet reconstruit exactement (got "${r.textLossless}")`);
  A(r.textLossy === '2.02612E+11', `texte scientifique tronqué NON inventé, reste visible (got "${r.textLossy}")`);
  A(/id-sci/.test(r.cellBad) && /⚠/.test(r.cellBad), `cellule CAWI corrompue marquée ⚠ (got "${r.cellBad}")`);
  A(r.cellOk === '202612345678', `cellule CAWI saine affichée telle quelle (got "${r.cellOk}")`);

  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
