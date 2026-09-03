/*
 * Test de non-régression — accessibilité du Convertisseur (harden a11y).
 *
 *  - landmark <main id="contenu"> + lien d'évitement (1er focusable, révélé au focus) ;
 *  - règle prefers-reduced-motion présente ;
 *  - modales : role="dialog" + aria-modal + aria-labelledby vers un titre existant ;
 *    focus déplacé dans la modale à l'ouverture, Échap la ferme ;
 *  - drill-downs cliquables focusables + activables au clavier (Entrée).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/converter-a11y.test.js
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
  await p.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await p.waitForTimeout(250);

  const r = await p.evaluate(async () => {
    const out = {};

    // ── Landmarks + lien d'évitement ──
    const skip = document.querySelector('.skip-link');
    out.skipExists = !!skip;
    out.skipTarget = skip ? new URL(skip.href).hash : null;
    const main = document.getElementById('contenu');
    out.mainIsMain = !!main && (main.tagName.toLowerCase() === 'main' || main.getAttribute('role') === 'main');
    out.mainTabindex = main ? main.getAttribute('tabindex') : null;
    out.mainWrapsContent = !!(main && main.querySelector('#dropZone, .container, #statsScopeBar, #tabsBar')) || (!!main && main.children.length > 0);
    const focusables = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null || el.getClientRects().length || el === skip);
    out.skipIsFirst = focusables[0] === skip;
    // révélé au focus : on neutralise la transition et on mesure l'état de repos
    const avant = skip.getBoundingClientRect();
    out.hiddenByDefault = avant.bottom <= 0;
    skip.style.transition = 'none';
    skip.focus();
    const apres = skip.getBoundingClientRect();
    out.visibleOnFocus = apres.top >= 0 && apres.bottom > 0;

    // ── prefers-reduced-motion ──
    let rm = false;
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (const ru of rules) {
        if (ru.media && ru.media.mediaText && ru.media.mediaText.includes('prefers-reduced-motion')) rm = true;
      }
    }
    out.reducedMotion = rm;

    // ── Modales : dialog + aria-labelledby vers un titre existant ──
    const modals = [...document.querySelectorAll('.modal[role="dialog"]')];
    out.modalCount = modals.length;
    out.modalAria = modals.length > 0 && modals.every(m =>
      m.getAttribute('aria-modal') === 'true'
      && m.getAttribute('aria-labelledby')
      && document.getElementById(m.getAttribute('aria-labelledby')));

    // ── Données factices → majStats → drill-downs clavier ──
    const mk = (hh, mb, cn, sexe, age, nat, gsm, email, mrtl) => ({
      nr_hh: hh, nr_membre: mb, fl_cntct: cn, ordre: hh, prenom: 'T', nom: 'X', adresse: 'R 1, 1000',
      sexe, age: String(age), nationality: nat, birth_country: 'BEL', birth_commune: 'BXL', birth_region: 'BRU',
      marital_status: mrtl || 'Single', gsm: gsm || '', email: email || '', taille_menage: '2', nb_cibles: '1',
    });
    const membres = [
      mk('1', '1', '1', 'M', 10, 'BEL', '+32', ''), mk('1', '2', '0', 'F', 40, 'FRA', '', ''),
      mk('2', '1', '1', 'F', 70, 'TUR', '', 'a@b.be'), mk('2', '2', '0', 'M', 30, 'BEL', '', ''),
    ];
    const res = {
      outMembres: membres, outCibles: membres.filter(m => m.fl_cntct === '1'),
      tailleHH: { '1': 2, '2': 2 }, srcRows: membres,
      adminCols: { NR_YEAR: '2026', NR_WAVE: '1', NR_SEQ: '1', NR_REF_WK: '36', NR_GRP: '12305' },
      grpId: '2026-12305', localisation: 'TEST',
    };
    _resultat = res;
    if (typeof statsScope !== 'undefined') statsScope = 'membres';
    try { majStats(res); } catch (e) { out.threw = String((e && e.message) || e); return out; }
    renderCibles(res.outCibles);
    await new Promise(res2 => setTimeout(res2, 60));   // laisse l'observer enrichir

    const bar = document.querySelector('#statsAgeLFS .bar-row[onclick]');
    out.barRole = bar ? bar.getAttribute('role') : null;
    out.barTab = bar ? bar.getAttribute('tabindex') : null;
    const cible = document.querySelector('#bodyCibles .cible-row[onclick]');
    out.cibleTab = cible ? cible.getAttribute('tabindex') : null;
    out.cibleKeepsRow = cible ? cible.getAttribute('role') !== 'button' : false;   // préserve la sémantique de ligne

    // activation clavier : Entrée sur une barre déclenche le drill-down
    const det = document.getElementById('statsAgeLFSDetail'); if (det) det.innerHTML = '';
    if (bar) { bar.focus(); bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
    out.keyDrill = !!(det && det.innerHTML.length > 0);

    // ── Modale : ouverture met le focus dedans, Échap ferme ──
    ouvrirParametres();
    await new Promise(res2 => setTimeout(res2, 40));
    const params = document.getElementById('modalParams');
    out.focusInModal = params.contains(document.activeElement);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    out.escClosed = !params.classList.contains('open');

    return out;
  });

  A(!r.threw, 'majStats() ne lève pas d\'erreur' + (r.threw ? ' → ' + r.threw : ''));
  A(r.skipExists && r.skipTarget === '#contenu', `lien d'évitement présent, cible #contenu → ${r.skipTarget}`);
  A(r.mainIsMain && r.mainTabindex === '-1', 'landmark principal <main id="contenu" tabindex="-1">');
  A(r.mainWrapsContent, 'le landmark principal enveloppe le contenu');
  A(r.skipIsFirst, 'lien d\'évitement = 1er élément focusable');
  A(r.hiddenByDefault, 'lien d\'évitement caché hors écran par défaut');
  A(r.visibleOnFocus, 'lien d\'évitement révélé au focus clavier');
  A(r.reducedMotion, 'règle @media prefers-reduced-motion présente');
  A(r.modalCount === 5, `5 modales en role="dialog" → ${r.modalCount}`);
  A(r.modalAria, 'modales : aria-modal="true" + aria-labelledby vers un titre existant');
  A(r.barRole === 'button' && r.barTab === '0', `barre de drill-down focusable + role button → role=${r.barRole} tabindex=${r.barTab}`);
  A(r.cibleTab === '0' && r.cibleKeepsRow, 'ligne ménage focusable (tabindex) en conservant sa sémantique de ligne');
  A(r.keyDrill, 'Entrée sur une barre déclenche le drill-down (activation clavier)');
  A(r.focusInModal, 'ouverture de modale : le focus passe dans la boîte de dialogue');
  A(r.escClosed, 'Échap ferme la modale');
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
