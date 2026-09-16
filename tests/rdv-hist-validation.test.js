/*
 * Test de non-régression — bug M4 : le RDV d'une entrée d'historique n'était pas
 * validé au CALENDRIER (contrairement à la date, via changerDateHistorique).
 *
 * modifierRdvHistorique validait le FORMAT (jj/mm/aaaa [hh:mm]) mais pas la validité
 * du jour : « 31/02/2026 » passait → stocké « 2026-02-31 » → formatRdv le décalait au
 * 3 mars (RDV silencieusement faux, propagé au calendrier, à la vue Suivi et aux
 * rappels envoyés au répondant). Le correctif ajoute jourValide.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/rdv-hist-validation.test.js
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
  let dialogs = 0;
  p.on('dialog', d => { dialogs++; d.accept(); });   // les dates invalides déclenchent alert()
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const r = await p.evaluate(() => {
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes['E'] = [{
      ordre:'1', nom:'Martin', prenom:'Alice', adresse:'Rue A 1 1000 Bxl',
      statut:'In progress', historique:[{ statut:'In progress', date:'', rdv:'2026-01-15 10:00' }],
    }];
    enqueteActive = 'E';
    const rdv = () => (contacts()[0].historique[0] || {}).rdv;
    const out = {};
    modifierRdvHistorique(0, 0, '31/02/2026 14:30'); out.afterFeb31   = rdv();   // impossible → rejeté
    modifierRdvHistorique(0, 0, '28/02/2026 14:30'); out.afterValid   = rdv();   // valide
    modifierRdvHistorique(0, 0, '29/02/2023 09:00'); out.afterNonLeap = rdv();   // 2023 non bissextile → rejeté
    modifierRdvHistorique(0, 0, '29/02/2024 09:00'); out.afterLeap    = rdv();   // 2024 bissextile → valide
    modifierRdvHistorique(0, 0, '32/01/2026');       out.afterDay32   = rdv();   // jour 32 → rejeté
    modifierRdvHistorique(0, 0, '15/03/2026');       out.afterDateOnly= rdv();   // valide, sans heure
    return out;
  });

  A(r.afterFeb31 === '2026-01-15 10:00', `31/02 rejeté : RDV inchangé (got « ${r.afterFeb31} »)`);
  A(r.afterValid === '2026-02-28 14:30', `28/02 valide : RDV enregistré (got « ${r.afterValid} »)`);
  A(r.afterNonLeap === '2026-02-28 14:30', `29/02/2023 rejeté : RDV inchangé (got « ${r.afterNonLeap} »)`);
  A(r.afterLeap === '2024-02-29 09:00', `29/02/2024 (bissextile) valide (got « ${r.afterLeap} »)`);
  A(r.afterDay32 === '2024-02-29 09:00', `jour 32 rejeté : RDV inchangé (got « ${r.afterDay32} »)`);
  A(r.afterDateOnly === '2026-03-15', `date valide sans heure enregistrée (got « ${r.afterDateOnly} »)`);
  A(dialogs === 3, `3 dates invalides ont déclenché une alerte (got ${dialogs})`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
