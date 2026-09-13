/*
 * Test unitaire PUR — js/ui/pin.js : paliers de temporisation anti-essais.
 *
 * Aucun navigateur : import direct du module ES. Couvre uniquement la fonction
 * pure `_pinDelaiTempo(fails)` (délai de gel en ms selon le nombre d'échecs
 * consécutifs) — la logique d'écran/DOM est couverte par tests/pin.test.js.
 *
 * Lancer :  node tests/pin-tempo.test.js
 */
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const { _pinDelaiTempo } = await import('../js/ui/pin.js');

  // Sous le seuil (3) : aucune temporisation
  A(_pinDelaiTempo(0) === 0, '0 échec : pas de gel');
  A(_pinDelaiTempo(2) === 0, '2 échecs (sous le seuil) : pas de gel');

  // Paliers croissants
  A(_pinDelaiTempo(3) === 30000,  '3e échec : 30 s');
  A(_pinDelaiTempo(4) === 60000,  '4e échec : 1 min');
  A(_pinDelaiTempo(5) === 120000, '5e échec : 2 min');
  A(_pinDelaiTempo(6) === 300000, '6e échec : 5 min');

  // Plafond au dernier palier
  A(_pinDelaiTempo(99) === 300000, 'au-delà : plafonné à 5 min');

  // Monotonie (jamais décroissant)
  let mono = true;
  for (let f = 0; f < 20; f++) if (_pinDelaiTempo(f + 1) < _pinDelaiTempo(f)) mono = false;
  A(mono, 'délai croissant (jamais décroissant)');

  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
