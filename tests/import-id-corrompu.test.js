/*
 * Test de non-régression — garde-fou d'import : identifiant web en NOTATION
 * SCIENTIFIQUE (app Interviews, index.html).
 *
 * Un TX_WEB_USER_ID numérique long cassé par un tableur (« 2.02612E+11 ») a perdu
 * sa précision : on ne peut pas le réparer. parseCSV doit le SIGNALER dans
 * stats.idsCorrompus, et l'aperçu d'import doit afficher un avertissement (role=alert)
 * pour que l'enquêteur réimporte depuis le .xlsx d'origine plutôt que d'envoyer un
 * login CAWI inutilisable. Un CSV sain ne déclenche rien.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/import-id-corrompu.test.js
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
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    try { settings.lang = 'fr'; } catch (e) {}
    const out = {};
    const H = 'order,first_name,last_name,address,TX_WEB_USER_ID,TX_WEB_USER_PSWRD\n';

    // 1) Deux ID cassés (scientifique) + un mot de passe cassé + une ligne saine.
    const bad = H +
      '1,Furkan,Kilic,Rue X 1,2.02612E+11,R847X714\n' +   // ID cassé
      '2,Nisreen,Alm,Rue Y 2,202612305002,Q2HVJ5DR\n' +   // ID entier long = sain
      '3,Everson,Bar,Rue Z 3,202612305003,1.5E8\n';        // ID sain, mot de passe cassé (branche pwd)
    const sBad = parseCSV(bad).stats;
    out.badCount = sBad.idsCorrompus.length;                       // attendu 2 (fiches 1 et 3)
    out.badFirst = sBad.idsCorrompus[0] && sBad.idsCorrompus[0].valeur;   // "2.02612E+11"
    out.badOrdres = sBad.idsCorrompus.map(x => x.ordre).join(',');        // "1,3"

    // 2) CSV entièrement sain → aucun signalement.
    const good = H +
      '1,Furkan,Kilic,Rue X 1,202612305001,R847X714\n' +
      '2,Nisreen,Alm,Rue Y 2,202612305002,Q2HVJ5DR\n';
    out.goodCount = parseCSV(good).stats.idsCorrompus.length;      // attendu 0

    // 3) L'aperçu d'import affiche l'avertissement (role=alert + valeur exemple).
    ouvrirModalImport(parseCSV(bad), 'TestEnq');
    const html = document.getElementById('importApercu').innerHTML;
    out.warnRole = /role="alert"/.test(html);
    out.warnValeur = /2\.02612E\+11/.test(html);
    out.warnTitre = /corrompu/i.test(html);
    try { fermerModal(); } catch (e) {}
    return out;
  });

  A(r.badCount === 2, `2 identifiants cassés détectés (got ${r.badCount})`);
  A(r.badFirst === '2.02612E+11', `1re valeur cassée conservée telle quelle (got "${r.badFirst}")`);
  A(r.badOrdres === '1,3', `ordres des fiches concernées (got "${r.badOrdres}")`);
  A(r.goodCount === 0, `CSV sain (ID entiers longs) → aucun signalement (got ${r.goodCount})`);
  A(r.warnRole, 'aperçu d\'import : avertissement role="alert" présent');
  A(r.warnValeur, 'aperçu d\'import : la valeur cassée (exemple) est affichée');
  A(r.warnTitre, 'aperçu d\'import : titre « corrompu » présent');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
