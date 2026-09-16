/*
 * Test de non-régression — bug E4 : un numéro international explicite n'est plus
 * « belgicisé ». Avant, telBE()/formaterGsm() supprimaient le « + »/« 00 » et
 * préfixaient +32 → un numéro étranger (ménage frontalier FR/NL/LU) partait vers
 * un mauvais destinataire (rappel SMS, lien tel:). Ex. telBE('+33 6 12 34 56 78')
 * donnait '+3233612345678'.
 *
 * On vérifie les DEUX implémentations alignées :
 *   - Interviews (js/core/util.js) via construireRappel({canal:'sms'}) — le vrai
 *     chemin du rappel SMS — et via formaterGsm (saisie CAPI) ;
 *   - Convertisseur (js/converter/import-normalisation.js) via telBE() (global).
 * Les cas belges (0…, 32…, +32…, 0032…) restent inchangés.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/tel-intl.test.js
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
  p.on('dialog', d => d.accept());

  // ── Interviews : chemin réel du rappel SMS + saisie CAPI ────────────────
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);
  const iv = await p.evaluate(() => {
    const smsNum = gsm => {
      const href = construireRappel({ contact: { collect_method: 'CATI', gsm, prenom: 'X' }, canal: 'sms' }).href;
      return href.slice(4).split('?')[0];   // 'sms:' + num + '?...'
    };
    return {
      be_nat:  smsNum('0470 12 34 56'),        // belge national
      be_intl: smsNum('+32 470 12 34 56'),     // belge international
      be_00:   smsNum('0032 2 123 45 67'),     // belge 0032 (fixe)
      fr_plus: smsNum('+33 6 12 34 56 78'),    // étranger +33
      fr_00:   smsNum('0033 6 12 34 56 78'),   // étranger 0033
      nl_plus: smsNum('+31 6 12345678'),       // étranger +31
      fmt_be:  formaterGsm('0470123456'),      // saisie CAPI belge
      fmt_fr:  formaterGsm('0033 6 12 34 56 78'), // saisie CAPI étranger
    };
  });

  A(iv.be_nat === '+32470123456', `SMS belge national → +32470123456 (got ${iv.be_nat})`);
  A(iv.be_intl === '+32470123456', `SMS belge +32 → +32470123456 (got ${iv.be_intl})`);
  A(iv.be_00 === '+3221234567', `SMS belge 0032 → +3221234567 (got ${iv.be_00})`);
  A(iv.fr_plus === '+33612345678', `SMS étranger +33 conservé (got ${iv.fr_plus})`);
  A(iv.fr_00 === '+33612345678', `SMS étranger 0033 → +33… (got ${iv.fr_00})`);
  A(iv.nl_plus === '+31612345678', `SMS étranger +31 conservé (got ${iv.nl_plus})`);
  A(iv.fmt_be.startsWith('+32 470'), `formaterGsm belge → +32 470… (got ${iv.fmt_be})`);
  A(iv.fmt_fr.startsWith('+33'), `formaterGsm étranger non belgicisé (got ${iv.fmt_fr})`);

  // ── Convertisseur : telBE() (script classique global) ───────────────────
  await p.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);
  const cv = await p.evaluate(() => ({
    fr:   telBE('+33 6 12 34 56 78'),
    be:   telBE('+32 470 12 34 56'),
    be00: telBE('0032 2 123 45 67'),
    fr00: telBE('0033 6 12 34 56 78'),
    nat:  telBE('0470 100000'),
    vide: telBE(''),
  }));

  A(cv.fr && cv.fr.e164 === '+33612345678', `Conv. telBE(+33) conservé (got ${cv.fr && cv.fr.e164})`);
  A(cv.be && cv.be.e164 === '+32470123456', `Conv. telBE(+32) → +32470123456 (got ${cv.be && cv.be.e164})`);
  A(cv.be00 && cv.be00.e164 === '+3221234567', `Conv. telBE(0032) belge (got ${cv.be00 && cv.be00.e164})`);
  A(cv.fr00 && cv.fr00.e164 === '+33612345678', `Conv. telBE(0033) → +33… (got ${cv.fr00 && cv.fr00.e164})`);
  A(cv.nat && cv.nat.e164 === '+32470100000' && cv.nat.disp === '+32 470 10 00 00',
    `Conv. telBE national belge inchangé (got ${JSON.stringify(cv.nat)})`);
  A(cv.vide === null, 'Conv. telBE(vide) → null');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
