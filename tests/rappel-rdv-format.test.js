/*
 * Test de non-régression — bug E7 : le rappel affiche une date de RDV LISIBLE,
 * pas le format interne ISO.
 *
 * c.rdv est stocké « YYYY-MM-DD HH:MM » (format interne). Avant, construireRappel
 * injectait cette valeur telle quelle dans le message → le répondant recevait
 * « Rendez-vous prévu : 2026-09-18 14:30 ». Elle doit être formatée « 18/09/2026 14:30 ».
 *
 * On couvre les deux chemins : modèle par défaut (lignes) et modèle personnalisé
 * contenant {{rendez_vous}}.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/rappel-rdv-format.test.js
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
    settings.lang = 'fr';
    const contact = { collect_method: 'CATI', rdv: '2026-09-18 14:30', prenom: 'Alice' };
    // 1. Modèle par défaut (chemin « lignes »)
    const def = construireRappel({ contact, canal: 'sms' });
    // 2. Modèle personnalisé avec {{rendez_vous}} (chemin variables)
    const cust = construireRappel({ contact, canal: 'sms', templates: { smsCati: 'RDV: {{rendez_vous}}' } });
    // 3. Contrôle : sans RDV, pas de mention
    const sans = construireRappel({ contact: { collect_method: 'CATI', prenom: 'Bob' }, canal: 'sms' });
    return { def: def.body, cust: cust.body, sans: sans.body };
  });

  A(/18\/09\/2026 14:30/.test(r.def), `défaut : RDV lisible « 18/09/2026 14:30 » (got …${(r.def.match(/.{0,25}14:30/) || [''])[0]})`);
  A(!/2026-09-18/.test(r.def), 'défaut : pas d\'ISO brut « 2026-09-18 » dans le message');
  A(/18\/09\/2026 14:30/.test(r.cust), 'modèle {{rendez_vous}} : RDV lisible');
  A(!/2026-09-18/.test(r.cust), 'modèle {{rendez_vous}} : pas d\'ISO brut');
  A(!/rendez-vous|Rendez-vous|2026/.test(r.sans), 'sans RDV : aucune mention de rendez-vous');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
