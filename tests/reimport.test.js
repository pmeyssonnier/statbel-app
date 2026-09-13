/*
 * Test unitaire PUR — js/data/reimport.js (moteur d'appariement & diff).
 *
 * Aucun navigateur : import direct du module ES, entrées explicites. Couvre le
 * cœur métier critique du réimport (préservation du suivi) — appariement
 * hiérarchique, incertains, diff d'historique, diff de fiches.
 *
 * Lancer :  node tests/reimport.test.js
 */
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const { apparieurAnciens, diffHistorique, _diffContacts } =
    await import('../js/data/reimport.js');

  // ── apparieurAnciens : priorité 1 (ordre unique + ≥1 concordance) ────
  {
    const m = apparieurAnciens([{ ordre: '1', nom: 'Martin', prenom: 'Alice', adresse: 'Rue A 1' }]);
    A(m({ ordre: '1', nom: 'Martin', prenom: 'Bob' }) !== null, 'ordre unique + nom concordant → apparié');
    A(m({ ordre: '1', nom: 'Martin', prenom: 'Alice' }) === null, 'même ancien non réapparié (déjà utilisé)');
    A(m.restants().length === 0, 'restants vide après appariement');
  }

  // ── ordre concordant mais identité divergente → incertain, non apparié ─
  {
    const m = apparieurAnciens([{ ordre: '2', nom: 'Durand', prenom: 'Bob', birth_date: '1980-05-05', adresse: 'Rue B 2' }]);
    const r = m({ ordre: '2', nom: 'Xavier', prenom: 'Yann', birth_date: '1999-09-09', adresse: 'Rue Z 9' });
    A(r === null, 'ordre concordant mais tout diverge → non apparié');
    A(m.incertains().length === 1, 'cas divergent signalé comme incertain');
    A(m.restants().length === 1, 'l\'ancien non apparié reste dans restants');
  }

  // ── même ordre + même adresse, mais identité divergente → incertain ─
  // L'adresse commune ne doit pas transférer le suivi à un autre référent.
  {
    const m = apparieurAnciens([{ ordre: '3', nom: 'Ancien', prenom: 'Alice', birth_date: '1980-01-01', adresse: 'Rue Commune 1' }]);
    const r = m({ ordre: '3', nom: 'Nouveau', prenom: 'Bob', birth_date: '1990-02-02', adresse: 'Rue Commune 1' });
    A(r === null, 'ordre+adresse concordants mais identité divergente → non apparié');
    A(m.incertains().length === 1, 'changement de référent à la même adresse signalé comme incertain');
  }

  // ── priorité 2 : nom + prénom + date de naissance (adresse changée) ──
  {
    const m = apparieurAnciens([{ nom: 'Neyt', prenom: 'Carla', birth_date: '1975-03-03', adresse: 'Rue C 3' }]);
    A(m({ nom: 'Neyt', prenom: 'Carla', birth_date: '1975-03-03', adresse: 'AUTRE' }) !== null,
      'nom+prénom+naissance → apparié malgré adresse changée');
  }

  // ── priorité 3 : nom + prénom + adresse normalisée (sans naissance) ──
  {
    const m = apparieurAnciens([{ nom: 'Otte', prenom: 'Dan', adresse: 'Rue D, 4' }]);
    A(m({ nom: 'Otte', prenom: 'Dan', adresse: 'rue d 4' }) !== null,
      'nom+prénom+adresse normalisée → apparié (ponctuation/casse ignorées)');
  }

  // ── priorité 4 : adresse seule (aucune identité) ────────────────────
  {
    const m = apparieurAnciens([{ ordre: '', nom: '', prenom: '', adresse: 'Rue E 5' }]);
    A(m({ adresse: 'RUE E 5' }) !== null, 'sans identité : adresse seule → apparié');
    A(m({ adresse: 'Rue Inconnue' }) === null, 'adresse inconnue → nouveau contact');
  }

  // ── anti-collision : les champs de la clé doivent être séparés ──────
  // « ab »+« c » et « a »+« bc » ne doivent PAS produire la même clé d'appariement
  // (sinon faux match silencieux). Même naissance pour forcer la voie nom+prénom+naissance.
  {
    const m = apparieurAnciens([{ nom: 'ab', prenom: 'c', birth_date: '1980-01-01', adresse: 'Rue X' }]);
    const r = m({ nom: 'a', prenom: 'bc', birth_date: '1980-01-01', adresse: 'Rue Y' });
    A(r === null, 'nom/prénom concaténés (ab|c vs a|bc) → pas de fausse collision');
  }

  // ── diffHistorique : unch / mod / add / rem ─────────────────────────
  {
    const d = diffHistorique(
      [{ statut: 'To do', date: '01/01' }, { statut: 'Done', date: '02/01' }],
      [{ statut: 'To do', date: '01/01' }, { statut: 'Done', date: '03/01' }, { statut: 'Absent', date: '04/01' }],
    );
    A(d.unch.length === 1 && d.mod.length === 1 && d.add.length === 1 && d.rem.length === 0,
      `diffHistorique : unch/mod/add/rem = ${d.unch.length}/${d.mod.length}/${d.add.length}/${d.rem.length}`);
    A(d.mod[0].avant === '02/01' && d.mod[0].apres === '03/01', 'diffHistorique : modification datée');

    const d2 = diffHistorique([{ statut: 'X', date: '1' }, { statut: 'X', date: '2' }], [{ statut: 'X', date: '1' }]);
    A(d2.rem.length === 1 && d2.rem[0].date === '2', 'diffHistorique : entrée retirée détectée');
  }

  // ── _diffContacts : champs + historique ─────────────────────────────
  {
    const diffs = _diffContacts(
      { nom: 'A', prenom: 'x', adresse: 'r',  statut: 'To do', historique: [{ statut: 'To do', date: '1' }] },
      { nom: 'A', prenom: 'x', adresse: 'r2', statut: 'Done',  historique: [{ statut: 'To do', date: '1' }, { statut: 'Done', date: '2' }] },
    );
    A(diffs.some(d => d.champ === 'adresse') && diffs.some(d => d.champ === 'statut') && diffs.some(d => d.champ === 'historique'),
      '_diffContacts : détecte adresse + statut + historique');
    A(diffs.length === 3, `_diffContacts : 3 changements → ${diffs.length}`);
    A(_diffContacts({ nom: 'A' }, { nom: 'A' }).length === 0, '_diffContacts : fiches identiques → aucun diff');
    const metier = _diffContacts(
      { nom: 'A', nb_cibles: 1, collect_method: 'CAPI', web_user_id: 'old', web_user_pwd: 'p1',
        historique: [{ statut: 'Done', date: '01/01/2026', heure: '09:00' }] },
      { nom: 'A', nb_cibles: 2, collect_method: 'CAWI', web_user_id: 'new', web_user_pwd: 'p2',
        historique: [{ statut: 'Done', date: '01/01/2026', heure: '10:00' }] },
    );
    ['nb_cibles','collect_method','web_user_id','web_user_pwd','historique'].forEach(champ =>
      A(metier.some(d => d.champ === champ), `_diffContacts : détecte ${champ}`));

  }

  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
