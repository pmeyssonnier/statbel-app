/*
 * Test de non-régression — bug M5 (vie privée) : le Planner envoyait des adresses
 * précises (potentiellement l'adresse d'un MÉNAGE) à Nominatim/OSM (serveur hors UE).
 *
 * verifierAdresse géocode le texte libre tapé par l'enquêteur. Avant, une adresse
 * précise (avec numéro) utilisait UrbIS puis, en repli, Nominatim → fuite possible
 * d'une adresse de ménage. Le correctif : une adresse AVEC numéro n'utilise QUE les
 * services régionaux belges ; Nominatim reste réservé aux libellés de quartier
 * (sans numéro) = données publiques.
 *
 * On espionne geocodeNominatim / geocodeAdresseRegion (aucun appel réseau réel) et
 * on vérifie qu'une adresse précise ne touche jamais Nominatim, contrairement à un
 * libellé de quartier.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/planner-osm-privacy.test.js
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
  await p.goto(srv.url + '/statbel_planner.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const r = await p.evaluate(async () => {
    const calls = { nomi: [], region: [] };
    // Remplace les géocodeurs par des espions (aucun réseau) — fonctions globales du
    // script classique du Planner.
    geocodeNominatim = (adr) => { calls.nomi.push(adr); return Promise.resolve(null); };
    geocodeAdresseRegion = (region, adr) => { calls.region.push(adr); return Promise.resolve(null); };
    // Rendre le garde « carte prête » satisfait sans initialiser Leaflet.
    _planMap = { setView() {} };
    _planAdrLayer = { clearLayers() {} };
    // Aucune commune sélectionnée (sinon centreCommune ferait un appel).
    const commSel = document.getElementById('planCommune'); if (commSel) commSel.value = '';
    const inp = document.getElementById('planAdrCheck');
    const wait = () => new Promise(res => setTimeout(res, 60));

    // 1. Adresse PRÉCISE (avec numéro) — potentiellement un ménage.
    calls.nomi = []; calls.region = [];
    inp.value = 'Rue de la Loi 16';
    verifierAdresse(); await wait();
    const precise = { nomi: calls.nomi.slice(), region: calls.region.slice() };

    // 2. Libellé de QUARTIER (sans numéro) — donnée publique.
    calls.nomi = []; calls.region = [];
    inp.value = 'Marolles';
    verifierAdresse(); await wait();
    const label = { nomi: calls.nomi.slice(), region: calls.region.slice() };

    return { precise, label, mapGuardWorks: (_planMap && _planAdrLayer) ? true : false };
  });

  A(r.mapGuardWorks, 'pré-requis : le garde carte est satisfait (sinon le test ne prouve rien)');
  A(r.precise.nomi.length === 0, `adresse précise : AUCUN envoi à Nominatim (got ${JSON.stringify(r.precise.nomi)})`);
  A(r.precise.region.length >= 1, `adresse précise : géocodée via service régional (got ${r.precise.region.length} appel(s))`);
  A(r.label.nomi.length >= 1, `libellé de quartier : Nominatim autorisé (got ${r.label.nomi.length} appel(s))`);

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
