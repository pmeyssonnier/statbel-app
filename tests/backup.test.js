/*
 * Tests de non-régression — restauration de sauvegarde sûre (app Interviews)
 *
 * Couvre l'item #7 de la revue : les réglages (settings) issus d'un fichier de
 * sauvegarde importé sont d'origine externe → ils doivent être VALIDÉS/assainis
 * avant application (clés connues uniquement, valeurs contraintes à leur
 * domaine), et jamais fusionnés tels quels. Vérifie validerSettings/
 * validerStatuts (fonctions pures exposées au global).
 *
 * Pré-requis (dev) :  npm i -D playwright-core   ·   CHROMIUM_PATH=/chemin/chrome
 * Lancer :  CHROMIUM_PATH=… node tests/backup.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';

(async () => {
  const srv = await serve();   // app.js est un module ES → servir en http(s)
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const r = await p.evaluate(() => {
    const out = {};

    // Réglages hostiles / corrompus : clés inconnues + valeurs hors-domaine
    const s = validerSettings({
      provider: 'evil',                 // hors enum → défaut
      lang: 'xx',                       // hors LANGS → défaut
      theme: 'dark',                    // valide → conservé
      fontSize: 'HUGE',                 // hors enum → défaut
      csvSep: ';',                      // valide → conservé
      pinCode: '1234',                  // le PIN n'est jamais repris d'un backup
      pinTimeout: 9999,                 // (ignoré ici ; réimposé par l'appelant)
      statutsV: -3,                     // entier négatif → ignoré
      foo: 'bar',                       // clé inconnue → absente
      __proto__: { polluted: 1 },       // pas de pollution de prototype
    });
    out.provider_default = s.provider === 'auto';       // défaut réimposé
    out.lang_default     = ['fr','nl','en','de'].includes(s.lang) && s.lang !== 'xx';
    out.theme_kept       = s.theme === 'dark';
    out.csvSep_kept      = s.csvSep === ';';
    out.no_unknown_key   = !('foo' in s);
    out.pin_not_taken    = s.pinCode === '' ;           // pas de PIN injecté
    out.statutsV_default = Number.isInteger(s.statutsV) && s.statutsV >= 0;  // -3 rejeté
    out.no_pollution     = ({}).polluted === undefined; // prototype global intact
    out.has_statuts      = Array.isArray(s.statuts) && s.statuts.length > 0;

    // statuts malformés → nettoyés
    const s2 = validerSettings({ statuts: [
      { label: 'Bon', color: '#abc', icon: '✓', done: true, rdv: false },
      { label: '', color: '#fff' },                     // sans label → rejeté
      { color: '#fff' },                                // sans label → rejeté
      { label: 'X', color: 'javascript:alert(1)' },     // couleur non-hex → défaut
      'not-an-object',                                  // ignoré
    ] });
    out.statuts_kept_valid = s2.statuts.length === 2 && s2.statuts[0].label === 'Bon';
    out.color_sanitized    = s2.statuts[1].color === '#90a4ae';
    out.bool_coerced       = s2.statuts[0].done === true && s2.statuts[0].rdv === false;

    // tableau de statuts vide/invalide → repli sur les statuts par défaut
    const s3 = validerSettings({ statuts: 'oops' });
    out.statuts_fallback = Array.isArray(s3.statuts) && s3.statuts.length > 0;

    // entrée non-objet → défaut complet
    const s4 = validerSettings(null);
    out.null_defaults = s4.provider === 'auto' && Array.isArray(s4.statuts);

    return out;
  });

  await b.close();
  await srv.close();

  const checks = [
    ['#7 provider hors-domaine → défaut',      r.provider_default === true],
    ['#7 lang invalide → défaut',              r.lang_default === true],
    ['#7 theme valide conservé',               r.theme_kept === true],
    ['#7 csvSep valide conservé',              r.csvSep_kept === true],
    ['#7 clé inconnue ignorée',                r.no_unknown_key === true],
    ['#7 PIN jamais repris du backup',         r.pin_not_taken === true],
    ['#7 statutsV négatif ignoré',             r.statutsV_default === true],
    ['#7 pas de pollution de prototype',       r.no_pollution === true],
    ['#7 statuts toujours présents',           r.has_statuts === true],
    ['#7 statuts invalides filtrés',           r.statuts_kept_valid === true],
    ['#7 couleur non-hex assainie',            r.color_sanitized === true],
    ['#7 booléens contraints',                 r.bool_coerced === true],
    ['#7 statuts non-tableau → défaut',        r.statuts_fallback === true],
    ['#7 entrée null → défauts complets',      r.null_defaults === true],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
