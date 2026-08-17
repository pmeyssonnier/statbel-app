#!/usr/bin/env node
/*
 * Runner de la suite headless. Résout le binaire Chromium via Playwright (plus
 * besoin de connaître CHROMIUM_PATH), exécute chaque tests/*.test.js — ou un seul
 * fichier passé en argument — et affiche un résumé final lisible.
 *
 *   npm test                       # toute la suite
 *   npm run test:one tests/x.test.js   # un seul fichier
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Chromium : d'abord Playwright (résout le navigateur installé par
// `npx playwright install chromium`), sinon CHROMIUM_PATH, sinon on abandonne.
let chromium = '';
try { chromium = require('playwright-core').chromium.executablePath(); } catch { /* voir repli */ }
if (!chromium || !fs.existsSync(chromium)) chromium = process.env.CHROMIUM_PATH || '';
if (!chromium || !fs.existsSync(chromium)) {
  console.error('✗ Chromium introuvable.\n  → lance une fois :  npx playwright install chromium\n  (ou exporte CHROMIUM_PATH vers un binaire Chrome/Chromium)');
  process.exit(2);
}

const testsDir = path.join(__dirname, '..', 'tests');
const arg = process.argv[2];
const files = arg
  ? [path.resolve(arg)]
  : fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js')).sort().map(f => path.join(testsDir, f));

const env = { ...process.env, CHROMIUM_PATH: chromium };
const failed = [];
console.log(`Chromium : ${chromium}\n`);
for (const f of files) {
  const name = path.basename(f);
  process.stdout.write(name.padEnd(26) + ' ');
  try {
    execFileSync('node', [f], { env, stdio: 'pipe' });
    console.log('✓');
  } catch (e) {
    console.log('✗ ÉCHEC');
    const out = ((e.stdout && e.stdout.toString()) || '') + ((e.stderr && e.stderr.toString()) || '');
    out.split('\n').filter(l => /FAIL|Error|✗/.test(l)).slice(0, 5).forEach(l => console.log('    ' + l.trim()));
    failed.push(name);
  }
}
console.log('\n' + (failed.length
  ? `ÉCHEC — ${failed.length}/${files.length} : ${failed.join(', ')}`
  : `TOUS VERTS — ${files.length}/${files.length} suites`));
process.exit(failed.length ? 1 : 0);
