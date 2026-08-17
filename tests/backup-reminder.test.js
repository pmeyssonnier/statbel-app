/*
 * Test de non-régression — garde-fous backup (app Interviews).
 *
 * Le rappel de sauvegarde est BASÉ SUR LE RISQUE, pas seulement sur le temps :
 *  - une modification persistée lève le drapeau « modifications non sauvegardées » ;
 *  - la bannière ne s'affiche que si (jamais sauvegardé) OU (modifs non
 *    sauvegardées ET dernière sauvegarde ancienne) — un état « propre » ne nag pas ;
 *  - l'export efface le drapeau ; l'info du menu ⋮ signale l'état à risque.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/backup-reminder.test.js
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

  const r = await p.evaluate(async () => {
    const out = {};
    const J = 86400000;
    settings.statuts = [{ label: 'To do', done: false }, { label: 'Done', done: true }];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.G1 = [{ ordre: '1', nom: 'A', prenom: 'a', adresse: 'Rue A, 1000 Bruxelles', statut: 'To do', historique: [] }];
    enqueteActive = 'G1';

    // 1) Une modification persistée lève « dirty »
    localStorage.removeItem('statbel_backup_dirty');
    enquetes.G1[0].statut = 'Done';
    await sauver();
    await new Promise(res => setTimeout(res, 60));
    out.dirtyAfterSave = localStorage.getItem('statbel_backup_dirty') === '1';

    const banner = () => document.getElementById('backupBanner');
    sessionStorage.removeItem('statbel_bkbanner_dismiss');

    // 2) État propre (backup récent, pas de modif) → PAS de bannière
    localStorage.setItem('statbel_last_backup', new Date().toISOString());
    localStorage.removeItem('statbel_backup_dirty');
    majBackupBanner();
    out.hiddenWhenClean = banner().classList.contains('hidden');

    // 3) Modifs non sauvegardées + sauvegarde ancienne (10 j) → bannière affichée
    localStorage.setItem('statbel_last_backup', new Date(Date.now() - 10 * J).toISOString());
    localStorage.setItem('statbel_backup_dirty', '1');
    majBackupBanner();
    out.shownWhenDirtyOld = !banner().classList.contains('hidden');
    out.dirtyMsg = banner().querySelector('.bk-msg').textContent;

    // 4) Jamais sauvegardé + données → bannière affichée
    localStorage.removeItem('statbel_last_backup');
    localStorage.removeItem('statbel_backup_dirty');
    majBackupBanner();
    out.shownWhenNever = !banner().classList.contains('hidden');

    // 5) Info du menu ⋮ en alerte quand modifs non sauvegardées
    localStorage.setItem('statbel_last_backup', new Date().toISOString());
    localStorage.setItem('statbel_backup_dirty', '1');
    majKebabBackupInfo();
    const ki = document.getElementById('kebabBackupInfo');
    out.kebabWarn = ki.classList.contains('warn');
    out.kebabText = ki.textContent;
    return out;
  });

  A(r.dirtyAfterSave, 'une modification persistée lève « modifications non sauvegardées »');
  A(r.hiddenWhenClean, 'état propre (backup récent, rien de changé) → bannière cachée (pas de nag)');
  A(r.shownWhenDirtyOld, 'modifs non sauvegardées + sauvegarde ancienne → bannière affichée');
  A(/10/.test(r.dirtyMsg), `message de risque chiffré (jours) → « ${r.dirtyMsg} »`);
  A(r.shownWhenNever, 'jamais sauvegardé + données → bannière affichée');
  A(r.kebabWarn, `info du menu ⋮ en alerte quand modifs non sauvegardées → « ${r.kebabText} »`);
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
