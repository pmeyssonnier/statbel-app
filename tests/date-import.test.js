/*
 * Test de non-régression — normalisation des dates à l'import (app Interviews)
 *
 * Bug : après un export CSV/XLSX puis correction dans Excel, Excel réécrit
 * silencieusement les dates ISO (AAAA-MM-JJ) au format local (JJ/MM/AAAA). Au
 * ré-import, birth_date ne matchait plus le contrôle strict `^\d{4}-\d{2}-\d{2}$`
 * → « erreur de format date 📅 » et exclusion possible de la ligne.
 *
 * Correctif : parseCSV re-normalise birth_date → ISO, et date/rdv → JJ/MM/AAAA,
 * en tolérant les formats qu'Excel réinjecte (jour d'abord, Europe).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/date-import.test.js
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
  await p.waitForTimeout(500);

  const r = await p.evaluate(async () => {
    const out = {};

    // — CSV « sorti d'Excel » : birth_date en JJ/MM/AAAA (Excel a réécrit l'ISO),
    //   date d'interview en ISO (autre réécriture Excel), rdv en ISO + heure.
    const csvExcel =
      'order,first_name,last_name,address,status,interview_date,appointment,birth_date,history\n' +
      '1,Jean,Dupont,"Rue A, 1000 Bruxelles",Done,2026-08-10,2026-08-11 09:30,10/08/1990,"Done@2026-08-10"\n' +
      // variantes de séparateur qu'Excel peut produire
      '2,Anne,Martin,"Rue B, 1000 Bruxelles",To do,,,7-3-85,\n';
    const parsed = parseCSV(csvExcel);
    const c1 = parsed.rows[0], c2 = parsed.rows[1];

    // birth_date re-canonicalisé en ISO
    out.bd1 = c1.birth_date;                                   // attendu 1990-08-10
    out.bd2 = c2.birth_date;                                   // attendu 1985-03-07 (2 chiffres → 19xx)
    out.bd1_coherent = !valeurIncoherente('birth_date', c1.birth_date);
    out.bd1_not_error = !recordEnErreur(c1);                   // plus « en erreur »

    // date d'interview & rdv ramenés en JJ/MM/AAAA[ HH:mm]
    out.date1 = c1.date;                                       // attendu 10/08/2026
    out.rdv1  = c1.rdv;                                        // attendu 11/08/2026 09:30
    out.hist1 = c1.historique && c1.historique[0].date;       // attendu 10/08/2026

    // — Aller-retour natif de l'app : un birth_date ISO reste stable, une date
    //   FR reste stable (idempotence, pas de régression).
    settings.statuts = [{ label: 'To do', done: false, rdv: false }, { label: 'Done', done: true, rdv: false }];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.E = [{ ordre: '1', nom: 'T', prenom: 'A', adresse: 'Rue X, 1000 Bruxelles',
                    statut: 'Done', date: '10/08/2026', birth_date: '1990-08-10', historique: [] }];
    enqueteActive = 'E';
    const rt = parseCSV(genererCSV()).rows[0];
    out.rt_bd   = rt.birth_date;     // 1990-08-10 inchangé
    out.rt_date = rt.date;           // 10/08/2026 inchangé

    // — Une vraie date invalide reste signalée (on n'a pas relâché le contrôle)
    out.bad_still_flagged = valeurIncoherente('birth_date', '31/02/2026'); // 31 février → true

    return out;
  });

  A(r.bd1 === '1990-08-10', `birth_date JJ/MM/AAAA « 10/08/1990 » → ISO « ${r.bd1} »`);
  A(r.bd2 === '1985-03-07', `birth_date « 7-3-85 » (2 chiffres, tiret) → ISO « ${r.bd2} »`);
  A(r.bd1_coherent, 'birth_date normalisé passe le contrôle de cohérence');
  A(r.bd1_not_error, 'la ligne n\'est plus marquée « en erreur » (plus d\'exclusion)');
  A(r.date1 === '10/08/2026', `date d'interview ISO « 2026-08-10 » → FR « ${r.date1} »`);
  A(r.rdv1 === '11/08/2026 09:30', `rdv ISO+heure → « ${r.rdv1} » (heure préservée)`);
  A(r.hist1 === '10/08/2026', `date d'historique ISO → FR « ${r.hist1} »`);
  A(r.rt_bd === '1990-08-10', `round-trip natif : birth_date ISO inchangé « ${r.rt_bd} »`);
  A(r.rt_date === '10/08/2026', `round-trip natif : date FR inchangée « ${r.rt_date} »`);
  A(r.bad_still_flagged, 'une date calendairement invalide (31/02) reste signalée');
  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
