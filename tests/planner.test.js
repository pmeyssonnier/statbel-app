/*
 * Tests de non-régression — Statbel Planner (statbel_planner.html)
 *
 * Le Planner ne recharge plus les fichiers trimestriels : il lit directement
 * les plannings déjà importés par le Convertisseur, persistés dans
 * localStorage['plannings'] (format {id,nom,type,rows:[{code,prov,commune,
 * quartier,wave,sem,start,stop}],grp}). On vérifie :
 *   1. Aucun planning stocké → écran « vide » (invite vers le Convertisseur),
 *      pas de sélecteur, pas de carte de filtres.
 *   2. Plannings présents → sélecteur « Tout » + une entrée par trimestre.
 *   3. « Tout » agrège tous les trimestres en dédupliquant par n° de groupe ;
 *      un trimestre seul = sous-ensemble.
 *   4. Le filtre province affiche les libellés complets (BRU → « Bruxelles »)
 *      tout en filtrant sur le code brut (cascade province → commune).
 *   5. Sélection de groupes → agenda + candidature reflètent la sélection.
 *
 * Données injectées via addInitScript (aucun fichier externe requis).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/planner.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';

// Deux « trimestres » au format Convertisseur (dates jj/mm/aaaa comme fmtDateCell).
// Q1 : deux groupes (BRU, BWA) ; Q2 : le groupe BWA (chevauche Q1 → dédup) + un LIE.
const PLANNINGS = [
  { id: 'plan_Q1', nom: 'LFS Q1 — EFT / LFS', type: 'EFT / LFS', embedded: false, grp: {}, rows: [
    { code: '11001', prov: 'BRU', commune: 'Bruxelles / Brussel', communeFR: 'Bruxelles', quartier: 'NORD', wave: 1, sem: '10', start: '02/03/2026', stop: '22/03/2026' },
    { code: '11001', prov: 'BRU', commune: 'Bruxelles / Brussel', communeFR: 'Bruxelles', quartier: 'NORD', wave: 2, sem: '20', start: '11/05/2026', stop: '31/05/2026' },
    { code: '25002', prov: 'BWA', commune: 'Wavre',               communeFR: 'Wavre',     quartier: 'CENTRE', wave: 1, sem: '11', start: '09/03/2026', stop: '29/03/2026' },
  ]},
  { id: 'plan_Q2', nom: 'LFS Q2 — EFT / LFS', type: 'EFT / LFS', embedded: false, grp: {}, rows: [
    { code: '25002', prov: 'BWA', commune: 'Wavre',      communeFR: 'Wavre',    quartier: 'CENTRE', wave: 1, sem: '11', start: '09/03/2026', stop: '29/03/2026' },
    { code: '62003', prov: 'LIE', commune: 'Liège',      communeFR: 'Liège',    quartier: 'OUEST',  wave: 1, sem: '24', start: '08/06/2026', stop: '28/06/2026' },
  ]},
];

let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });

  // ── 1. État vide : aucun planning en localStorage ─────────────────────
  {
    const p = await b.newPage();
    const perr = [];
    p.on('pageerror', e => perr.push(e.message));
    await p.goto(srv.url + '/statbel_planner.html', { waitUntil: 'load' });
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({
      invite: document.getElementById('planCard').style.display !== 'none',
      selHidden: getComputedStyle(document.getElementById('selPlanning')).display === 'none',
      filter: document.getElementById('filterCard').style.display !== 'none',
    }));
    A(st.invite && st.selHidden && !st.filter, 'état vide : invite affichée, sélecteur + filtres masqués');
    A(perr.length === 0, 'état vide : aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));
    await p.close();
  }

  // ── 2-5. Plannings présents (injectés avant chargement de la page) ────
  {
    const p = await b.newPage();
    const perr = [];
    p.on('pageerror', e => perr.push(e.message));
    p.on('dialog', d => d.accept());
    await p.addInitScript(data => {
      localStorage.setItem('plannings', JSON.stringify(data));
    }, PLANNINGS);
    await p.goto(srv.url + '/statbel_planner.html', { waitUntil: 'load' });
    await p.waitForTimeout(400);

    const base = await p.evaluate(() => {
      const sel = document.getElementById('selPlanning');
      return {
        selShown: getComputedStyle(sel).display !== 'none',
        inviteHidden: document.getElementById('planCard').style.display === 'none',
        planInfo: document.getElementById('planInfo').textContent,
        planInfoInHeader: !!document.querySelector('#filterCard .card-title #planInfo'),
        opts: [...sel.options].map(o => ({ v: o.value, t: o.text })),
        allRows: allRows.length,
        provOpts: [...document.getElementById('selProvince').options].map(o => ({ v: o.value, t: o.text })),
        provMultiple: document.getElementById('selProvince').multiple,
        provValue: document.getElementById('selProvince').value,
        commMultiple: document.getElementById('selCommune').multiple,
        quartMultiple: document.getElementById('selQuartier').multiple,
      };
    });
    A(base.selShown && base.inviteHidden, 'plannings présents : sélecteur affiché, invite masquée');
    A(base.planInfoInHeader && /groupe/.test(base.planInfo),
      `badge « N groupe(s) » dans l'en-tête « Sélectionner des groupes » (got "${base.planInfo.trim()}")`);
    A(base.opts.length === 3 && base.opts[0].v === '__ALL__' && /Tout — 2/.test(base.opts[0].t),
      `option « Tout — 2 trimestres » + 2 trimestres (got ${base.opts.length}: "${base.opts.map(o => o.t).join('", "')}")`);
    // « Tout » : 3 groupes distincts (11001, 25002 dédupliqué, 62003)
    A(base.allRows === 3, `« Tout » agrège en dédupliquant par n° de groupe (attendu 3, got ${base.allRows})`);
    const bru = base.provOpts.find(o => o.v === 'BRU');
    A(bru && bru.t === 'Bruxelles', `province BRU → libellé « Bruxelles » (got "${bru && bru.t}")`);
    A(base.provOpts.some(o => o.v === 'BWA' && o.t === 'Brabant wallon'), 'province BWA → « Brabant wallon »');
    A(base.provOpts.some(o => o.v === 'LIE' && o.t === 'Liège'), 'province LIE → « Liège »');

    // Province = sélection unique, défaut Bruxelles ; commune/quartier restent multiples.
    A(base.provMultiple === false, 'Province en sélection unique (liste déroulante)');
    A(base.provValue === 'BRU', `Province par défaut = Bruxelles (BRU) → "${base.provValue}"`);
    A(base.commMultiple === true && base.quartMultiple === true,
      'Commune et Quartier restent en sélection multiple');

    // Bandeau aligné sur Interviews / Convertisseur : sélecteur DANS l'en-tête,
    // navigation vers les autres apps dans le menu ⋮.
    const hdr = await p.evaluate(() => {
      const sel = document.querySelector('header #selPlanning');
      const items = [...document.querySelectorAll('#kebabMenu .kebab-item')].map(x => x.textContent.trim());
      const menu = document.getElementById('kebabMenu');
      const before = menu.classList.contains('open');
      toggleKebab(); const after = menu.classList.contains('open');
      return { selInHeader: !!sel && getComputedStyle(sel).display !== 'none', items, toggles: !before && after };
    });
    A(hdr.selInHeader, 'sélecteur de trimestre placé DANS le bandeau');
    A(hdr.items.some(t => /Interviews/.test(t)) && hdr.items.some(t => /Convertisseur/.test(t)),
      `menu ⋮ contient la navigation (got ${JSON.stringify(hdr.items)})`);
    A(hdr.toggles, 'menu ⋮ s\'ouvre via toggleKebab()');

    // Un seul trimestre (Q1) = sous-ensemble (2 groupes)
    const single = await p.evaluate(() => {
      const sel = document.getElementById('selPlanning');
      sel.value = 'plan_Q1'; onChangePlanning();
      return { allRows: allRows.length };
    });
    A(single.allRows === 2, `un trimestre = sous-ensemble (Q1 = 2 groupes, got ${single.allRows})`);

    // Retour « Tout » → filtre province BRU (cascade) → sélection → agenda → candidature
    const flow = await p.evaluate(() => {
      const sel = document.getElementById('selPlanning');
      sel.value = '__ALL__'; onChangePlanning();
      const psel = document.getElementById('selProvince');
      [...psel.options].forEach(o => o.selected = (o.value === 'BRU'));
      onChangeProvince();
      const communes = [...document.getElementById('selCommune').options].map(o => o.value);
      // sélectionner tous les groupes filtrés (BRU uniquement)
      selectAll();
      const agenda = document.getElementById('agendaCard').style.display !== 'none';
      setView('liste');
      const listeRows = document.querySelectorAll('.list-table tbody tr').length;
      if (typeof updateCandidaturePreview === 'function') updateCandidaturePreview();
      const cand = document.getElementById('candGrpCount') ? document.getElementById('candGrpCount').textContent : '?';
      return { communes, selSize: selected.size, agenda, listeRows, cand };
    });
    A(flow.communes.length === 1 && flow.communes[0] === 'Bruxelles / Brussel',
      `cascade province BRU → commune « Bruxelles / Brussel » (got ${JSON.stringify(flow.communes)})`);
    A(flow.selSize === 1 && flow.agenda, `sélection filtrée → agenda affiché (${flow.selSize} groupe)`);
    A(flow.listeRows > 0, `vue liste rend des lignes (${flow.listeRows})`);
    A(String(flow.cand) === String(flow.selSize), `candidature reflète la sélection (${flow.cand} = ${flow.selSize})`);

    // Candidature : NbGroupes = nb de groupes sélectionnés (calculé, lecture seule),
    // Date = date du jour. Les deux écrasent toute valeur mémorisée.
    const cand = await p.evaluate(() => {
      openCandidature();
      const today = new Date().toLocaleDateString('fr-BE');
      const r = { nb: candNbGroupes.value, date: candDate.value, today,
                  nbRO: candNbGroupes.readOnly, dRO: candDate.readOnly, sel: selected.size };
      // désélectionner un groupe → NbGroupes doit suivre en direct
      const first = [...selected][0]; toggleGroup(first);
      r.nbAfter = candNbGroupes.value; r.selAfter = selected.size;
      return r;
    });
    A(cand.nb === String(cand.sel), `NbGroupes = groupes sélectionnés (${cand.sel}) → "${cand.nb}"`);
    A(cand.date === cand.today, `Date = date du jour (${cand.today}) → "${cand.date}"`);
    A(cand.nbRO && cand.dRO, 'NbGroupes et Date en lecture seule (champs calculés)');
    A(cand.nbAfter === String(cand.selAfter), `NbGroupes suit la sélection en direct (${cand.selAfter}) → "${cand.nbAfter}"`);

    A(perr.length === 0, 'plannings présents : aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));
    await p.close();
  }

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
