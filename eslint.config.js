// eslint.config.js — configuration « prudente » (flat config, ESLint 9/10).
//
// Objectif : attraper de VRAIS bugs — variables/imports non utilisés, fautes de
// frappe (no-undef), clés dupliquées, code mort — SANS reformater ni imposer un
// style. Pas de Prettier, aucune règle stylistique.
//
// Contraintes du dépôt prises en compte :
//  - Interviews = modules ES avec état partagé sur globalThis + pont window
//    (Object.assign(window,{…})). Les fonctions du pont sont extraites
//    AUTOMATIQUEMENT de js/app.js ci-dessous et déclarées en globals : no-undef
//    ne se déclenche donc que pour un nom ni importé ni ponté — soit une vraie
//    faute de frappe, soit une fonction cross-module oubliée dans le pont (règle
//    du CLAUDE.md). La liste reste ainsi synchronisée sans entretien manuel.
//  - Libs vendorisées (Leaflet=L, SheetJS=XLSX, Charts, pdf.js) en <script> global.
//  - vendor/**, node_modules/** et fichiers minifiés hors périmètre.
//  - Convertisseur/Planner : mono-fichiers HTML → non lintés (ESLint = .js).

import fs from 'node:fs';
import js from '@eslint/js';
import globals from 'globals';

// Extrait les identifiants réexposés via Object.assign(window,{…}) dans app.js.
function pontWindowGlobals() {
  const out = {};
  try {
    const src = fs.readFileSync(new URL('./js/app.js', import.meta.url), 'utf8');
    const re = /Object\.assign\(\s*(?:window|globalThis)\s*,\s*\{([\s\S]*?)\}\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      for (const tok of m[1].split(',')) {
        const name = tok.trim().split(':')[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) out[name] = 'readonly';
      }
    }
  } catch { /* app.js absent → pas de pont, on continue */ }
  return out;
}

// État mutable partagé au-delà des modules (réassigné → 'writable'), non ponté.
const APP_STATE = {
  enquetes: 'writable', enqueteActive: 'writable', settings: 'writable',
  GEO: 'writable', db: 'writable', leafletMap: 'writable', markersLayer: 'writable',
  vueActive: 'writable', maPositionMarker: 'writable', watchId: 'writable',
  filtreActif: 'writable', filtreStatut: 'writable', filtreRecherche: 'writable',
  filtreRdv: 'writable', _activiteJour: 'writable', _journalEvents: 'writable',
  // État carte / géoloc / persistance (déclarés globalThis.* dans les modules)
  baseLayer: 'writable', _fondActuel: 'writable', _geoSession: 'writable',
  maPosition: 'writable', markerMoi: 'writable', _lastSaved: 'writable',
  // Libs vendorisées globales
  L: 'readonly', XLSX: 'readonly', Charts: 'readonly', pdfjsLib: 'readonly',
};

export default [
  // eslint.config.js lui-même est un module ESM à la racine — hors du périmètre
  // « app » (js/**) et « node » (tests/**), on ne le lint pas pour éviter une
  // mauvaise classification de sourceType.
  { ignores: ['vendor/**', '**/*.min.js', 'node_modules/**', 'eslint.config.js'] },

  js.configs.recommended,

  // App Interviews — modules ES
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...APP_STATE, ...pontWindowGlobals() },
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none',
        ignoreRestSiblings: true,   // `const {pinCode, ...rest} = settings` : omission volontaire
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-cond-assign': ['error', 'except-parens'],
      // NBSP & co. sont volontaires dans les libellés FR (chaînes/templates) :
      // on ne les signale qu'en dehors des chaînes.
      'no-irregular-whitespace': ['error', {
        skipStrings: true, skipTemplates: true, skipComments: true, skipRegExps: true,
      }],
    },
  },

  // Scripts node (tests headless, config). Les callbacks p.evaluate(() => …)
  // s'exécutent DANS le navigateur et référencent quantité de globals app —
  // no-undef y serait du bruit, on le coupe ; on garde la détection d'inutilisés.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-undef': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none',
      }],
    },
  },
];
