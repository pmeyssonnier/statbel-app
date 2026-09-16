/*
 * Test de non-régression — bug M6 (sécu) : tout lien `target="_blank"` doit porter
 * `rel="noopener"` (sinon la page ouverte peut manipuler `window.opener` — reverse
 * tabnabbing). Idem `window.open(..., '_blank', …)` qui doit inclure « noopener ».
 *
 * Scan STATIQUE des fichiers servis (js/**, HTML racine, docs/*.html) — pur Node,
 * sans navigateur. Garde repo-wide : un futur lien sans rel casse la CI.
 *
 * Lancer :  node tests/noopener.test.js
 */
const fs = require('node:fs');
const path = require('node:path');

let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

const root = path.join(__dirname, '..');

// Fichiers servis à vérifier : tout js/**, les 3 pages racine, les docs HTML.
function walkJs(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') walkJs(f, acc); }
    else if (e.name.endsWith('.js')) acc.push(f);
  }
  return acc;
}
const files = walkJs(path.join(root, 'js'), [])
  .concat(['index.html', 'statbel_converter.html', 'statbel_planner.html'].map(f => path.join(root, f)))
  .concat(fs.existsSync(path.join(root, 'docs'))
    ? fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.html')).map(f => path.join(root, 'docs', f))
    : []);

const violations = [];
let anchorsBlank = 0, opensBlank = 0;

for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const rel = path.relative(root, f);

  // 1. Balises <a … target="_blank" …> — le rel (avec « noopener ») doit être dans la MÊME balise.
  const reA = /<a\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi;
  let m;
  while ((m = reA.exec(txt))) {
    anchorsBlank++;
    if (!/\brel\s*=\s*["'][^"']*noopener/i.test(m[0])) {
      violations.push(`${rel}: <a target="_blank"> sans rel=noopener → …${m[0].slice(0, 80)}…`);
    }
  }

  // 2. window.open(url, '_blank', 'features…') — les « features » doivent contenir noopener.
  const reO = /window\.open\s*\(([^;]*?)\)/gi;
  while ((m = reO.exec(txt))) {
    if (/["']_blank["']/.test(m[1])) {
      opensBlank++;
      if (!/noopener/i.test(m[1])) violations.push(`${rel}: window.open('_blank') sans noopener → ${m[1].trim().slice(0, 80)}`);
    }
  }
}

A(anchorsBlank >= 6, `au moins les liens target="_blank" connus sont scannés (trouvés ${anchorsBlank})`);
A(violations.length === 0, violations.length ? ('liens non sécurisés :\n   - ' + violations.join('\n   - ')) : `aucun lien target="_blank" sans rel=noopener (${anchorsBlank} ancres, ${opensBlank} window.open vérifiés)`);

console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
process.exit(fails ? 1 : 0);
