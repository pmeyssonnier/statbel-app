/*
 * Test de non-régression — bug M7 : le popup « Mise à jour » ne rechargeait pas
 * quand l'install initiale ET la mise à jour avaient lieu dans la MÊME session.
 *
 * L'ancien code figeait `avaitControleur` (const) à false au chargement (1er install).
 * Une maj posée dans la même session voyait toujours false → pas de reload → bouton
 * « … » à vie. Le correctif isole la décision dans `decisionMajControleur` et bascule
 * le drapeau au 1er controllerchange.
 *
 * Le vrai cycle SW n'est pas reproductible en headless (cf. maj-popup.test.js) : on
 * pilote la machine à états exposée, comme le fait le vrai écouteur controllerchange.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/maj-controllerchange.test.js
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
    if (typeof decisionMajControleur !== 'function') return { missing: true };
    // Rejoue une SÉQUENCE de controllerchange comme le vrai écouteur : chaque pas
    // applique la décision et thread l'état renvoyé.
    const sequence = (etatInit, n) => {
      let etat = etatInit, reloads = [];
      for (let i = 0; i < n; i++) {
        const d = decisionMajControleur(etat);
        reloads.push(d.reload);
        etat = { rechargement: d.reload || etat.rechargement, aEuControleur: d.aEuControleur };
      }
      return reloads;
    };
    return {
      // 1er install (aucun contrôleur) : cc1 = prise de contrôle, cc2 = maj même session.
      premierInstall: sequence({ rechargement: false, aEuControleur: false }, 2),
      // Maj classique (un contrôleur existait déjà au chargement) : cc → reload direct.
      majClassique: sequence({ rechargement: false, aEuControleur: true }, 1),
      // Pas de double rechargement si déjà rechargé.
      dejaRecharge: decisionMajControleur({ rechargement: true, aEuControleur: true }).reload,
    };
  });

  A(!r.missing, 'decisionMajControleur est exposée');
  // Cœur du bug M7 :
  A(r.premierInstall && r.premierInstall[0] === false, '1re prise de contrôle (install) → PAS de rechargement');
  A(r.premierInstall && r.premierInstall[1] === true, 'maj posée dans la MÊME session que l\'install → rechargement (fix M7)');
  A(r.majClassique && r.majClassique[0] === true, 'maj classique (contrôleur déjà présent) → rechargement');
  A(r.dejaRecharge === false, 'déjà rechargé → jamais deux fois');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
