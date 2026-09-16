/*
 * Test de non-régression — bug M2 : la valeur 0 de nb_cibles / taille_menage /
 * age était perdue à l'aller-retour CSV.
 *
 * À l'export, `csvCell(c.nb_cibles || '')` transformait 0 (falsy) en cellule vide ;
 * au réimport, `intOuNull('')` → null. Un ménage « 0 cible ≥15 » (que des enfants)
 * voyait donc, après export→réimport, son compte de cibles retomber sur la taille
 * du ménage (Résumé), gonflant le total et l'estimation d'indemnité, et activant à
 * tort le marqueur « approximatif ». Correctif : préserver 0 (numCell → « 0 »).
 *
 * On vérifie l'aller-retour complet genererCSV → parseCSV, et le contrôle inverse
 * (null reste null, jamais transformé en 0).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/csv-roundtrip-zero.test.js
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
    settings.csvSep = ',';   // séparateur déterministe pour l'inspection de la cellule brute
    // c1 : valeurs à 0 légitimes ; c2 : contrôle (null doit rester null).
    enquetes['E'] = [
      { ordre:'1', nom:'Zero', prenom:'Cible', adresse:'Rue A 1 1000 Bxl', statut:'To do', nb_cibles:0, taille_menage:0, age:0 },
      { ordre:'2', nom:'Null', prenom:'Vide',  adresse:'Rue B 2 1000 Bxl', statut:'To do', nb_cibles:null, taille_menage:2, age:null },
    ];
    enqueteActive = 'E';

    const csv = genererCSV();
    // Cellule brute exportée pour c1 (ligne « order=1 ») : age(9), household_size(13), members_15plus(14).
    const lignes = csv.replace(/^\ufeff/, '').split('\n');
    const c1 = (lignes.find(l => l.split(',')[0] === '1') || '').split(',');
    const brut = { age: c1[9], taille: c1[13], cibles: c1[14] };

    const parsed = parseCSV(csv);
    const g = ordre => (parsed.rows || []).find(x => x.ordre === ordre) || {};
    const a = g('1'), bb = g('2');
    return {
      brut,
      c1: { nb_cibles: a.nb_cibles, taille_menage: a.taille_menage, age: a.age },
      c2: { nb_cibles: bb.nb_cibles, taille_menage: bb.taille_menage, age: bb.age },
    };
  });

  // Export : la cellule contient bien « 0 », pas vide.
  A(r.brut.cibles === '0', `export : nb_cibles=0 écrit « 0 » (got « ${r.brut.cibles} »)`);
  A(r.brut.taille === '0', `export : taille_menage=0 écrit « 0 » (got « ${r.brut.taille} »)`);
  A(r.brut.age === '0',    `export : age=0 écrit « 0 » (got « ${r.brut.age} »)`);

  // Aller-retour : 0 préservé (pas null).
  A(r.c1.nb_cibles === 0,     `round-trip : nb_cibles reste 0 (got ${JSON.stringify(r.c1.nb_cibles)})`);
  A(r.c1.taille_menage === 0, `round-trip : taille_menage reste 0 (got ${JSON.stringify(r.c1.taille_menage)})`);
  A(r.c1.age === 0,           `round-trip : age reste 0 (got ${JSON.stringify(r.c1.age)})`);

  // Contrôle : null reste null (une absence ne devient pas 0).
  A(r.c2.nb_cibles === null,  `contrôle : nb_cibles absent reste null (got ${JSON.stringify(r.c2.nb_cibles)})`);
  A(r.c2.age === null,        `contrôle : age absent reste null (got ${JSON.stringify(r.c2.age)})`);
  A(r.c2.taille_menage === 2, `contrôle : taille_menage=2 inchangé (got ${JSON.stringify(r.c2.taille_menage)})`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
