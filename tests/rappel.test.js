/*
 * Test de non-régression — rappel e-mail / SMS pour les contacts CATI/CAWI.
 *
 *   1. Import d'un CSV « cibles » CAWI (avec TX_WEB_USER_ID / TX_WEB_USER_PSWRD) :
 *      - les identifiants web sont reconnus et stockés (web_user_id / web_user_pwd) ;
 *      - construireRappel(c,'mail') → href mailto: dont le corps contient le lien
 *        configuré (settings.cawiUrl), l'identifiant et le mot de passe ;
 *      - construireRappel(c,'sms')  → href sms: avec l'E.164 et le même corps ;
 *      - buildEditForm émet les deux boutons de rappel (e-mail + SMS) ;
 *      - round-trip : genererCSV ré-émet TX_WEB_USER_ID / TX_WEB_USER_PSWRD.
 *   2. Import CATI (méthode téléphonique) : le corps est un rappel « par téléphone »,
 *      SANS identifiants ni lien (même si des identifiants existent sur la fiche) ;
 *      sujet CATI.
 *   3. Import CAPI (aucune méthode) : buildEditForm N'émet PAS les boutons de rappel.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/rappel.test.js
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
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    const importer = (nom, csv) => {
      const parsed = parseCSV(csv);
      ouvrirModalImport(parsed, nom);
      document.getElementById('inputNomEnquete').value = nom;
      // Chaque enquête a son vocabulaire de statuts ; l'aperçu valide contre
      // l'enquête ACTIVE. Comme on importe des enquêtes indépendantes à la suite,
      // on désactive « n'importer que les corrects » pour ne pas écarter un statut
      // valide dans sa propre enquête mais absent du vocabulaire actif.
      const chk = document.getElementById('chkOnlyValid'); if (chk) chk.checked = false;
      confirmerImport();
    };
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    settings.statutsParEnquete = {};
    settings.lang = 'fr';   // message déterministe (headless = en-US sinon)
    settings.cawiUrl = 'https://blaise.economie.fgov.be/lfspanel2026/';

    // 1. Enquête CAWI — identifiants web présents
    importer('Lot CAWI',
      'order,first_name,last_name,address,status,CD_WSH_CLCT_MTHD,TX_WEB_USER_ID,TX_WEB_USER_PSWRD,phone,email\n' +
      '1,Alice,Martin,Rue 1,To do,CAWI,user12345,pXXssWord9,465812582,alice@example.be\n');
    const cawi = enquetes['Lot CAWI'][0];
    const mail = construireRappel(cawi, 'mail');
    const sms  = construireRappel(cawi, 'sms');
    const cawiForm = buildEditForm(0);        // enquête active = Lot CAWI
    const csvOut = genererCSV();

    // 2. Enquête CATI — identifiants présents mais méthode téléphonique
    importer('Lot CATI',
      'order,first_name,last_name,address,status,CD_WSH_CLCT_MTHD,TX_WEB_USER_ID,TX_WEB_USER_PSWRD,phone,email\n' +
      '1,Bob,Durand,Rue 2,To do,CATI,catiuser,catipwd,499112233,bob@example.be\n');
    const cati = enquetes['Lot CATI'][0];
    const catiMail = construireRappel(cati, 'mail');

    // 3. Enquête CAPI — aucune méthode
    importer('Lot CAPI',
      'order,first_name,last_name,address,status,phone,email\n' +
      '1,Carla,Neyt,Rue 3,To do,478556677,carla@example.be\n');
    const capiForm = buildEditForm(0);        // enquête active = Lot CAPI

    return {
      uid: cawi.web_user_id, pwd: cawi.web_user_pwd,
      mailHref: mail.href, mailBody: mail.body, mailSubject: mail.subject,
      smsHref: sms.href, smsBody: sms.body,
      cawiFormHasMail: /envoyerRappel\(0,'mail'\)/.test(cawiForm),
      cawiFormHasSms:  /envoyerRappel\(0,'sms'\)/.test(cawiForm),
      csvHasCredHeader: /TX_WEB_USER_ID/.test(csvOut) && /TX_WEB_USER_PSWRD/.test(csvOut),
      csvHasCredValue:  csvOut.split('\n').some(l => /user12345/.test(l) && /pXXssWord9/.test(l)),
      catiBody: catiMail.body, catiSubject: catiMail.subject,
      capiFormHasRappel: /envoyerRappel\(/.test(capiForm),
    };
  });

  // 1. CAWI
  A(r.uid === 'user12345' && r.pwd === 'pXXssWord9',
    `identifiants web importés (got ${r.uid}/${r.pwd})`);
  A(r.mailHref.startsWith('mailto:alice@example.be?'), 'CAWI : href mailto: vers l\'e-mail du contact');
  A(r.mailBody.includes('blaise.economie.fgov.be/lfspanel2026') &&
    r.mailBody.includes('user12345') && r.mailBody.includes('pXXssWord9'),
    'CAWI : le corps contient le lien, l\'identifiant et le mot de passe');
  A(r.mailSubject === 'Rappel — enquête Statbel à compléter', `CAWI : sujet « à compléter » (got ${r.mailSubject})`);
  A(r.smsHref.startsWith('sms:+32465812582?') && r.smsBody === r.mailBody,
    'CAWI : href sms: avec l\'E.164 et le même corps');
  A(r.cawiFormHasMail && r.cawiFormHasSms, 'CAWI : buildEditForm émet les boutons de rappel e-mail + SMS');
  A(r.csvHasCredHeader, 'round-trip : genererCSV ré-émet les en-têtes TX_WEB_USER_ID / TX_WEB_USER_PSWRD');
  A(r.csvHasCredValue, 'round-trip : les identifiants sont ré-exportés');

  // 2. CATI
  A(/téléphone/.test(r.catiBody), 'CATI : rappel « par téléphone »');
  A(!r.catiBody.includes('catiuser') && !r.catiBody.includes('catipwd') &&
    !r.catiBody.includes('lfspanel2026'),
    'CATI : aucun identifiant ni lien web dans le corps');
  A(r.catiSubject === 'Rappel — entretien téléphonique Statbel', `CATI : sujet « entretien téléphonique » (got ${r.catiSubject})`);

  // 3. CAPI
  A(!r.capiFormHasRappel, 'CAPI : aucun bouton de rappel (méthode absente)');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
