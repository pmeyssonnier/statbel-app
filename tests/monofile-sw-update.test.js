/*
 * Test garde-fou PUR — les pages mono-fichier (Convertisseur, Planner) réutilisent
 * js/boot.js pour l'amorçage PWA + la bannière « Mise à jour disponible ».
 *
 * Contexte : depuis la navigation « cache d'abord » du service worker, une page
 * mono-fichier sans mécanisme de pose de mise à jour resterait figée sur l'ancienne
 * version en cache (l'utilisateur ne pouvait poser la maj que depuis Interviews).
 * En réutilisant js/boot.js, ces pages proposent elles aussi le popup opt-in.
 *
 * Ce test refuse une régression qui :
 *   1. retirerait l'inclusion de js/boot.js d'une page mono-fichier ;
 *   2. réintroduirait un enregistrement inline `navigator.serviceWorker.register` ;
 *   3. casserait le garde-manifeste de boot.js (doublon de <link rel="manifest">).
 *
 * Lancer :  node tests/monofile-sw-update.test.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

const conv = fs.readFileSync(path.join(ROOT, 'statbel_converter.html'), 'utf8');
const plan = fs.readFileSync(path.join(ROOT, 'statbel_planner.html'), 'utf8');
const boot = fs.readFileSync(path.join(ROOT, 'js', 'boot.js'), 'utf8');

for (const [nom, src] of [['Convertisseur', conv], ['Planner', plan]]) {
  A(/<script src="js\/boot\.js">/.test(src), `${nom} : inclut <script src="js/boot.js">`);
  A(!/navigator\.serviceWorker\.register/.test(src), `${nom} : plus d'enregistrement SW inline (délégué à boot.js)`);
}

// boot.js : garde-manifeste (n'injecte pas un 2e <link rel="manifest"> si la page
// en déclare déjà un en statique — cas des mono-fichiers).
A(/querySelector\('link\[rel="manifest"\]'\)/.test(boot), 'boot.js : garde anti-doublon du manifeste');
// boot.js reste bien le fournisseur du popup opt-in.
A(/signalerMajDispo/.test(boot) && /SKIP_WAITING/.test(boot), 'boot.js : conserve le popup « Mise à jour » (signalerMajDispo + SKIP_WAITING)');

console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
process.exit(fails ? 1 : 0);
