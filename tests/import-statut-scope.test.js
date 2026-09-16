/*
 * Test de non-régression — bug C1 : l'import valide le statut contre le
 * vocabulaire de l'enquête CIBLE, jamais celui de l'enquête ACTIVE.
 *
 * Avant le correctif, `valeurIncoherente('statut', …)` lisait `statutDefs()`
 * (= vocabulaire de l'enquête ACTIVE). Avec « n'importer que les corrects »
 * coché (le défaut, cf. index.html), importer une enquête dont le vocabulaire
 * diffère de l'enquête ouverte rejetait silencieusement toutes les lignes :
 *   - active CATI + import d'un lot CAPI (statut « Done ») → enquête créée VIDE ;
 *   - ré-import → mises à jour perdues.
 *
 * On vérifie, case « corrects seuls » COCHÉE (condition du bug) :
 *   A. active = vocabulaire CATI (français) ; import d'un lot neuf « Done »/« To do »
 *      (canoniques EN) → les 2 lignes sont importées, statuts préservés.
 *   B. active = vocabulaire CAPI (EN) ; import d'un lot « Interview réalisée »/
 *      « Pas encore de contact entrepris » (canoniques CATI) → 2 lignes importées.
 *   C. garde-fou : un statut RÉELLEMENT inconnu (« ZZZ_NOPE ») reste exclu.
 *   D. la case « n'importer que les corrects » est bien cochée par défaut.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/import-statut-scope.test.js
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
    const out = {};
    // Défaut du markup : « n'importer que les corrects » coché (condition du bug).
    out.defaultChecked = !!(document.getElementById('chkOnlyValid') || {}).checked;

    // Import avec la case « corrects seuls » COCHÉE (on ne la décoche PAS).
    const importer = (nom, csv) => {
      const parsed = parseCSV(csv);
      ouvrirModalImport(parsed, nom);
      document.getElementById('inputNomEnquete').value = nom;
      const chk = document.getElementById('chkOnlyValid'); if (chk) chk.checked = true;
      confirmerImport();
    };

    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    settings.statutsParEnquete = {};
    settings.lang = 'fr';

    // ── A. Enquête active au vocabulaire CATI (français), sans « Done »/« To do »
    const catiVocab = [
      { label:'Pas encore de contact entrepris', color:'#90a4ae', icon:'•',  done:false, rdv:false, realise:false },
      { label:'Rdv fixé',                         color:'#f9a825', icon:'📅', done:false, rdv:true,  realise:false },
      { label:'Interview réalisée',               color:'#2e7d32', icon:'✓',  done:true,  rdv:false, realise:true  },
    ];
    enquetes['Active CATI'] = [{ ordre:'9', nom:'Ref', prenom:'Actif', adresse:'Rue Active 1 1000 Bxl', statut:'Pas encore de contact entrepris' }];
    settings.statutsParEnquete['Active CATI'] = catiVocab;
    enqueteActive = 'Active CATI';

    importer('Nouveau CAPI',
      'order,first_name,last_name,address,status\n' +
      '1,Alice,Martin,Rue 1 1000 Bxl,Done\n' +
      '2,Bob,Durand,Rue 2 1000 Bxl,To do\n');
    const capi = enquetes['Nouveau CAPI'] || [];
    out.capiCount = capi.length;
    out.capiStatuts = capi.map(c => c.statut).sort();

    // ── B. Enquête active au vocabulaire CAPI (EN par défaut) ; import CATI canonique
    enquetes['Active CAPI'] = [{ ordre:'8', nom:'Ref2', prenom:'Actif2', adresse:'Rue Active 2 1000 Bxl', statut:'To do' }];
    // pas de statutsParEnquete['Active CAPI'] → vocabulaire global EN par défaut
    enqueteActive = 'Active CAPI';

    importer('Nouveau CATI',
      'order,first_name,last_name,address,status\n' +
      '1,Chloe,Neyt,Rue 3 1000 Bxl,Interview réalisée\n' +
      '2,David,Peeters,Rue 4 1000 Bxl,Pas encore de contact entrepris\n');
    const cati = enquetes['Nouveau CATI'] || [];
    out.catiCount = cati.length;
    out.catiStatuts = cati.map(c => c.statut).sort();

    // ── C. Garde-fou : un statut réellement inconnu reste exclu
    enqueteActive = 'Active CAPI';
    importer('Poubelle',
      'order,first_name,last_name,address,status\n' +
      '1,Eve,Xyz,Rue 5 1000 Bxl,ZZZ_NOPE\n');
    out.trashCount = (enquetes['Poubelle'] || []).length;

    return out;
  });

  A(r.defaultChecked === true, 'la case « n\'importer que les corrects » est cochée par défaut');

  // A — active CATI, import CAPI
  A(r.capiCount === 2, `active CATI : les 2 lignes du lot CAPI sont importées (got ${r.capiCount})`);
  A(JSON.stringify(r.capiStatuts) === JSON.stringify(['Done', 'To do']),
    `active CATI : statuts préservés (got ${JSON.stringify(r.capiStatuts)})`);

  // B — active CAPI, import CATI canonique
  A(r.catiCount === 2, `active CAPI : les 2 lignes du lot CATI sont importées (got ${r.catiCount})`);
  A(JSON.stringify(r.catiStatuts) === JSON.stringify(['Interview réalisée', 'Pas encore de contact entrepris']),
    `active CAPI : statuts CATI canoniques préservés (got ${JSON.stringify(r.catiStatuts)})`);

  // C — garde-fou
  A(r.trashCount === 0, `garde-fou : un statut vraiment inconnu reste exclu (got ${r.trashCount})`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
