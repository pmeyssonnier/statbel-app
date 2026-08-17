#!/usr/bin/env node
/*
 * Garde du RITUEL DE VERSION (exécuté en CI sur chaque PR).
 *
 * Règle : si un fichier SERVI par la PWA change (js/**, css/**, *.html à la racine,
 * manifest, icônes), alors `CACHE` dans sw.js DOIT être bumpé — sinon la version
 * installée sert l'ancien cache et le changement est invisible. En plus, tout
 * NOUVEAU fichier js/css servi doit figurer dans sw.js (sinon il manque hors-ligne).
 *
 * Usage :  node tools/check-version-bump.js <base-ref>
 *   <base-ref> = commit/branche de base (ex. le SHA de base de la PR). Défaut: origin/main.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const base = process.argv[2] || 'origin/main';
const sh = c => execSync(c, { encoding: 'utf8' });

const cacheIn = txt => (txt.match(/const CACHE = '([^']+)'/) || [])[1] || null;
const cacheAt = ref => { try { return cacheIn(sh(`git show ${ref}:sw.js`)); } catch { return null; } };

// Un fichier « servi » = qui compte pour l'app en cache (hors sw.js lui-même).
const isServed = f =>
  /^(js|css)\/.+\.(js|css)$/.test(f) ||
  /^[^/]+\.html$/.test(f) ||
  f === 'manifest.webmanifest' ||
  /\.(png|ico|svg|webmanifest)$/.test(f);

let changed, status;
try {
  changed = sh(`git diff --name-only ${base} HEAD`).split('\n').filter(Boolean);
  status  = sh(`git diff --name-status ${base} HEAD`).split('\n').filter(Boolean);
} catch (e) {
  console.error(`✗ Impossible de diff contre '${base}' : ${e.message}`);
  process.exit(2);
}

const errors = [];

// 1) Fichier servi modifié → CACHE doit changer
const servedChanged = changed.filter(f => isServed(f) && f !== 'sw.js');
if (servedChanged.length) {
  const before = cacheAt(base);
  const after  = cacheIn(fs.readFileSync('sw.js', 'utf8'));
  if (before && after && before === after) {
    errors.push(
      `Fichier(s) servi(s) modifié(s) sans bump de CACHE (sw.js reste « ${after} ») :\n  - ` +
      servedChanged.join('\n  - ') +
      `\n  → bumpe CACHE dans sw.js (+ l'APP_VERSION de l'app concernée).`);
  }
}

// 2) Nouveau fichier js/css servi → doit être listé dans sw.js
const added = status.filter(l => l.startsWith('A')).map(l => l.split('\t').pop());
const sw = fs.readFileSync('sw.js', 'utf8');
const missing = added.filter(f => /^(js|css)\/.+\.(js|css)$/.test(f) && !sw.includes(`./${f}`));
if (missing.length) {
  errors.push(
    `Nouveau(x) fichier(s) servi(s) absent(s) de sw.js (manqueront hors-ligne) :\n  - ` +
    missing.join('\n  - ') +
    `\n  → ajoute-les à APP_CRITICAL (ou APP_OPTIONAL) dans sw.js.`);
}

if (errors.length) {
  console.error('✗ Garde du rituel de version :\n\n' + errors.join('\n\n') + '\n');
  process.exit(1);
}
console.log('✓ Rituel de version respecté (CACHE bumpé si nécessaire, fichiers servis en cache).');
