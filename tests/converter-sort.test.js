/*
 * Test de non-régression — Convertisseur : TOUTES les colonnes du tableau de
 * contacts sont triables, et les colonnes « pays » se trient sur le NOM affiché
 * (traduit) plutôt que sur le code ISO3.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-sort.test.js
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
    // 1) chaque colonne configurable porte le marqueur de tri
    const notSortable = COL_ALL.filter(id => !/class="sortable"/.test(COL_DEFS[id].th));

    const rows = [
      { ordre: '002', prenom: 'Bob', nom: 'Zulu', age: '40', birth_country: 'COD', nationality: 'DEU', web_user_id: '202612305002', taille_menage: '3' },
      { ordre: '001', prenom: 'Ana', nom: 'Alpha', age: '20', birth_country: 'BEL', nationality: 'FRA', web_user_id: '202612305001', taille_menage: '10' },
    ];
    return {
      notSortable,
      ageAsc:  sortRows(rows, 'age', 1).map(x => x.age),          // numérique : 20,40
      menAsc:  sortRows(rows, 'taille_menage', 1).map(x => x.taille_menage), // 3,10 (num, pas lexico)
      natAsc:  sortRows(rows, 'nationality', 1).map(x => x.nationality),      // par NOM : FRA(France) avant DEU(Germany)
      idAsc:   sortRows(rows, 'web_user_id', 1).map(x => x.web_user_id),
    };
  });

  A(r.notSortable.length === 0, `toutes les colonnes sont triables (non triables: ${r.notSortable.join(', ') || 'aucune'})`);
  A(JSON.stringify(r.ageAsc) === JSON.stringify(['20', '40']), `âge trié numériquement (got ${JSON.stringify(r.ageAsc)})`);
  A(JSON.stringify(r.menAsc) === JSON.stringify(['3', '10']), `taille ménage triée numériquement, pas lexico (got ${JSON.stringify(r.menAsc)})`);
  A(JSON.stringify(r.natAsc) === JSON.stringify(['FRA', 'DEU']), `nationalité triée par NOM affiché (France<Germany), pas par code ISO3 (got ${JSON.stringify(r.natAsc)})`);
  A(JSON.stringify(r.idAsc) === JSON.stringify(['202612305001', '202612305002']), `identifiant CAWI trié (got ${JSON.stringify(r.idAsc)})`);
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
