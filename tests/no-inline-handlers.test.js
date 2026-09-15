/*
 * Test garde-fou PUR — verrouille l'acquis du chantier de délégation (lot 6).
 *
 * Analyse la source servie par l'app Interviews (index.html + js/**) et refuse :
 *   1. tout handler d'événement inline (`onclick="…"`, `oninput="…"`, etc.) —
 *      statique OU généré dans un template JS ;
 *   2. tout bloc <script> inline (sans src) dans index.html ;
 *   3. la présence de `'unsafe-inline'` dans la directive `script-src` de la CSP.
 *
 * Ces trois points sont interdépendants : la CSP stricte n'est tenable que si
 * plus aucun script/handler inline n'existe. Ce test échoue si une régression
 * réintroduit l'un des trois. (Le Convertisseur et le Planner, mono-fichiers
 * `file://`, gardent leurs scripts inline et NE SONT PAS concernés ici.)
 *
 * Lancer :  node tests/no-inline-handlers.test.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

// Collecte récursive des fichiers .js sous js/ + index.html
// js/planner/** = modules extraits du Planner (mono-fichier file://) : scripts
// classiques qui conservent leurs handlers inline — hors périmètre de ce garde-fou
// Interviews (cf. en-tête), on les exclut de la collecte.
function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'planner' ? [] : jsFiles(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}
const fichiers = ['index.html', ...jsFiles(path.join(ROOT, 'js')).map(p => path.relative(ROOT, p))];

// Handlers inline : attribut on<event>= suivi d'un guillemet (cible le markup,
// pas les affectations JS `el.onclick = …` qui utilisent un point + espaces).
const EVT = 'click|change|input|keydown|keyup|keypress|mousedown|mouseup|dblclick|' +
  'blur|focus|focusin|focusout|submit|reset|scroll|wheel|contextmenu|' +
  'drag|dragstart|dragend|dragover|drop|paste|copy|cut|' +
  'touchstart|touchend|touchmove|pointerdown|pointerup|pointermove|load|error';
const RE_INLINE = new RegExp('\\son(' + EVT + ')=["\']', 'g');

let totalHandlers = 0;
for (const rel of fichiers) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const hits = src.match(RE_INLINE) || [];
  if (hits.length) { totalHandlers += hits.length; console.log(`   ↳ ${rel} : ${hits.length} handler(s) inline (${[...new Set(hits)].join(', ')})`); }
}
A(totalHandlers === 0, `aucun handler d'événement inline dans index.html + js/** (trouvé : ${totalHandlers})`);

// index.html : aucun <script> sans src (bloc inline)
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptsInline = (html.match(/<script(?![^>]*\ssrc=)[^>]*>/g) || []);
A(scriptsInline.length === 0, `aucun <script> inline dans index.html (trouvé : ${scriptsInline.length})`);

// CSP : script-src sans 'unsafe-inline'
const csp = (html.match(/Content-Security-Policy"\s+content="([^"]*)"/) || [])[1] || '';
const scriptSrc = (csp.match(/script-src([^;]*)/) || [])[1] || '';
A(scriptSrc.length > 0, 'CSP : directive script-src présente');
A(!/unsafe-inline/.test(scriptSrc), `CSP : script-src sans 'unsafe-inline' (got "${scriptSrc.trim()}")`);

console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
process.exit(fails ? 1 : 0);
