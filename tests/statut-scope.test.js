/*
 * Test de non-régression — statuts CLOISONNÉS par enquête.
 *
 * Chaque enquête a son propre vocabulaire de statuts (settings.statutsParEnquete).
 * On vérifie qu'une enquête CAPI et une enquête CATI ne se mélangent pas :
 *   1. statutDefs() renvoie le vocabulaire de l'enquête ACTIVE (change avec enqueteActive) ;
 *   2. renommer un statut de CAPI (enquête active) ne touche ni les statuts ni les
 *      contacts de CATI ;
 *   3. appliquer un préréglage sur CAPI ne modifie pas le vocabulaire ni les contacts
 *      de CATI (isolation stricte).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/statut-scope.test.js
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
  p.on('dialog', d => d.accept());   // confirm() du préréglage
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    // Deux enquêtes, deux vocabulaires distincts.
    settings.statuts = [
      { label:'To do', color:'#90a4ae', icon:'✕', done:false, rdv:false, realise:false },
      { label:'Done',  color:'#2e7d32', icon:'✓', done:true,  rdv:false, realise:true  },
    ];
    settings.statutsParEnquete = {
      CAPI: [
        { label:'To do', color:'#90a4ae', icon:'✕', done:false, rdv:false, realise:false },
        { label:'Done',  color:'#2e7d32', icon:'✓', done:true,  rdv:false, realise:true  },
      ],
      CATI: [
        { label:'Rdv fixé',          color:'#f9a825', icon:'📅', done:false, rdv:true,  realise:false },
        { label:'Interview réalisée', color:'#2e7d32', icon:'✓', done:true,  rdv:false, realise:true  },
      ],
    };
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.CAPI = [{ ordre:'1', nom:'A', prenom:'a', adresse:'R1', statut:'Done',
      historique:[{ statut:'Done', date:'01/09/2026' }] }];
    enquetes.CATI = [{ ordre:'1', nom:'B', prenom:'b', adresse:'R2', statut:'Interview réalisée',
      historique:[{ statut:'Rdv fixé', date:'02/09/2026' }] }];

    // 1. statutDefs() suit l'enquête active
    enqueteActive = 'CAPI'; const defsCapi = statutDefs().map(s => s.label);
    enqueteActive = 'CATI'; const defsCati = statutDefs().map(s => s.label);

    // 2. renommer un statut de CAPI (enquête active) : CATI intact
    enqueteActive = 'CAPI';
    modifierStatut(1, 'label', 'Réalisé (terrain)');   // Done → Réalisé (terrain)
    const capiLabelsApresRen = settings.statutsParEnquete.CAPI.map(s => s.label);
    const capiContactApresRen = enquetes.CAPI[0].statut;
    const catiLabelsApresRen = settings.statutsParEnquete.CATI.map(s => s.label);
    const catiContactApresRen = enquetes.CATI[0].statut;

    // 3. préréglage CATI appliqué sur CAPI : n'affecte pas l'enquête CATI
    enqueteActive = 'CAPI';
    appliquerPresetStatuts('cati');
    const catiVocApresPreset = settings.statutsParEnquete.CATI.map(s => s.label);
    const catiContactApresPreset = enquetes.CATI[0].statut;
    const capiVocApresPreset = settings.statutsParEnquete.CAPI.map(s => s.label);

    return {
      defsCapi, defsCati,
      capiLabelsApresRen, capiContactApresRen, catiLabelsApresRen, catiContactApresRen,
      catiVocApresPreset, catiContactApresPreset, capiVocApresPreset,
    };
  });

  A(JSON.stringify(r.defsCapi) === JSON.stringify(['To do', 'Done']),
    `statutDefs() (CAPI actif) = vocabulaire CAPI (got ${JSON.stringify(r.defsCapi)})`);
  A(JSON.stringify(r.defsCati) === JSON.stringify(['Rdv fixé', 'Interview réalisée']),
    `statutDefs() (CATI actif) = vocabulaire CATI (got ${JSON.stringify(r.defsCati)})`);

  A(JSON.stringify(r.capiLabelsApresRen) === JSON.stringify(['To do', 'Réalisé (terrain)']),
    `renommage : le vocabulaire CAPI est mis à jour (got ${JSON.stringify(r.capiLabelsApresRen)})`);
  A(r.capiContactApresRen === 'Réalisé (terrain)',
    `renommage : le contact CAPI suit le nouveau libellé (got ${r.capiContactApresRen})`);
  A(JSON.stringify(r.catiLabelsApresRen) === JSON.stringify(['Rdv fixé', 'Interview réalisée']),
    `renommage CAPI : le vocabulaire CATI est INTACT (got ${JSON.stringify(r.catiLabelsApresRen)})`);
  A(r.catiContactApresRen === 'Interview réalisée',
    `renommage CAPI : le contact CATI est INTACT (got ${r.catiContactApresRen})`);

  A(JSON.stringify(r.catiVocApresPreset) === JSON.stringify(['Rdv fixé', 'Interview réalisée']),
    `préréglage sur CAPI : le vocabulaire CATI est INTACT (got ${JSON.stringify(r.catiVocApresPreset)})`);
  A(r.catiContactApresPreset === 'Interview réalisée',
    `préréglage sur CAPI : le contact CATI est INTACT (got ${r.catiContactApresPreset})`);
  A(r.capiVocApresPreset.length === 6 && r.capiVocApresPreset[0] === 'Pas encore de contact entrepris',
    `préréglage sur CAPI : le vocabulaire CAPI a bien basculé (got ${JSON.stringify(r.capiVocApresPreset)})`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
