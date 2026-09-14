/*
 * Planner — internationalisation (fr/nl/en/de).
 * Vérifie que le sélecteur 🌐 traduit à chaud le DOM balisé (data-i18n) et les
 * contenus rendus en JS, sans erreur de page. Le Planner était FR uniquement.
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
  await p.goto(srv.url + '/statbel_planner.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    const save = () => document.querySelector('[data-i18n="kb_save"]').textContent;
    const tab  = () => document.querySelector('#tab-planning .tab-lbl').textContent;
    const weekBtn = () => document.getElementById('vSemaine').textContent;
    const out = { langsOk: Array.isArray(LANGS) && LANGS.length === 4, hasSelector: !!document.getElementById('setLangPlanner') };

    changerLangue('fr'); out.fr_save = save(); out.fr_week = weekBtn();
    changerLangue('nl'); out.nl_save = save(); out.nl_week = weekBtn(); out.nl_sel = document.getElementById('setLangPlanner').value;
    changerLangue('en'); out.en_save = save(); out.en_tab = tab();
    changerLangue('de'); out.de_save = save();
    // Chaîne générée en JS (mois) traduite par la langue active.
    out.de_month = moisNoms()[0];
    out.en_month = (changerLangue('en'), moisNoms()[0]);
    // Persistance partagée avec les autres apps.
    out.stored = (JSON.parse(localStorage.getItem('statbel_settings') || '{}')).lang;
    changerLangue('fr');
    return out;
  });

  await b.close();
  await srv.close();

  const checks = [
    ['LANGS = 4 langues', r.langsOk],
    ['sélecteur 🌐 présent', r.hasSelector],
    ['FR : « Sauvegarder »', /Sauvegarder/.test(r.fr_save)],
    ['FR : semaine « Semaine »', /Semaine/.test(r.fr_week)],
    ['NL : « Opslaan »', /Opslaan/.test(r.nl_save)],
    ['NL : semaine « Week »', /Week/.test(r.nl_week)],
    ['NL : sélecteur = nl', r.nl_sel === 'nl'],
    ['EN : « Save »', /Save/.test(r.en_save)],
    ['EN : onglet « Schedule »', /Schedule/.test(r.en_tab)],
    ['DE : « Speichern »', /Speichern/.test(r.de_save)],
    ['DE : mois JS = Januar', r.de_month === 'Januar'],
    ['EN : mois JS = January', r.en_month === 'January'],
    ['langue persistée (partagée)', r.stored === 'en'],
    ['aucune erreur de page', perr.length === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) console.log('PAGEERRORS:', perr);
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
