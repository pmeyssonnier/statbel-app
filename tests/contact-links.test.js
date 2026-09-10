/*
 * Test de non-régression — liens cliquables dans la fiche contact (app Interviews).
 *
 * Le téléphone (📞) et l'e-mail (✉️) affichés sur la carte doivent être des liens
 * cliquables ouvrant respectivement le composeur (tel:) et le client mail (mailto:),
 * et non du simple texte. L'adresse d'e-mail doit être reprise telle quelle dans le
 * href mailto.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/contact-links.test.js
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
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.G = [{
      ordre: '1', nom: 'Dupont', prenom: 'Jean', adresse: 'Rue A 1, 1000 Bruxelles',
      statut: statutDefaut(), gsm: '0470 11 22 33', email: 'jean.dupont@example.be', historique: [],
    }];
    enqueteActive = 'G';
    refreshSelect(); rendu(); setView('liste');
    const html = document.getElementById('liste').innerHTML;
    // Le lien e-mail doit être une vraie ancre mailto (récupérée dans le DOM)
    const a = [...document.querySelectorAll('#liste a')].find(x => x.getAttribute('href') && x.getAttribute('href').startsWith('mailto:'));
    return {
      htmlHasMailto: /href="mailto:jean\.dupont@example\.be"/.test(html),
      htmlHasTel: /href="tel:/.test(html),
      emailIsAnchor: !!a,
      emailHref: a ? a.getAttribute('href') : null,
      emailNotPlainSpan: !/<span class="badge">✉️/.test(html),
    };
  });

  A(r.htmlHasMailto, 'l\'e-mail est un lien mailto: avec l\'adresse exacte');
  A(r.emailIsAnchor && r.emailHref === 'mailto:jean.dupont@example.be',
    `l'e-mail est une ancre <a href="mailto:…"> (got ${r.emailHref})`);
  A(r.emailNotPlainSpan, 'l\'e-mail n\'est plus un simple <span> non cliquable');
  A(r.htmlHasTel, 'le téléphone reste un lien tel: (non-régression)');
  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
