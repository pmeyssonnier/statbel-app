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

    // Filtres du tableau Planning : défauts « Toutes … » + libellés provinces/communes.
    _plannings = { P1: { nom:'P1', rows: [
      { prov:'ANT', commune:'Antwerpen',         quartier:'Q1', start:'01/01/2026', stop:'02/01/2026', code:'G1', wave:'1', sem:'1' },
      { prov:'BRU', commune:'Bruxelles/Brussel', quartier:'Q2', start:'03/01/2026', stop:'04/01/2026', code:'G2', wave:'1', sem:'1' },
    ] } };
    _planActif = 'P1';
    appliquerPlanningActif();
    const provOpts = () => [...document.getElementById('planProvince').options].map(o => o.text);
    changerLangue('nl');
    out.nl_prov_all = provOpts()[0];
    out.nl_prov_ant = provOpts().find(x => /Antwerpen/.test(x)) || '';
    document.getElementById('planProvince').value = ''; majCommunesPlan();   // toutes provinces → toutes communes
    const commOpts = [...document.getElementById('planCommune').options].map(o => o.text);
    out.nl_comm_all = commOpts[0];
    out.nl_comm_bxl = commOpts.find(x => /Brussel|Bruxelles/.test(x)) || '';
    out.nl_quart_all = [...document.getElementById('planQuartier').options][0].text;
    changerLangue('de'); out.de_prov_all = provOpts()[0];
    changerLangue('fr'); out.fr_prov_all = provOpts()[0];
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
    ['Planning NL : « Alle provincies »', r.nl_prov_all === 'Alle provincies'],
    ['Planning NL : province « Antwerpen »', /Antwerpen/.test(r.nl_prov_ant)],
    ['Planning NL : « Alle gemeenten »', r.nl_comm_all === 'Alle gemeenten'],
    ['Planning NL : commune « Brussel » (côté NL)', r.nl_comm_bxl === 'Brussel'],
    ['Planning NL : « Alle wijken »', r.nl_quart_all === 'Alle wijken'],
    ['Planning DE : « Alle Provinzen »', r.de_prov_all === 'Alle Provinzen'],
    ['Planning FR : « Toutes les provinces »', r.fr_prov_all === 'Toutes les provinces'],
    ['aucune erreur de page', perr.length === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) console.log('PAGEERRORS:', perr);
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
