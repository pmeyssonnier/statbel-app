/*
 * Test de non-régression — Convertisseur : formats & liens dans le tableau Aperçu.
 *
 *  1. Date de naissance affichée en JJ/MM/AAAA (donnée stockée/exportée = ISO, inchangée).
 *  2. E-mail = lien mailto: (ouvre le client mail).
 *  3. Téléphone affiché « +32 xxx xx xx xx » + liens tel: (appel) et sms:.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-contact-format.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

const GRP = [
  { NR_HH:'001', FL_MB_CNTCT:'1', TX_MB_NM_FST:'Jean', TX_MB_NM_LST:'Dubois', TX_DBENQ_GRP:'2026-13605',
    MS_MB_AGE:'40', DT_MB_BTH:'12-04-1985', CD_MB_SEX:'1',
    TX_ADRS_USTR_NM:'Rue A', CD_ADRS_HS:'10', CD_ADRS_ZIP:'1030', TX_ADRS_REFNIS_NM:'Schaerbeek',
    NR_PHONE:'0470 100000', TX_EMAIL:'Jean.Dubois@Example.BE',
    NR_GRP:'202613605', NR_YEAR:'2026', NR_WAVE:'1', NR_SEQ:'001', NR_REF_WK:'36' },
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
    const out = {};
    // Helpers de formatage (unités)
    out.tel_0470   = telBE('0470 100000');
    out.tel_intl   = telBE('+32 470 12 34 56');
    out.tel_land   = telBE('02 123 45 67');
    out.tel_empty  = telBE('');
    out.naiss      = fmtDateNaiss('1985-04-12');
    out.naiss_bad  = fmtDateNaiss('');

    // Rendu réel du tableau Aperçu
    const res = convertir(rows);
    res.structureWarn = [];
    sources[res.grpId] = { res, fileName: 'x.xlsx' };
    sourceActive = res.grpId;
    afficher(res);
    out.body = document.getElementById('bodyCibles').innerHTML;
    return out;
  }, GRP);

  // 1. Téléphone
  A(r.tel_0470 && r.tel_0470.e164 === '+32470100000' && r.tel_0470.disp === '+32 470 10 00 00',
    `telBE('0470 100000') → +32470100000 / « +32 470 10 00 00 » (got ${JSON.stringify(r.tel_0470)})`);
  A(r.tel_intl && r.tel_intl.e164 === '+32470123456', `telBE gère le préfixe +32 (got ${r.tel_intl && r.tel_intl.e164})`);
  A(r.tel_land && r.tel_land.e164 === '+3221234567' && r.tel_land.disp === '+32 21 23 45 67',
    `telBE fixe 8 chiffres → groupé 2-2-2-2 (got ${JSON.stringify(r.tel_land)})`);
  A(r.tel_empty === null, 'telBE(vide) → null');
  A(/href="tel:\+32470100000"/.test(r.body), 'tableau : lien tel: (appel) présent');
  A(/href="sms:\+32470100000"/.test(r.body), 'tableau : lien sms: présent');
  A(/\+32 470 10 00 00/.test(r.body), 'tableau : téléphone affiché « +32 470 10 00 00 »');
  // Liens « nus » : action conservée mais pas d'apparence d'URL (classe lien-nu).
  A(/class="lien-nu" href="tel:/.test(r.body), 'tableau : lien tel: sans style d\'URL (classe lien-nu)');
  A(/class="lien-nu" href="mailto:/.test(r.body), 'tableau : lien mailto: sans style d\'URL (classe lien-nu)');

  // 2. E-mail — affiché et lié en MINUSCULES, même si la source est en casse mixte
  A(r.naiss === '12/04/1985' && r.naiss_bad === '', `fmtDateNaiss ISO→JJ/MM/AAAA (got "${r.naiss}")`);
  A(/href="mailto:jean\.dubois@example\.be"/.test(r.body), 'tableau : e-mail en minuscules dans mailto:');
  A(/>jean\.dubois@example\.be</.test(r.body), 'tableau : e-mail affiché en minuscules');
  A(!/Example\.BE/.test(r.body), 'tableau : aucune casse mixte d\'e-mail affichée');

  // 3. Date de naissance dans le détail du ménage
  A(/12\/04\/1985/.test(r.body), 'détail ménage : date de naissance affichée en JJ/MM/AAAA');
  A(!/1985-04-12/.test(r.body), 'aucune date ISO brute affichée dans le tableau');

  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
