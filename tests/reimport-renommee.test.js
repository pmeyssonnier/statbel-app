/*
 * Test de non-régression — ré-import d'une enquête RENOMMÉE (toutes méthodes :
 * CAPI comme CATI/CAWI — la détection se fait sur le CONTENU, jamais la méthode).
 *
 * Bug : une enquête est indexée par son NOM. Le fichier ré-importé porte encore
 * son nom d'origine (le nom de fichier), or l'enquête a été renommée dans l'app.
 * `enquetes[nomFichier]` n'existe donc plus → un ré-import créait un DOUBLON avec
 * tous les contacts « neufs » (statut « To do »), perdant l'historique des statuts.
 *
 * Correctif : le contenu du fichier est apparié au contenu des enquêtes existantes
 * (meilleureCorrespondance). L'enquête renommée est reconnue et PRÉ-CIBLÉE dans la
 * modale (nom pré-rempli, bannière). À la confirmation : pas de doublon, données
 * administratives mises à jour depuis le fichier, historique des statuts conservé.
 * Une porte de sortie (« Créer une nouvelle enquête ») rétablit le nom du fichier.
 *
 * On vérifie aussi que confirmerRename déplace le vocabulaire par enquête
 * (settings.statutsParEnquete) — sinon la liste CATI/CAWI devient orpheline.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/reimport-renommee.test.js
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
    settings.lang = 'fr';
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    settings.statutsParEnquete = {};

    // Vocabulaire CATI (français) de l'enquête renommée.
    const catiVocab = [
      { label:'Pas encore de contact entrepris', color:'#90a4ae', icon:'•',  done:false, rdv:false, realise:false },
      { label:'Rdv fixé',                         color:'#f9a825', icon:'📅', done:false, rdv:true,  realise:false },
      { label:'Interview réalisée',               color:'#2e7d32', icon:'✓',  done:true,  rdv:false, realise:true  },
    ];
    // Enquête déjà présente, RENOMMÉE (nom ≠ nom du fichier), avec suivi + historique.
    enquetes['Ma tournée de septembre'] = [
      { ordre:'1', nom:'Martin', prenom:'Alice', adresse:'Rue A 1 1000 Bxl', collect_method:'CATI',
        taille_menage:3, statut:'Interview réalisée', date:'01/09/2026',
        historique:[{ statut:'Pas encore de contact entrepris', date:'28/08/2026' }, { statut:'Interview réalisée', date:'01/09/2026' }] },
      { ordre:'2', nom:'Durand', prenom:'Bob', adresse:'Rue B 2 1000 Bxl', collect_method:'CATI',
        taille_menage:3, statut:'Rdv fixé', date:'02/09/2026',
        historique:[{ statut:'Rdv fixé', date:'02/09/2026', rdv:'2026-09-20 10:00' }] },
    ];
    settings.statutsParEnquete['Ma tournée de septembre'] = catiVocab;
    enqueteActive = 'Ma tournée de septembre';

    // Le fichier ré-importé porte son NOM D'ORIGINE (nom de fichier) et met à jour
    // la taille du ménage (donnée administrative), sans suivi (statut source « To do »).
    const csv =
      'order,first_name,last_name,address,status,household_size,collect_method\n' +
      '1,Alice,Martin,Rue A 1 1000 Bxl,To do,5,CATI\n' +
      '2,Bob,Durand,Rue B 2 1000 Bxl,To do,5,CATI\n';
    const nomFichier = '2026-12345 GD RUE AU BOIS';

    // ── 1. Ouverture de la modale : détection + pré-ciblage automatique ──
    ouvrirModalImport(parseCSV(csv), nomFichier);
    out.champPreRempli = document.getElementById('inputNomEnquete').value;
    out.hintPresent = /Ma tournée de septembre/.test(document.getElementById('importRenameHint').innerHTML);
    out.hintABouton = !!document.querySelector('#importRenameHint [data-act="importCreerNouvelle"]');

    // ── 2. Confirmation : mise à jour de l'enquête renommée, sans doublon ──
    confirmerImport();
    out.noms = Object.keys(enquetes);
    out.doublon = enquetes[nomFichier] ? enquetes[nomFichier].length : 0;   // doit rester 0
    const maj = enquetes['Ma tournée de septembre'] || [];
    out.majCount = maj.length;
    const alice = maj.find(c => c.ordre === '1') || {};
    out.aliceStatut = alice.statut;                       // historique conservé → statut préservé
    out.aliceHistLen = (alice.historique || []).length;   // 2 entrées conservées
    out.aliceMenage = alice.taille_menage;                // donnée admin mise à jour (5)

    // ── 3. Porte de sortie : « Créer une nouvelle enquête » ──
    ouvrirModalImport(parseCSV(csv), nomFichier);
    out.champAvant = document.getElementById('inputNomEnquete').value;   // pré-rempli à l'enquête
    importCreerNouvelle();
    out.champApres = document.getElementById('inputNomEnquete').value;   // = nom du fichier
    out.hintApres = document.getElementById('importRenameHint').innerHTML;   // bannière masquée
    confirmerImport();
    out.nouvelleCount = (enquetes[nomFichier] || []).length;   // enquête créée
    const neuf = (enquetes[nomFichier] || []).find(c => c.ordre === '1') || {};
    out.nouvelleHistLen = (neuf.historique || []).length;   // enquête neuve → aucun historique repris
    out.nouvelleRealise = neuf.statut === 'Interview réalisée';   // aucun suivi de l'ancienne enquête

    // ── 4. confirmerRename déplace le vocabulaire par enquête ──
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    settings.statutsParEnquete = {};
    enquetes['Ancien nom'] = [{ ordre:'1', nom:'X', prenom:'Y', adresse:'Rue 1', statut:'Interview réalisée' }];
    settings.statutsParEnquete['Ancien nom'] = catiVocab;
    enqueteActive = 'Ancien nom';
    document.getElementById('inputRename').value = 'Nouveau nom';
    confirmerRename();
    out.vocabDeplace = Array.isArray(settings.statutsParEnquete['Nouveau nom']);
    out.vocabAncienParti = !settings.statutsParEnquete['Ancien nom'];
    out.enqueteRenommee = !!enquetes['Nouveau nom'] && !enquetes['Ancien nom'];

    // ── 5. Méthode-agnostique : même scénario pour une enquête CAPI renommée ──
    // (vocabulaire CAPI par défaut EN : To do / In progress / Done…). La détection
    // ne regarde que le CONTENU, jamais la méthode de collecte.
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    settings.statutsParEnquete = {};
    enquetes['Secteur Nord (renommé)'] = [
      { ordre:'1', nom:'Petit', prenom:'Chloé', adresse:'Rue N 1 5000 Namur', collect_method:'CAPI',
        taille_menage:2, statut:'Done', date:'03/09/2026',
        historique:[{ statut:'To do', date:'30/08/2026' }, { statut:'Done', date:'03/09/2026' }] },
      { ordre:'2', nom:'Grand', prenom:'David', adresse:'Rue N 2 5000 Namur', collect_method:'CAPI',
        taille_menage:2, statut:'Refusal', date:'03/09/2026',
        historique:[{ statut:'Refusal', date:'03/09/2026' }] },
    ];
    // pas de statutsParEnquete → vocabulaire global CAPI (EN) par défaut
    enqueteActive = 'Secteur Nord (renommé)';
    const csvCapi =
      'order,first_name,last_name,address,status,household_size,collect_method\n' +
      '1,Chloé,Petit,Rue N 1 5000 Namur,To do,4,CAPI\n' +
      '2,David,Grand,Rue N 2 5000 Namur,To do,4,CAPI\n';
    const nomFichierCapi = '2026-77777 SECTEUR NORD';
    ouvrirModalImport(parseCSV(csvCapi), nomFichierCapi);
    out.capiChamp = document.getElementById('inputNomEnquete').value;
    out.capiHint = /Secteur Nord/.test(document.getElementById('importRenameHint').innerHTML);
    confirmerImport();
    out.capiDoublon = enquetes[nomFichierCapi] ? enquetes[nomFichierCapi].length : 0;
    const capiMaj = enquetes['Secteur Nord (renommé)'] || [];
    out.capiCount = capiMaj.length;
    const chloe = capiMaj.find(c => c.ordre === '1') || {};
    out.capiStatut = chloe.statut;                       // 'Done' préservé
    out.capiHistLen = (chloe.historique || []).length;   // 2 entrées conservées
    out.capiMenage = chloe.taille_menage;                // admin mis à jour (4)

    return out;
  });

  // 1 — détection & pré-ciblage
  A(r.champPreRempli === 'Ma tournée de septembre', `modale : cible pré-remplie sur l'enquête renommée (got « ${r.champPreRempli} »)`);
  A(r.hintPresent, 'modale : bannière « enquête renommée reconnue » affichée');
  A(r.hintABouton, 'modale : bouton « créer une nouvelle enquête » présent');

  // 2 — pas de doublon, historique conservé, admin mis à jour
  A(r.doublon === 0, `pas de doublon : aucune enquête créée au nom du fichier (got ${r.doublon})`);
  A(!r.noms.includes('2026-12345 GD RUE AU BOIS'), 'pas de doublon : le nom du fichier n\'est pas dans la liste');
  A(r.majCount === 2, `enquête renommée : toujours 2 contacts (got ${r.majCount})`);
  A(r.aliceStatut === 'Interview réalisée', `historique conservé : statut préservé (got « ${r.aliceStatut} »)`);
  A(r.aliceHistLen === 2, `historique conservé : 2 entrées (got ${r.aliceHistLen})`);
  A(r.aliceMenage === 5, `donnée administrative mise à jour : taille ménage 3 → 5 (got ${r.aliceMenage})`);

  // 3 — porte de sortie
  A(r.champAvant === 'Ma tournée de septembre', 'porte de sortie : cible pré-remplie au départ');
  A(r.champApres === '2026-12345 GD RUE AU BOIS', `porte de sortie : « créer une nouvelle » rétablit le nom du fichier (got « ${r.champApres} »)`);
  A(r.hintApres === '', 'porte de sortie : bannière masquée après le choix');
  A(r.nouvelleCount === 2, `porte de sortie : nouvelle enquête créée (got ${r.nouvelleCount})`);
  A(r.nouvelleHistLen === 0, `porte de sortie : enquête neuve, aucun historique repris (got ${r.nouvelleHistLen})`);
  A(!r.nouvelleRealise, 'porte de sortie : aucun suivi de l\'ancienne enquête sur les contacts neufs');

  // 4 — vocabulaire suivi au renommage
  A(r.enqueteRenommee, 'renommage : l\'enquête change bien de nom');
  A(r.vocabDeplace, 'renommage : le vocabulaire par enquête suit le nouveau nom');
  A(r.vocabAncienParti, 'renommage : l\'ancienne entrée de vocabulaire est retirée');

  // 5 — méthode-agnostique : une enquête CAPI renommée bénéficie du même traitement
  A(r.capiChamp === 'Secteur Nord (renommé)', `CAPI : cible pré-remplie sur l'enquête renommée (got « ${r.capiChamp} »)`);
  A(r.capiHint, 'CAPI : bannière « enquête renommée reconnue » affichée');
  A(r.capiDoublon === 0, `CAPI : pas de doublon au nom du fichier (got ${r.capiDoublon})`);
  A(r.capiCount === 2, `CAPI : toujours 2 contacts (got ${r.capiCount})`);
  A(r.capiStatut === 'Done', `CAPI : historique conservé, statut préservé (got « ${r.capiStatut} »)`);
  A(r.capiHistLen === 2, `CAPI : 2 entrées d'historique conservées (got ${r.capiHistLen})`);
  A(r.capiMenage === 4, `CAPI : donnée administrative mise à jour, taille ménage 2 → 4 (got ${r.capiMenage})`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
