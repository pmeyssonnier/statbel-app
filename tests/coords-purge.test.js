/*
 * Test de non-régression — bug E1 : la purge des coordonnées au démarrage
 * n'efface plus les adresses contenant « et… ».
 *
 * Avant, la purge testait la clé « coords_… » contre /bte\s*\d+|ET\w+|b\d{2,}/i :
 * le motif ET\w+ (insensible à la casse) faisait correspondre « Etterbeek »,
 * « Wetteren », « rue Petite »… → leurs coordonnées étaient supprimées à CHAQUE
 * démarrage (re-géocodage répété, perte hors-ligne).
 *
 * La purge repose désormais sur adresseSansBoite : une clé légitime (déjà sans
 * boîte) est conservée ; une ancienne clé contenant une boîte/étage est supprimée ;
 * la validation des bornes belges (lat/lng) reste active.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/coords-purge.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

// Clés « survivantes » (sans boîte, dans les bornes belges) et clés à purger.
const SURVIVE = [
  'coords_Rue Petite 5, 1000 Etterbeek',            // « Petite »/« Etterbeek » → piégeait l'ancien ET\w+
  'coords_Chaussée de Wavre 10, 9230 Wetteren',     // « Wetteren » → idem
];
const PURGE_BOITE = [
  'coords_Rue Haute 10 bte 3, 1000 Bruxelles',      // ancienne clé avec boîte
  'coords_Rue Neuve 12 ET03, 1000 Bruxelles',       // ancienne clé avec étage/boîte « ET03 »
];
const PURGE_HORS_BE = 'coords_Rue Loin 5, 75000 Paris';  // hors bornes belges

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  p.on('dialog', d => d.accept());

  // Semer localStorage AVANT le chargement des scripts de la page.
  await p.addInitScript(({ survive, purgeBoite, purgeHorsBe }) => {
    try {
      const be = JSON.stringify({ lat: 50.85, lng: 4.35 });   // dans les bornes belges
      survive.forEach(k => localStorage.setItem(k, be));
      purgeBoite.forEach(k => localStorage.setItem(k, be));
      localStorage.setItem(purgeHorsBe, JSON.stringify({ lat: 48.85, lng: 2.35 })); // Paris
    } catch (e) { /* ignore */ }
  }, { survive: SURVIVE, purgeBoite: PURGE_BOITE, purgeHorsBe: PURGE_HORS_BE });

  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  // Attendre la fin de l'init (la purge tourne juste avant l'affichage de la version).
  await p.waitForFunction(() => {
    const el = document.querySelector('.app-version');
    return el && el.textContent && el.textContent.trim().length > 0;
  }, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(300);

  const survived = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('coords_')));
  const has = k => survived.includes(k);

  SURVIVE.forEach(k => A(has(k), `conservé : ${k.replace('coords_', '')}`));
  PURGE_BOITE.forEach(k => A(!has(k), `purgé (boîte/étage) : ${k.replace('coords_', '')}`));
  A(!has(PURGE_HORS_BE), 'purgé (hors bornes belges) : Paris');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
