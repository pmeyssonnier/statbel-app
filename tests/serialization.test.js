/*
 * Test unitaire PUR — js/data/serialization.js (sérialisation interne ↔ EN).
 *
 * Aucun navigateur : import direct du module ES, entrées explicites. Couvre le
 * renommage de clés, l'historique, la conservation des clés non mappées, et le
 * round-trip interne → EN → interne (aucune perte).
 *
 * Lancer :  node tests/serialization.test.js
 */
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const { renommerCles, contactVersEN, contactVersInterne, enquetesVersEN, enquetesVersInterne } =
    await import('../js/data/serialization.js');

  // ── renommerCles : renomme selon la map, conserve le reste ──────────
  {
    const o = renommerCles({ prenom: 'A', autre: 1 }, { prenom: 'first_name' });
    A(o.first_name === 'A' && o.autre === 1 && !('prenom' in o), 'renommerCles : renomme + conserve les clés non mappées');
  }

  // ── contactVersEN : interne (FR) → pivot EN + historique ────────────
  {
    const en = contactVersEN({ prenom: 'Alice', nom: 'Martin', statut: 'Done', gsm: '0470', email: 'a@b.be',
      historique: [{ statut: 'Done', date: '10/08' }] });
    A(en.first_name === 'Alice' && en.last_name === 'Martin' && en.status === 'Done', 'contactVersEN : clés principales renommées');
    A(en.mobile_number === '0470' && en.email === 'a@b.be', 'contactVersEN : gsm→mobile_number, clés non mappées conservées');
    A(Array.isArray(en.history) && en.history[0].status === 'Done' && en.history[0].date === '10/08',
      'contactVersEN : historique→history + statut→status');
    A(!('statut' in en) && !('historique' in en), 'contactVersEN : anciennes clés FR retirées');
  }

  // ── contactVersInterne : pivot EN → interne (FR) ────────────────────
  {
    const fr = contactVersInterne({ first_name: 'Bob', last_name: 'Durand', status: 'To do',
      history: [{ status: 'To do', date: '01/01' }] });
    A(fr.prenom === 'Bob' && fr.nom === 'Durand' && fr.statut === 'To do', 'contactVersInterne : clés principales en FR');
    A(Array.isArray(fr.historique) && fr.historique[0].statut === 'To do', 'contactVersInterne : history→historique + status→statut');
  }

  // ── round-trip interne → EN → interne : aucune perte ────────────────
  {
    const orig = { prenom: 'Carla', nom: 'Neyt', adresse: 'Rue 1', ordre: '3', sexe: 'F', statut: 'Absent',
      taille_menage: '2', gsm: '0499', rdv: '2026-08-10 14:00', email: 'c@d.be', notes: 'note libre',
      historique: [{ statut: 'To do', date: '01/08' }, { statut: 'Absent', date: '05/08' }] };
    const back = contactVersInterne(contactVersEN(orig));
    A(JSON.stringify(back) === JSON.stringify(orig), 'round-trip interne→EN→interne : identité préservée');
  }

  // ── enquêtes complètes dans les deux sens ───────────────────────────
  {
    const enq = { G1: [{ prenom: 'A', statut: 'Done' }], G2: [{ prenom: 'B' }] };
    const en = enquetesVersEN(enq);
    A(en.G1[0].first_name === 'A' && en.G1[0].status === 'Done' && en.G2[0].first_name === 'B',
      'enquetesVersEN : toutes les enquêtes et fiches converties');
    const fr = enquetesVersInterne(en);
    A(fr.G1[0].prenom === 'A' && fr.G2[0].prenom === 'B', 'enquetesVersInterne : round-trip enquêtes');
  }

  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
