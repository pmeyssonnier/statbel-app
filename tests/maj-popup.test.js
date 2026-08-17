/*
 * Test de non-régression — popup « Mise à jour disponible » (opt-in, app Interviews).
 *
 * Quand une nouvelle version est publiée, le nouveau service worker s'installe mais
 * reste EN ATTENTE : un petit popup laisse l'utilisateur poser la maj quand il veut
 * (pas de rechargement surprise). On teste ici la logique d'UI (le flux SW réel n'est
 * pas reproductible en headless) : rendu du popup, action « Poser » (message
 * SKIP_WAITING au worker en attente), report (« Plus tard »), et garde-fous.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/maj-popup.test.js
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
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(async () => {
    const out = {};
    // Le popup (autonome dans index.html) lit la langue depuis localStorage,
    // pas depuis le global `settings` : on la fixe là où il la lit.
    localStorage.setItem('statbel_settings', JSON.stringify({ lang: 'fr' }));

    // Worker en attente simulé : on capture les messages postés.
    const posted = [];
    window.__swWaiting = { postMessage: (m) => posted.push(m) };

    // Sans drapeau __majDispo, mais worker présent → signalerMajDispo affiche le popup.
    signalerMajDispo();
    const pop = document.getElementById('majDispo');
    out.shown = !!pop;
    out.role = pop ? pop.getAttribute('role') : null;
    out.msg = pop ? pop.querySelector('.maj-msg').textContent : null;
    out.iconHidden = !!(pop && pop.querySelector('.maj-ico[aria-hidden="true"]'));
    out.poserLabel = pop ? pop.querySelector('.maj-poser').textContent : null;
    out.laterLabel = pop ? pop.querySelector('.maj-later').getAttribute('aria-label') : null;

    // Idempotent : un second appel ne crée pas de doublon.
    signalerMajDispo();
    out.single = document.querySelectorAll('#majDispo').length;

    // « Poser » → message SKIP_WAITING + bouton désactivé.
    poserMaj();
    out.posted = JSON.stringify(posted);
    const pb = document.querySelector('#majDispo .maj-poser');
    out.poserDisabled = pb ? pb.disabled : null;
    out.poserBusyText = pb ? pb.textContent : null;

    // « Plus tard » → popup retiré, worker conservé (reproposé plus tard).
    fermerMajDispo();
    out.closed = !document.getElementById('majDispo');
    out.workerKept = !!window.__swWaiting;

    // Garde-fou : sans worker en attente, aucun popup.
    window.__swWaiting = null;
    signalerMajDispo();
    out.noneWithoutWorker = !document.getElementById('majDispo');
    return out;
  });

  A(r.shown, 'popup affiché quand une maj est prête');
  A(r.role === 'status', 'popup annoncé aux lecteurs d\'écran (role="status")');
  A(r.msg === 'Mise à jour disponible', `message traduit → « ${r.msg} »`);
  A(r.iconHidden, 'icône décorative marquée aria-hidden');
  A(r.poserLabel === 'Poser', `bouton d'action nommé → « ${r.poserLabel} »`);
  A(r.laterLabel === 'Plus tard', `bouton report nommé → « ${r.laterLabel} »`);
  A(r.single === 1, 'appel idempotent : pas de popup en double');
  A(/"type":"SKIP_WAITING"/.test(r.posted), `« Poser » envoie SKIP_WAITING au worker → ${r.posted}`);
  A(r.poserDisabled === true && /…/.test(r.poserBusyText), 'bouton « Poser » désactivé + état « en cours » après clic');
  A(r.closed && r.workerKept, '« Plus tard » retire le popup mais garde la maj en attente');
  A(r.noneWithoutWorker, 'garde-fou : aucun popup si rien n\'est en attente');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
