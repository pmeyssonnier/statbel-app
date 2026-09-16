/*
 * Test de non-régression — bug M3 : Convertisseur `convertirDate` trop strict.
 *
 * Avant, la fonction ne gérait que JJ-MM-AAAA (tirets, jour d'abord) :
 *   - une date ISO « 1985-04-12 » → « 2012-04-1985 » (jour = 1985 !) ;
 *   - une date à slashs « 12/04/1985 » → '' (perdue) ;
 *   - aucune validation calendaire → « 31-02-1985 » → « 1985-02-31 » (impossible).
 * Or un aller-retour Excel réécrit souvent la date en ISO ou en slashs.
 *
 * Le correctif accepte « - » et « / », l'ordre JJ-MM-AAAA comme AAAA-MM-JJ, et
 * VALIDE la date (jour/mois impossibles → '').
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-date-parse.test.js
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
    const f = v => convertirDate(v);
    return {
      natif:     f('12-04-1985'),   // JJ-MM-AAAA (format GRP natif)
      slash:     f('12/04/1985'),   // JJ/MM/AAAA (slashs)
      iso:       f('1985-04-12'),   // AAAA-MM-JJ (Excel a réécrit en ISO)
      isoSlash:  f('1985/04/12'),   // AAAA/MM/JJ
      feb31:     f('31-02-1985'),   // 31 février → impossible
      badMonth:  f('45-13-1985'),   // jour et mois impossibles
      leapOk:    f('29-02-2024'),   // 2024 bissextile → valide
      leapKo:    f('29-02-2023'),   // 2023 non bissextile → invalide
      year2ok:   f('12-04-85'),     // année 2 chiffres → pivot 1985
      year2now:  f('12-04-20'),     // → 2020
      vide:      f(''),
      diese:     f('##/##/####'),
      garbage:   f('abc'),
    };
  });

  A(r.natif    === '1985-04-12', `JJ-MM-AAAA natif → ISO (got « ${r.natif} »)`);
  A(r.slash    === '1985-04-12', `JJ/MM/AAAA (slashs) → ISO (got « ${r.slash} »)`);
  A(r.iso      === '1985-04-12', `AAAA-MM-JJ ISO conservé, pas mutilé (got « ${r.iso} »)`);
  A(r.isoSlash === '1985-04-12', `AAAA/MM/JJ → ISO (got « ${r.isoSlash} »)`);
  A(r.feb31    === '',           `31 février → rejeté (got « ${r.feb31} »)`);
  A(r.badMonth === '',           `jour/mois impossibles → rejeté (got « ${r.badMonth} »)`);
  A(r.leapOk   === '2024-02-29', `29/02/2024 (bissextile) → valide (got « ${r.leapOk} »)`);
  A(r.leapKo   === '',           `29/02/2023 (non bissextile) → rejeté (got « ${r.leapKo} »)`);
  A(r.year2ok  === '1985-04-12', `année 2 chiffres « 85 » → 1985 (got « ${r.year2ok} »)`);
  A(r.year2now === '2020-04-12', `année 2 chiffres « 20 » → 2020 (got « ${r.year2now} »)`);
  A(r.vide === '' && r.diese === '' && r.garbage === '', 'vide / # / non-numérique → ""');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
