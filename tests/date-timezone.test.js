/*
 * Test de non-régression — bug E3 : dates décalées d'un jour (fuseau).
 *
 * parseDate() (Planner) et les dates de visite (Interviews) sont des Date à MINUIT
 * LOCAL. Les formater via toISOString().slice(0,10) renvoie l'UTC → en Belgique
 * (UTC+1/+2) la date recule d'un jour : vue Liste du Planner (v.start/stop) et
 * graphe d'activité d'Interviews (plage de jours) affichaient J-1.
 *
 * Le contexte navigateur est forcé sur Europe/Brussels — SANS quoi les tests
 * tournent en UTC et le bug reste invisible (toISOString == heure locale).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/date-timezone.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ timezoneId: 'Europe/Brussels' });
  const p = await ctx.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  p.on('dialog', d => d.accept());

  // ── Planner : vue Liste (v.start/v.stop) ────────────────────────────────
  await p.goto(srv.url + '/statbel_planner.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);
  const pl = await p.evaluate(() => {
    const out = {};
    out.tzShift = new Date(2026, 6, 6).toISOString().slice(0, 10);   // contrôle : '2026-07-05' si fuseau positif
    out.helper  = isoLocal(parseDate('06/07/2026'));                  // '2026-07-06' attendu
    try {
      allRows = [{
        numero: '2026-13605', province: 'BRU', commune: 'Bruxelles', quartier: 'Q',
        vagues: [{ idx: 1, sem: 29, start: parseDate('06/07/2026'), stop: parseDate('12/07/2026') }],
      }];
      selected = new Set(['2026-13605']);
      setView('liste');
      out.liste = document.getElementById('agendaContent').innerHTML;
    } catch (e) { out.err = e.message; }
    return out;
  });

  A(pl.tzShift === '2026-07-05', `contrôle : fuseau Europe/Brussels actif (toISOString décale, got ${pl.tzShift})`);
  A(pl.helper === '2026-07-06', `Planner : isoLocal(parseDate('06/07/2026')) = date locale (got ${pl.helper})`);
  A(!pl.err, 'Planner : rendu de la vue Liste sans erreur' + (pl.err ? ' → ' + pl.err : ''));
  A(/06\/07\/2026/.test(pl.liste || '') && /12\/07\/2026/.test(pl.liste || ''),
    `Planner Liste : dates 06/07 → 12/07 (got ${(pl.liste || '').match(/\d\d\/\d\d\/\d{4}/g)})`);
  A(!/05\/07\/2026/.test(pl.liste || '') && !/11\/07\/2026/.test(pl.liste || ''),
    'Planner Liste : aucune date décalée d\'un jour (05/07, 11/07)');

  // ── Interviews : graphe d'activité quotidienne ──────────────────────────
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);
  const iv = await p.evaluate(() => {
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes['T'] = [{
      ordre: '1', prenom: 'A', nom: 'B', adresse: 'Rue 1, 1000 Bxl',
      statut: 'Done', date: '06/07/2026', historique: [{ statut: 'Done', date: '06/07/2026' }],
    }];
    enqueteActive = 'T';
    return { html: renderActiviteQuotidienne('T') };
  });

  A(/data-iso="2026-07-06"/.test(iv.html), 'Interviews activité : colonne du 06/07 présente');
  A(!/data-iso="2026-07-05"/.test(iv.html), 'Interviews activité : pas de colonne fantôme au 05/07 (J-1)');

  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await ctx.close();
  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
