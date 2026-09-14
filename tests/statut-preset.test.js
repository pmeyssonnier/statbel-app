/*
 * Test de non-régression — préréglage de statuts « Feuille de contact CATI ».
 *
 * appliquerPresetStatuts('cati') doit :
 *   - remplacer settings.statuts par les 6 valeurs de la feuille de contact,
 *     avec les bons drapeaux (Rdv fixé→rdv, Interview réalisée→realise+done,
 *     Négatif→done sans realise) ;
 *   - re-mapper les contacts existants (statut courant + historique) depuis les
 *     libellés par défaut (EN canoniques) vers l'équivalent CATI, sans laisser
 *     d'historique orphelin (Done→Interview réalisée, Refusal→Négatif, etc.).
 *
 * Lancer :  CHROMIUM_PATH=… node tests/statut-preset.test.js
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
  p.on('dialog', d => d.accept());   // confirm() du préréglage
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    // Statuts par défaut (libellés canoniques EN) + contacts à re-mapper.
    settings.statuts = [
      { label:'To do',       color:'#90a4ae', icon:'✕',  done:false, rdv:false, realise:false },
      { label:'In progress', color:'#f9a825', icon:'⏳', done:false, rdv:true,  realise:false },
      { label:'Done',        color:'#2e7d32', icon:'✓',  done:true,  rdv:false, realise:true  },
      { label:'Absent',      color:'#a1887f', icon:'⊘',  done:true,  rdv:false, realise:false },
      { label:'Refusal',     color:'#c62828', icon:'✗',  done:true,  rdv:false, realise:false },
    ];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);
    enquetes.G = [
      { ordre:'1', nom:'A', prenom:'a', adresse:'Rue 1', statut:'Done',
        historique:[{ statut:'Done', date:'01/09/2026' }, { statut:'In progress', date:'28/08/2026' }] },
      { ordre:'2', nom:'B', prenom:'b', adresse:'Rue 2', statut:'Refusal',
        historique:[{ statut:'Absent', date:'27/08/2026' }] },
      { ordre:'3', nom:'C', prenom:'c', adresse:'Rue 3', statut:'To do', historique:[] },
    ];
    enqueteActive = 'G';

    appliquerPresetStatuts('cati');

    // Cloisonné par enquête : le préréglage écrit dans statutsParEnquete.G,
    // pas dans le modèle global settings.statuts. On lit via statutDefs()
    // (enquête active = G). Le modèle global doit rester inchangé.
    const byLabel = l => statutDefs().find(s => s.label === l) || {};
    const g = enquetes.G;
    return {
      labels: statutDefs().map(s => s.label),
      modeleIntact: settings.statuts.map(s => s.label).join(','),
      rdvFlag:      byLabel('Rdv fixé').rdv,
      realiseFlags: [byLabel('Interview réalisée').realise, byLabel('Interview réalisée').done],
      negatif:      [byLabel('Négatif').done, byLabel('Négatif').realise],
      todoFlags:    byLabel('Pas encore de contact entrepris').done,
      c1:  g[0].statut, c1h: g[0].historique.map(h => h.statut),
      c2:  g[1].statut, c2h: g[1].historique.map(h => h.statut),
      c3:  g[2].statut,
      // Traduction d'affichage des statuts CATI (valeur stockée inchangée).
      i18n: (() => {
        const tr = (lbl, lang) => { const prev = settings.lang; settings.lang = lang; const v = statutLabel(lbl); settings.lang = prev; return v; };
        return {
          nlNotYet: tr('Pas encore de contact entrepris', 'nl'),
          deNotYet: tr('Pas encore de contact entrepris', 'de'),
          enNeg: tr('Négatif', 'en'),
          enInterview: tr('Interview réalisée', 'en'),
        };
      })(),
    };
  });

  const attendus = ['Pas encore de contact entrepris', 'Rdv fixé', 'Tentatives de contacts sans résultat',
    'Négatif', 'Interview réalisée', 'Inconnu'];
  A(JSON.stringify(r.labels) === JSON.stringify(attendus), `6 statuts CATI dans l'ordre (got ${JSON.stringify(r.labels)})`);
  A(r.rdvFlag === true, '« Rdv fixé » a le drapeau rendez-vous');
  A(r.realiseFlags[0] === true && r.realiseFlags[1] === true, '« Interview réalisée » a les drapeaux réalisé + terminé');
  A(r.negatif[0] === true && r.negatif[1] === false, '« Négatif » est terminé mais non réalisé');
  A(r.todoFlags === false, '« Pas encore de contact entrepris » n\'est ni terminé ni réalisé');
  A(r.c1 === 'Interview réalisée', `contact « Done » re-mappé → Interview réalisée (got ${r.c1})`);
  A(JSON.stringify(r.c1h) === JSON.stringify(['Interview réalisée', 'Rdv fixé']),
    `historique re-mappé Done→Interview réalisée, In progress→Rdv fixé (got ${JSON.stringify(r.c1h)})`);
  A(r.c2 === 'Négatif', `contact « Refusal » re-mappé → Négatif (got ${r.c2})`);
  A(JSON.stringify(r.c2h) === JSON.stringify(['Tentatives de contacts sans résultat']),
    `historique « Absent » re-mappé → Tentatives… (got ${JSON.stringify(r.c2h)})`);
  A(r.c3 === 'Pas encore de contact entrepris', `contact « To do » re-mappé → Pas encore… (got ${r.c3})`);
  A(r.modeleIntact === 'To do,In progress,Done,Absent,Refusal',
    `le préréglage n'a PAS touché le modèle global (cloisonné par enquête) (got ${r.modeleIntact})`);
  A(r.i18n.nlNotYet === 'Nog geen contact opgenomen', `statut CATI traduit NL (got ${r.i18n.nlNotYet})`);
  A(r.i18n.deNotYet === 'Noch kein Kontakt aufgenommen', `statut CATI traduit DE (got ${r.i18n.deNotYet})`);
  A(r.i18n.enNeg === 'Negative', `statut « Négatif » traduit EN (got ${r.i18n.enNeg})`);
  A(r.i18n.enInterview === 'Interview completed', `statut « Interview réalisée » traduit EN (got ${r.i18n.enInterview})`);
  A(perr.length === 0, 'aucune erreur JS' + (perr.length ? ' → ' + perr.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
