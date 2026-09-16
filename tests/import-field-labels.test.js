/*
 * Test de non-régression — bug M1 : libellés de champs manquants dans le détail
 * de la comparaison d'import / restauration.
 *
 * buildCompareHTML affiche « <libellé du champ> : avant → après » pour chaque
 * champ modifié d'un contact apparié. Le libellé venait de `t('field_' + champ)`.
 * Comme `t()` renvoie la CLÉ quand elle est absente (et que le repli `|| champ`
 * est donc mort), les 4 champs sans clé affichaient le jargon interne :
 *   « field_nb_cibles : 2 → 3 »  au lieu de  « Cibles ≥15 : 2 → 3 ».
 * Champs concernés : nb_cibles, collect_method, web_user_id, web_user_pwd.
 *
 * On construit une comparaison où EXACTEMENT ces 4 champs changent (contact
 * apparié) et on vérifie que le HTML porte les libellés traduits, jamais la clé
 * brute — en FR et en NL.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/import-field-labels.test.js
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
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const r = await p.evaluate(() => {
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    // Contact existant vs importé : MÊME identité (apparié), seuls les 4 champs
    // sans clé i18n diffèrent → ils sont tous les 4 dans le détail (slice(0,4)).
    const base = { ordre:'1', nom:'Martin', prenom:'Alice', adresse:'Rue A 1 1000 Bxl' };
    enquetes['Enq'] = [{ ...base, nb_cibles:2, collect_method:'CAPI', web_user_id:'OLD', web_user_pwd:'oldpwd' }];
    const src = { 'Enq': [{ ...base, nb_cibles:3, collect_method:'CATI', web_user_id:'NEW', web_user_pwd:'newpwd' }] };

    settings.lang = 'fr';
    const fr = buildCompareHTML(src, '').html;
    settings.lang = 'nl';
    const nl = buildCompareHTML(src, '').html;
    return { fr, nl };
  });

  const clesBrutes = ['field_nb_cibles', 'field_collect_method', 'field_web_user_id', 'field_web_user_pwd'];
  clesBrutes.forEach(k => A(!r.fr.includes(k), `FR : la clé brute « ${k} » n'apparaît pas`));

  // Libellés traduits attendus (FR)
  [['Cibles ≥15', 'nb_cibles'], ['Méthode de collecte', 'collect_method'],
   ['Identifiant web', 'web_user_id'], ['Mot de passe web', 'web_user_pwd']].forEach(([lib, champ]) =>
    A(r.fr.includes(lib), `FR : libellé « ${lib} » présent pour ${champ}`));

  // NL : pas de clé brute + un libellé traduit témoin
  clesBrutes.forEach(k => A(!r.nl.includes(k), `NL : la clé brute « ${k} » n'apparaît pas`));
  A(r.nl.includes('Verzamelmethode'), 'NL : « Verzamelmethode » (méthode de collecte) présent');
  A(r.nl.includes('Doelpersonen ≥15'), 'NL : « Doelpersonen ≥15 » (cibles) présent');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
