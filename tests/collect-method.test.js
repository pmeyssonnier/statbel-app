/*
 * Test unitaire PUR — js/data/collect-method.js (classification CAPI/CATI/CAWI).
 *
 * Aucun navigateur : on importe directement le module ES et on vérifie la
 * classification. Puis un « drift guard » : les deux regex du module doivent
 * rester alignées avec la copie du Convertisseur (collecteInfo, mono-fichier
 * file:// qui ne peut pas importer le module) — si l'une diverge, ce test casse.
 *
 * Lancer :  node tests/collect-method.test.js
 */
const fs = require('node:fs');
const path = require('node:path');

let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const { classerMethode, estCatiCawi, RE_CATI, RE_CAWI } =
    await import('../js/data/collect-method.js');

  // CAWI : libellés reconnus (casse indifférente)
  ['CAWI', 'cawi', 'WEB', 'Internet', 'ONLINE', 'en ligne', 'EN LIGNE'].forEach(v =>
    A(classerMethode(v) === 'cawi', `« ${v} » → cawi`));
  // CATI : libellés reconnus
  ['CATI', 'cati', 'TÉL', 'TEL', 'phone', 'TELEPH'].forEach(v =>
    A(classerMethode(v) === 'cati', `« ${v} » → cati`));
  // CAPI (face-à-face) / inconnu / vide → ''
  ['CAPI', '', null, undefined, 'face-à-face', 'XYZ'].forEach(v =>
    A(classerMethode(v) === '', `« ${v} » → '' (CAPI / inconnu)`));

  A(estCatiCawi('CATI') === true && estCatiCawi('CAWI') === true, 'estCatiCawi : CATI/CAWI → true');
  A(estCatiCawi('') === false && estCatiCawi('CAPI') === false && estCatiCawi(null) === false,
    'estCatiCawi : CAPI / vide → false');

  // Drift guard : la copie du Convertisseur (collecteInfo) doit porter EXACTEMENT les
  // mêmes regex. Comparaison bidirectionnelle (égalité du corps, pas simple inclusion) :
  // une divergence par sur-ensemble côté Convertisseur — p.ex. ajouter « |GSM » — casse
  // donc aussi ce test, pas seulement la suppression d'un motif.
  const conv = fs.readFileSync(path.join(__dirname, '..', 'statbel_converter.html'), 'utf8');
  const corpsConv = re => { const m = conv.match(re); return m ? m[1] : null; };   // corps du littéral /…/.test(u)
  A(corpsConv(/\/(CATI[^/]*)\/\.test\(u\)/) === RE_CATI.source, `Convertisseur : regex CATI identique (${RE_CATI.source})`);
  A(corpsConv(/\/(CAWI[^/]*)\/\.test\(u\)/) === RE_CAWI.source, `Convertisseur : regex CAWI identique (${RE_CAWI.source})`);

  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
