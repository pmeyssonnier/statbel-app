/*
 * Test navigateur — délégation d'événements des vues Carte / Suivi / Import (lot 3).
 *
 * Vérifie qu'un clic délégué réel fonctionne (fermeture de la modale d'import via
 * le routeur) et que les contrôles Carte/RDV/Import ont bien migré de `on*=`
 * inline vers `data-act`. Les rendus métier (import, filtres RDV, carte) restent
 * couverts par leurs tests dédiés.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/vues-delegation.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const r = await p.evaluate(() => {
    const out = {};
    const noOn = el => el && !el.hasAttribute('onclick') && !el.hasAttribute('onchange') && !el.hasAttribute('oninput');

    // click délégué réel : ouvrir la modale d'import puis la fermer via data-act
    document.getElementById('modalNom').classList.add('open');
    document.querySelector('#modalNom [data-act="fermerModal"]').click();
    out.modalFerme = !document.getElementById('modalNom').classList.contains('open');

    // markup migré (data-act présent, plus aucun handler inline)
    const imp = document.getElementById('importFile');
    out.importOK = imp.getAttribute('data-act') === 'importerFichier' && noOn(imp);
    const rec = document.querySelector('#mapContainer [data-act="recentrerCarte"]');
    out.carteOK = !!rec && noOn(rec);
    const rs = document.getElementById('rdvSearch');
    out.rdvOK = rs.getAttribute('data-act') === 'rechercherRdv' && noOn(rs);
    out.confirmOK = noOn(document.getElementById('btnConfirmerImport'));

    // aucun handler inline résiduel dans les zones statiques du lot 3
    out.inlineVues = document.querySelectorAll(
      '#importFile[onchange], #mapContainer button[onclick], #modalNom [onclick], ' +
      '#modalNom [onchange], #modalNom [oninput], #rdvSearch[oninput]').length;

    return out;
  });

  await b.close();
  await srv.close();

  const checks = [
    ['click délégué → modale import fermée', r.modalFerme === true],
    ['importFile migré (data-act, 0 inline)', r.importOK === true],
    ['bouton recentrer migré',              r.carteOK === true],
    ['recherche RDV migrée',                r.rdvOK === true],
    ['bouton Importer migré',               r.confirmOK === true],
    ['0 handler inline dans les vues (lot 3)', r.inlineVues === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
