/*
 * Tests de non-régression — vue liste & fiche (app Interviews, ui/contacts.js)
 *
 * Régression : à la sélection d'une enquête, le rendu de la liste et de la carte
 * doit fonctionner AVEC des données démographiques complètes (état civil,
 * nationalité) — ligneDemographie lit les tables MARITAL_I18N / PAYS_I18N, et
 * l'autocomplétion e-mail lit EMAIL_DOMAINES. Ces consts doivent être disponibles
 * dans le module (import depuis canon / const locale), sinon la liste et la carte
 * lèvent une ReferenceError et « n'apparaissent plus » (le Suivi et le Résumé, qui
 * ne passent pas par ligneDemographie, continuent eux de fonctionner).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/contacts.test.js
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
  // Ignore les échecs réseau (tuiles de carte / géocodage indisponibles hors-ligne) :
  // on ne traque que les vraies erreurs JS.
  p.on('console', m => {
    if (m.type() === 'error' && !/net::|Failed to (fetch|load)|tile/i.test(m.text())) perr.push('console: ' + m.text());
  });
  p.on('dialog', d => d.accept());
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);

  // Un throw dans le rendu (ex. const non importée) rejette l'evaluate : on le
  // capture pour le rapporter comme un échec propre plutôt qu'un crash du script.
  let r;
  try {
    r = await p.evaluate(async () => {
    const out = {};
    settings.statuts = [
      { label: 'To do', color: '#90a4ae', icon: '✕', done: false, rdv: false },
      { label: 'Done',  color: '#2e7d32', icon: '✓', done: true,  rdv: false },
      { label: 'RDV',   color: '#f9a825', icon: '⏳', done: false, rdv: true  },
    ];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    // Deux enquêtes (« groupes ») ; la seconde a des données démographiques COMPLÈTES
    enquetes.G1 = [{ ordre: '1', nom: 'A', prenom: 'a', adresse: 'Rue A, 1000 Bruxelles', statut: 'To do', historique: [] }];
    enquetes.G2 = [{
      ordre: '1', nom: 'Dupont', prenom: 'Jean', adresse: 'Rue B 2, 1000 Bruxelles',
      statut: 'RDV', rdv: '2026-03-15 10:00',
      birth_date: '1985-04-12', sexe: 'M', marital_status: 'Married',
      nationality: 'BEL', birth_country: 'BEL', taille_menage: 3, nb_cibles: 2,
      gsm: '0470111222', email: 'jean@',
      historique: [{ statut: 'RDV', date: '01/03/2026', heure: '09:00', rdv: '2026-03-15 10:00' }],
    }];
    enqueteActive = 'G1';
    saveCoords('Rue B 2, 1000 Bruxelles', 50.85, 4.35);
    refreshSelect(); rendu();

    // Action : sélectionner le groupe avec données démographiques → rend la liste
    changerEnquete('G2');
    setView('liste');
    out.liste_rendered = document.getElementById('liste').innerHTML.length > 100;
    // Taille ménage suivie du nb de cibles ≥15 entre parenthèses (nb_cibles=2 > 1)
    out.menage_15 = /\(2 ≥15\)/.test(document.getElementById('liste').innerHTML);

    // Carte : marqueur placé depuis le cache (ligneDemographie/popup exercés)
    setView('carte');
    await new Promise(res => setTimeout(res, 250));
    out.markers = markersLayer ? markersLayer.getLayers().length : -1;

    // Fiche + autocomplétion e-mail (EMAIL_DOMAINES)
    setView('liste');
    ouvrirEdit(0);
    out.edit_form = !!document.getElementById('edit-0');
    const inp = { value: 'jean@gm', id: 'x' };
    try { emailSuggest(inp, 'sug-test'); out.email_suggest_ok = true; } catch (e) { out.email_suggest_ok = false; }

    // Édition volontairement limitée : le formulaire ne re-liste PAS les champs
    // démographiques (nom, adresse, ménage) — ils sont affichés en tête de fiche.
    const ef = document.getElementById('edit-0').innerHTML;
    out.no_demo_fields = !/edit-prenom-0|edit-nom-0|edit-rue-0|edit-cpville-0|edit-hhsize-0|edit-hh15-0/.test(ef);
    out.edit_essentials = /class="statut-bar"/.test(ef) && /changerGsm\(0/.test(ef)
      && /changerEmail\(0/.test(ef) && /changerNotes\(0/.test(ef) && /historique/i.test(ef);
    // Statut non dupliqué : en édition, la barre verrouillée de la carte est masquée
    out.editingHidesTop = (() => {
      const card = document.getElementById('edit-0').closest('.card');
      if (!card || !card.classList.contains('editing')) return false;
      const bar = card.querySelector('.card-statut');
      return !!bar && getComputedStyle(bar).display === 'none';
    })();
    // Le ménage reste affiché en tête de fiche (donnée d'import), non éditable ici
    changerMenage(0, 'nb_cibles', '4');
    setView('liste'); rendu();
    out.menage_15_edit = /\(4 ≥15\)/.test(document.getElementById('liste').innerHTML);

    // Alias pays : « RDC » (RD Congo) reconnu et rendu cohérent à l'import
    out.rdc_norm = normaliserPays('RDC');                                   // attendu COD
    out.rdc_coherent = !valeurIncoherente('nationality', normaliserPays('RDC'));

    // Les autres vues fonctionnent aussi
    setView('rdv');    out.rdv_ok    = document.getElementById('rdvContainer').innerHTML.length > 0;
    setView('resume'); out.resume_ok = document.getElementById('resumeContainer').innerHTML.length > 0;
    return out;
    });
  } catch (e) {
    r = {};
    perr.push('evaluate a levé une exception (rendu cassé ?) : ' + e.message);
  }

  await b.close();
  await srv.close();

  const checks = [
    ['liste rendue après sélection (données démographiques)', r.liste_rendered === true],
    ['taille ménage suivie de « (2 ≥15) »',                   r.menage_15 === true],
    ['carte : marqueur placé',                                r.markers === 1],
    ['fiche : formulaire d’édition ouvert',                   r.edit_form === true],
    ['autocomplétion e-mail (EMAIL_DOMAINES)',                r.email_suggest_ok === true],
    ['édition limitée : pas de champs démographiques dans le formulaire', r.no_demo_fields === true],
    ['édition : statut + gsm + e-mail + notes + historique présents',     r.edit_essentials === true],
    ['statut non dupliqué : barre verrouillée masquée en édition',        r.editingHidesTop === true],
    ['ménage affiché en tête de fiche « (4 ≥15) »',                       r.menage_15_edit === true],
    ['alias pays RDC → COD (RD Congo)',                       r.rdc_norm === 'COD'],
    ['nationalité RDC normalisée est cohérente',              r.rdc_coherent === true],
    ['vue Suivi fonctionnelle',                               r.rdv_ok === true],
    ['vue Résumé fonctionnelle',                              r.resume_ok === true],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
