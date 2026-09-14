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
      // Le Planner est désormais multilingue (défaut = langue du navigateur) ;
      // on fige le français pour des assertions déterministes.
      try { localStorage.setItem('statbel_settings', JSON.stringify({ lang: 'fr' })); } catch (e) {}
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

    // Badge « N groupe(s) » : dépend des filtres (province…) ET de la sélection.
    const badge = await p.evaluate(() => {
      const txt = () => document.getElementById('planInfo').textContent.trim();
      const r = { bru: txt() };                       // défaut BRU : 1 groupe (11001)
      document.getElementById('selProvince').value = 'BWA'; onChangeProvince();
      r.bwa = txt();                                  // BWA : 1 groupe (25002)
      document.getElementById('selProvince').value = 'BRU'; onChangeProvince();
      toggleGroup('11001');                           // sélection
      r.withSel = txt();
      return r;
    });
    A(/1 groupe/.test(badge.bru), `badge suit le filtre province (BRU → "${badge.bru}")`);
    A(/1 groupe/.test(badge.bwa), `badge change avec la province (BWA → "${badge.bwa}")`);
    A(/✓ 1 sélectionné/.test(badge.withSel), `badge suit la sélection (→ "${badge.withSel}")`);

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
      // La vue Liste est désormais un tableau triable Charts.table (.dt).
      const listeRows = document.querySelectorAll('#agendaContent table.dt tbody tr').length;
      const listeSortable = !!document.querySelector('#agendaContent table.dt th[aria-sort]');
      if (typeof updateCandidaturePreview === 'function') updateCandidaturePreview();
      const cand = document.getElementById('candGrpCount') ? document.getElementById('candGrpCount').textContent : '?';
      return { communes, selSize: selected.size, agenda, listeRows, listeSortable, cand };
    });
    A(flow.communes.length === 1 && flow.communes[0] === 'Bruxelles / Brussel',
      `cascade province BRU → commune « Bruxelles / Brussel » (got ${JSON.stringify(flow.communes)})`);
    A(flow.selSize === 1 && flow.agenda, `sélection filtrée → agenda affiché (${flow.selSize} groupe)`);
    A(flow.listeRows > 0, `vue liste rend des lignes (${flow.listeRows})`);
    A(flow.listeSortable, 'vue liste = tableau triable (Charts.table)');
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

    // Box « Communes choisies » éditable : 1 ligne / commune, priorité ▲▼, retrait ✕, recompte.
    const boxEdit = await p.evaluate(() => {
      document.getElementById('selPlanning').value = '__ALL__'; onChangePlanning();
      selected.clear(); ['11001', '25002', '62003'].forEach(n => selected.add(n)); updateAgenda();
      setTab('candidature');                       // rend la box éditable
      const lines = () => [...document.querySelectorAll('#candGrpPreview .cand-line')];
      const names = () => lines().map(l => l.querySelector('.cand-comm').textContent.trim());
      const before = names();
      const selBefore = selected.size;
      candMoveCommune(0, 1);                        // descend la 1re commune
      const moved = names();
      candRemoveCommune(0);                         // retire la commune désormais en tête
      const after = names();
      return {
        nBefore: before.length, selBefore,
        movedOk: moved[0] === before[1] && moved[1] === before[0],
        nAfter: after.length, selAfter: selected.size,
        count: document.getElementById('candGrpCount').textContent,
        nbField: document.getElementById('candNbGroupes').value,
      };
    });
    A(boxEdit.nBefore === 3, `box éditable : une ligne par commune (attendu 3, got ${boxEdit.nBefore})`);
    A(boxEdit.movedOk, 'box éditable : ▲▼ réordonne les communes par priorité');
    A(boxEdit.nAfter === 2, `box éditable : ✕ retire une commune (3 → ${boxEdit.nAfter})`);
    A(boxEdit.selAfter === 2, `box éditable : ✕ désélectionne les groupes de la commune retirée (${boxEdit.selBefore} → ${boxEdit.selAfter})`);
    A(boxEdit.count === '2' && boxEdit.nbField === '2',
      `box éditable : nombre de groupes recalculé (badge ${boxEdit.count}, champ ${boxEdit.nbField})`);

    // Accessibilité (harden) : landmark + lien d'évitement + modale candidature.
    const a11y = await p.evaluate(() => {
      const out = {};
      const skip = document.querySelector('.skip-link');
      out.skipTarget = skip ? new URL(skip.href).hash : null;
      const main = document.getElementById('contenu');
      out.mainRole = main ? (main.getAttribute('role') || main.tagName.toLowerCase()) : null;
      out.mainTab = main ? main.getAttribute('tabindex') : null;
      const focusables = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,[tabindex]:not([tabindex="-1"])')]
        .filter(el => el.offsetParent !== null || el.getClientRects().length || el === skip);
      out.skipIsFirst = focusables[0] === skip;
      const avant = skip.getBoundingClientRect(); out.hidden = avant.bottom <= 0;
      skip.style.transition = 'none'; skip.focus();
      const apres = skip.getBoundingClientRect(); out.revealed = apres.top >= 0 && apres.bottom > 0;
      let rm = false;
      for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } if (!rs) continue; for (const ru of rs) { if (ru.media && ru.media.mediaText && ru.media.mediaText.includes('prefers-reduced-motion')) rm = true; } }
      out.reducedMotion = rm;
      // Onglets Planning / Agenda / Candidature : role tab/tabpanel, bascule = 1 panneau visible.
      setTab('candidature');
      out.candShown = document.getElementById('pane-candidature').hidden === false;
      out.candTabSel = document.getElementById('tab-candidature').getAttribute('aria-selected') === 'true';
      out.othersHidden = document.getElementById('pane-planning').hidden === true
                      && document.getElementById('pane-agenda').hidden === true;
      out.tabRole = document.getElementById('tab-candidature').getAttribute('role') === 'tab'
                 && document.getElementById('pane-candidature').getAttribute('role') === 'tabpanel';
      setTab('planning');
      out.backToPlanning = document.getElementById('pane-planning').hidden === false
                        && document.getElementById('pane-candidature').hidden === true;
      return out;
    });
    A(a11y.skipTarget === '#contenu', `lien d'évitement cible #contenu → ${a11y.skipTarget}`);
    A(a11y.mainRole === 'main' && a11y.mainTab === '-1', 'landmark principal <main id="contenu" tabindex="-1">');
    A(a11y.skipIsFirst, 'lien d\'évitement = 1er élément focusable');
    A(a11y.hidden && a11y.revealed, 'lien d\'évitement caché par défaut, révélé au focus');
    A(a11y.reducedMotion, 'règle @media prefers-reduced-motion présente');
    A(a11y.candShown && a11y.candTabSel, 'onglet Candidature : panneau affiché + onglet sélectionné (aria-selected)');
    A(a11y.othersHidden, 'onglets : les autres panneaux (Planning, Agenda) sont masqués');
    A(a11y.tabRole, 'onglets : role="tab" / role="tabpanel" (ARIA)');
    A(a11y.backToPlanning, 'basculer sur Planning ré-affiche son panneau, masque Candidature');

    // Polish/adapt : contraste --ink3 (≥4,5:1) + vue année sans bordure « side-tab ».
    const polish = await p.evaluate(() => {
      const out = {};
      const hexToRgb = h => { h = h.trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
      const relLum = rgb => { const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
      const ratio = (x, y) => { const L1 = relLum(x), L2 = relLum(y), hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); };
      const cs = getComputedStyle(document.documentElement);
      const ink3 = cs.getPropertyValue('--ink3'), bg = cs.getPropertyValue('--bg');
      out.ink3Contrast = (ink3 && bg) ? ratio(hexToRgb(ink3), hexToRgb(bg)) : 0;
      // Vue année avec des groupes → en-têtes de quartier rendus.
      document.getElementById('selPlanning').value = '__ALL__'; onChangePlanning();
      selectAll(); setView('annee');
      const html = document.body.innerHTML;
      out.noSideTab = !/border-left:\s*3px solid var\(--accent\)/.test(html);
      out.hasDot = /border-radius:50%;background:var\(--accent\)/.test(html);
      return out;
    });
    A(polish.ink3Contrast >= 4.5, `texte tertiaire (--ink3) ≥ 4,5:1 sur --bg → ${polish.ink3Contrast ? polish.ink3Contrast.toFixed(2) : polish.ink3Contrast}:1`);
    A(polish.noSideTab, 'vue année : plus de bordure « side-tab » (border-left 3px accent)');
    A(polish.hasDot, 'vue année : puce d\'accent en tête de groupe (remplace la barre)');

    // Génération .docx : titre centré + case à cocher choisie transmise. Le ZIP
    // est en méthode STORE → le document.xml est présent verbatim dans les octets.
    const docx = await p.evaluate(() => {
      const base = { nom: 'Test', prenom: 'U', adresse: '', cp: '', commune: '',
        telPrive: '', heuresPrive: '', telPort: '', heuresPort: '', telBur: '', heuresBur: '',
        emailPrive: '', emailBur: '', nbGroupes: '2', date: '01/01/2026',
        groupes: [{ numero: '12305', commune: 'Schaerbeek' }],
        title: 'Enquête sur les Forces de Travail 2026-T4', abbrev: 'EFT', period: '2026-T4' };
      const dec = b => new TextDecoder('utf-8', { fatal: false }).decode(b);
      const boxOk = (xml, label) => {
        const fe = xml.indexOf('F0FE'), lb = xml.indexOf(label);
        return (xml.match(/F0FE/g) || []).length === 1 && fe > -1 && fe < lb
          && !xml.slice(fe, lb).includes('F0A8');   // aucune case vide entre la cochée et son libellé
      };
      const g = dec(candGenerateDocxBytes({ ...base, choix: 'groupes' }));
      const pl = dec(candGenerateDocxBytes({ ...base, choix: 'plus' }));
      const pa = dec(candGenerateDocxBytes({ ...base, choix: 'pas' }));
      return {
        center: g.includes('<w:pStyle w:val="Title"/><w:jc w:val="center"/>'),
        oneBox: (g.match(/F0FE/g) || []).length === 1 && (g.match(/F0A8/g) || []).length === 2,
        gOk: boxOk(g, 'Nombre de groupes souhaités'),
        paOk: boxOk(pa, 'pas intéressé'),
        plOk: boxOk(pl, 'plus intéressé'),
      };
    });
    A(docx.center, 'candidature .docx : titre centré (w:jc center sur le paragraphe Title)');
    A(docx.oneBox, 'candidature .docx : exactement une case cochée (2 vides)');
    A(docx.gOk, 'candidature .docx : choix « groupes » coche « Nombre de groupes souhaités »');
    A(docx.paOk, 'candidature .docx : choix « pas » coche « pas intéressé(e) »');
    A(docx.plOk, 'candidature .docx : choix « plus » coche « n\'est plus intéressé(e) »');

    // Sigle d'enquête localisé (EFT/EAK/LFS) + formulation NL/EN des lignes « pas / plus ».
    const abbr = await p.evaluate(() => {
      const dec = b => new TextDecoder('utf-8', { fatal: false }).decode(b);
      const gen = (lang, choix) => {
        changerLangue(lang);
        const ai = CAND_ABBR_I18N.EFT;
        return dec(candGenerateDocxBytes({ nom:'T', prenom:'U', adresse:'X', cp:'', commune:'',
          telPrive:'', heuresPrive:'', telPort:'', heuresPort:'', telBur:'', heuresBur:'',
          emailPrive:'', emailBur:'', nbGroupes:'1', date:'',
          groupes:[{ numero:'14805', commune:'Schaerbeek', quartier:'HELMET' }],
          title:'x', abbrev:(ai[lang]||ai.fr), period:'2026-T4', choix, signaturePng:null }));
      };
      const nl = gen('nl', 'pas'), en = gen('en', 'pas'), nlP = gen('nl', 'plus'), enP = gen('en', 'plus');
      changerLangue('fr');
      return {
        nl1: nl.includes('Niet geïnteresseerd in het afnemen van enquêtes voor EAK 2026-T4'),
        en1: en.includes('Not interested in conducting LFS 2026-T4 surveys'),
        nl2: nlP.includes('Niet langer geïnteresseerd in het afnemen van enquêtes'),
        en2: enP.includes('No longer interested in conducting surveys'),
        eak: /EAK/.test(nl), lfs: /LFS/.test(en),
      };
    });
    A(abbr.eak, 'candidature .docx : sigle localisé EAK (NL)');
    A(abbr.lfs, 'candidature .docx : sigle localisé LFS (EN)');
    A(abbr.nl1, 'candidature .docx NL : « Niet geïnteresseerd in het afnemen van enquêtes voor EAK 2026-T4 »');
    A(abbr.en1, 'candidature .docx EN : « Not interested in conducting LFS 2026-T4 surveys »');
    A(abbr.nl2, 'candidature .docx NL : « Niet langer geïnteresseerd in het afnemen van enquêtes »');
    A(abbr.en2, 'candidature .docx EN : « No longer interested in conducting surveys »');

    // Génération : plus de pop-up applicative. Selon le support du navigateur :
    // partage natif du fichier (Web Share API) sinon téléchargement classique
    // — l'utilisateur ouvre/partage lui-même. On instrumente navigator + le clic
    // du lien pour observer le chemin choisi (formulaire minimal + signature).
    const gen = await p.evaluate(async () => {
      // 1x1 PNG valide pour la signature (candGenerateDocxBytes lit la taille).
      const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      document.getElementById('selPlanning').value = '__ALL__'; onChangePlanning(); selectAll(); setTab('candidature');
      candEl('Nom').value = 'Test'; candEl('Prenom').value = 'U'; candEl('Adresse').value = 'Rue X 1';
      candSigData = PNG;
      const origShare = navigator.share, origCan = navigator.canShare, origClick = HTMLAnchorElement.prototype.click;
      let shared = null, downloaded = false;
      HTMLAnchorElement.prototype.click = function(){ if (this.download) downloaded = true; };
      try {
        // a) Partage de fichiers supporté → navigator.share appelé, pas de download.
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: o => !!(o && o.files && o.files.length) });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async o => { shared = o && o.files && o.files[0] && o.files[0].name; } });
        await genererCandidature();
        const withShare = { shared, downloaded, noPopup: !document.getElementById('lfs-toast-file') };
        // b) Non supporté → repli téléchargement.
        shared = null; downloaded = false;
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        await genererCandidature();
        return { withShare, withoutShare: { shared, downloaded } };
      } finally {
        Object.defineProperty(navigator, 'share', { configurable: true, value: origShare });
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: origCan });
        HTMLAnchorElement.prototype.click = origClick;
      }
    });
    A(!!gen.withShare.shared && /\.docx$/.test(gen.withShare.shared), 'candidature : partage natif du .docx si supporté (navigator.share)');
    A(!gen.withShare.downloaded, 'candidature : pas de téléchargement forcé quand le partage est utilisé');
    A(gen.withShare.noPopup, 'candidature : plus de pop-up « Candidature générée »');
    A(gen.withoutShare.downloaded, 'candidature : repli téléchargement si le partage n\'est pas supporté');
    A(!gen.withoutShare.shared, 'candidature : pas de partage quand non supporté');

    // Garde « 0 groupe » : choix « nombre de groupes souhaités » sans groupe → bloqué ;
    // les choix « pas / plus intéressé » restent générables sans groupe.
    const guard = await p.evaluate(async () => {
      const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      setTab('candidature');
      candEl('Nom').value = 'T'; candEl('Prenom').value = 'U'; candEl('Adresse').value = 'X'; candSigData = PNG;
      selected = new Set(); updateCandidaturePreview();   // aucun groupe
      const origClick = HTMLAnchorElement.prototype.click;
      let downloaded = false;
      HTMLAnchorElement.prototype.click = function(){ if (this.download) downloaded = true; };
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      try {
        document.querySelector('input[name="candChoix"][value="groupes"]').checked = true;
        await genererCandidature();
        const errEl = document.getElementById('candErr');
        const blocked = { downloaded, errShown: !!(errEl && !errEl.hidden && errEl.textContent), err: errEl ? errEl.textContent : '' };
        downloaded = false;
        document.querySelector('input[name="candChoix"][value="pas"]').checked = true;
        await genererCandidature();
        return { blocked, pasDownloaded: downloaded };
      } finally { HTMLAnchorElement.prototype.click = origClick; }
    });
    A(!guard.blocked.downloaded, 'candidature : « nombre de groupes » + 0 groupe → génération bloquée');
    A(guard.blocked.errShown && /groupe/i.test(guard.blocked.err), 'candidature : message d\'erreur « aucun groupe » affiché');
    A(guard.pasDownloaded, 'candidature : « pas intéressé » générable même sans groupe');

    // Thème sombre (prefers-color-scheme:dark) : fond de page + cartes foncés,
    // texte clair, bandeau (chrome) qui reste foncé.
    await p.emulateMedia({ colorScheme: 'dark' });
    const dark = await p.evaluate(() => {
      const lum = el => { const c = getComputedStyle(el).backgroundColor.match(/\d+/g); if (!c) return null; return (0.2126 * +c[0] + 0.7152 * +c[1] + 0.0722 * +c[2]) / 255; };
      const txtLum = el => { const c = getComputedStyle(el).color.match(/\d+/g); return (0.2126 * +c[0] + 0.7152 * +c[1] + 0.0722 * +c[2]) / 255; };
      const card = document.querySelector('.card'), header = document.querySelector('header');
      return { bodyBg: lum(document.body), cardBg: card ? lum(card) : null, headerBg: header ? lum(header) : null, txt: txtLum(document.body) };
    });
    A(dark.bodyBg !== null && dark.bodyBg < 0.2, `sombre : fond de page foncé → lum ${dark.bodyBg != null ? dark.bodyBg.toFixed(2) : dark.bodyBg}`);
    A(dark.cardBg !== null && dark.cardBg < 0.25, `sombre : cartes foncées (plus de #fff) → lum ${dark.cardBg != null ? dark.cardBg.toFixed(2) : dark.cardBg}`);
    A(dark.headerBg !== null && dark.headerBg < 0.2, `sombre : bandeau reste foncé → lum ${dark.headerBg != null ? dark.headerBg.toFixed(2) : dark.headerBg}`);
    A(dark.txt > 0.6, `sombre : texte clair → lum ${dark.txt != null ? dark.txt.toFixed(2) : dark.txt}`);
    await p.emulateMedia({ colorScheme: 'light' });

    A(perr.length === 0, 'plannings présents : aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));
    await p.close();
  }

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
