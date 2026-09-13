/*
 * Test de non-régression — Convertisseur : garde-fou « identifiant web en notation
 * scientifique » sur une enquête MÉMORISÉE.
 *
 * Le correctif cellTexte (v216) ne répare les ID numériques longs qu'à l'IMPORT.
 * Une enquête importée avant, restaurée depuis IndexedDB, garde ses identifiants
 * cassés (« 2.02612E+11 ») : re-télécharger son CSV ressort des logins CAWI
 * inutilisables. afficher() doit alors montrer un avertissement (role=alert)
 * invitant à ré-importer le .xlsx d'origine. Une enquête saine n'affiche rien.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-sci-id-warn.test.js
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
    const out = {};
    const ligne = (hh, uid, pwd) => ({
      NR_HH: hh, FL_MB_CNTCT: '1', TX_MB_NM_FST: 'Furkan', TX_MB_NM_LST: 'Kilic',
      TX_DBENQ_GRP: '2026-23605', TX_DBENQ_HH: '2026-23605-' + hh, MS_MB_AGE: '30',
      TX_WEB_USER_ID: uid, TX_WEB_USER_PSWRD: pwd, CD_WSH_CLCT_MTHD: 'CAWI',
      TX_ADRS_USTR_NM: 'Rue X', CD_ADRS_HS: '1', CD_ADRS_ZIP: '1030', TX_ADRS_REFNIS_NM: 'Schaerbeek',
    });
    const el = () => document.getElementById('idScientifiqueWarn');

    // 1) ID en notation scientifique (simule une enquête mémorisée pré-correctif).
    afficher(convertir([ligne('001', '2.02612E+11', 'R847X714'), ligne('002', '202612305002', 'Q2HVJ5DR')]));
    out.badVisible = !el().classList.contains('hidden');
    out.badRole = el().getAttribute('role') === 'alert';
    out.badExample = /2\.02612E\+11/.test(el().innerHTML);

    // 2) Mot de passe scientifique, ID sain → détecté aussi.
    afficher(convertir([ligne('001', '202612305001', '1.5E8')]));
    out.pwdVisible = !el().classList.contains('hidden');

    // 3) Enquête saine (ID entiers longs) → pas d'avertissement.
    afficher(convertir([ligne('001', '202612305001', 'R847X714'), ligne('002', '202612305002', 'Q2HVJ5DR')]));
    out.okHidden = el().classList.contains('hidden');
    return out;
  });

  A(r.badVisible, 'enquête mémorisée avec ID scientifique → avertissement affiché');
  A(r.badRole, 'avertissement : role="alert"');
  A(r.badExample, 'avertissement : la valeur cassée (exemple) est affichée');
  A(r.pwdVisible, 'mot de passe web en notation scientifique → détecté aussi');
  A(r.okHidden, 'enquête saine (ID entiers longs) → pas d\'avertissement');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
