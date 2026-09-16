/*
 * Test de non-régression — bug E6 : la progression compte le statut « réalisé »
 * (drapeau realise), pas le libellé 'Done' en dur.
 *
 * Avant, renderProgressionGlobale / renderCourbeAvancement / dessinerCourbeProgression
 * testaient `statut === 'Done'`. En CATI/CAWI le statut réalisé est « Interview
 * réalisée » → l'avancement affichait 0 % et la courbe était vide.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/progression-realise.test.js
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
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    settings.statutsParEnquete = {};
    settings.lang = 'fr';

    // Enquête CATI : le statut réalisé est « Interview réalisée » (realise:true), pas 'Done'
    settings.statutsParEnquete['GrpCATI'] = [
      { label: 'Pas encore de contact entrepris', color: '#90a4ae', icon: '•', done: false, rdv: false, realise: false },
      { label: 'Interview réalisée',              color: '#2e7d32', icon: '✓', done: true,  rdv: false, realise: true  },
      { label: 'Négatif',                         color: '#c62828', icon: '✗', done: true,  rdv: false, realise: false },
    ];
    enquetes['GrpCATI'] = [
      { ordre: '1', prenom: 'A', nom: 'B', adresse: 'R1, 1000 Bxl', statut: 'Interview réalisée', date: '06/07/2026', historique: [{ statut: 'Interview réalisée', date: '06/07/2026' }] },
      { ordre: '2', prenom: 'C', nom: 'D', adresse: 'R2, 1000 Bxl', statut: 'Négatif', date: '07/07/2026', historique: [{ statut: 'Négatif', date: '07/07/2026' }] },
      { ordre: '3', prenom: 'E', nom: 'F', adresse: 'R3, 1000 Bxl', statut: 'Pas encore de contact entrepris' },
    ];
    // Enquête CAPI (vocabulaire par défaut : 'Done' realise:true) — contrôle de non-régression
    enquetes['GrpCAPI'] = [
      { ordre: '1', prenom: 'G', nom: 'H', adresse: 'R4, 1000 Bxl', statut: 'Done', date: '06/07/2026', historique: [{ statut: 'Done', date: '06/07/2026' }] },
    ];
    enqueteActive = 'GrpCATI';

    return {
      progCati:   renderProgressionGlobale('GrpCATI'),
      courbeCati: renderCourbeAvancement('GrpCATI'),
      progCapi:   renderProgressionGlobale('GrpCAPI'),
    };
  });

  // CATI : 1 réalisé / 3 = 33 %
  A(/<b>1<\/b>\s*\/\s*3/.test(r.progCati) && /33\s*%/.test(r.progCati),
    `CATI : progression 1/3 (33 %) (got ${(r.progCati.match(/✓[^<]*<b>\d<\/b>[^(]*\([^)]*\)/) || [''])[0].trim()})`);
  A(!/<b>0<\/b>\s*\/\s*3/.test(r.progCati), 'CATI : la progression n\'est PAS 0/3');
  A(/<svg/.test(r.courbeCati), 'CATI : la courbe d\'avancement contient des données (svg), pas « aucune activité »');

  // CAPI : 1 réalisé / 1 = 100 % (contrôle : le défaut marche toujours)
  A(/<b>1<\/b>\s*\/\s*1/.test(r.progCapi) && /100\s*%/.test(r.progCapi), 'CAPI : progression 1/1 (100 %) inchangée');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
