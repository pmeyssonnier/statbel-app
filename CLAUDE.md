# CLAUDE.md — statbel-app

Trois PWA **100 % hors-ligne** pour enquêteurs Statbel (Belgique), servies en
statique (GitHub Pages) ; Convertisseur et Planner ouvrables en double-clic
`file://`. Les données personnelles ne quittent jamais l'appareil.

> Les conventions transversales (identité, ton, rigueur, données perso, code
> générique, environnement machine) vivent dans le `~/.claude/CLAUDE.md` **global**
> et sont déjà actives ici. Ce fichier ne garde que le **spécifique au dépôt**.

## Architecture (prime sur le défaut « un seul fichier » du global)

**Principe : découper en modules dès le départ.** Ne pas laisser un fichier grossir puis
refactorer après coup — créer directement le(s) fichier(s) module par responsabilité. Le
**style de module** se choisit selon la livraison, pas l'inverse :

- **Interviews** (`index.html` + `js/**`) : servie http → **modules ES**
  (`import`/`export`), état sur `window`/`globalThis` ; toute fonction appelée depuis un
  `onclick=` inline doit être réexposée via `Object.assign(window, {…})` en fin de `js/app.js`.
- **Convertisseur** (`statbel_converter.html`) / **Planner** (`statbel_planner.html`) :
  page HTML **mono-page** ouvrable en `file://` (les modules ES **n'y chargent pas**), mais le
  **JS métier est découpé en scripts classiques** `<script src="js/planner/**">` — globales
  partagées, ordre d'exécution préservé (extraction verbatim, `<script src>` à la même
  position). Pas de gros bloc inline ; **libs vendorisées, jamais inline**. Le Convertisseur
  importe aussi les listings **PDF** via `js/pdfgrp.js` (+ pdf.js vendorisé).
- Lib partagée `js/charts.js` (`window.Charts` : donut/table/sparkline/lineChart) + `css/charts.css`.
- **Nouveau code** : d'emblée dans un module dédié ; tout fichier servi → l'ajouter à
  `APP_CRITICAL` (rituel de version ci-dessous).

## Invariants à ne jamais casser

- **Zéro CDN** : toute lib est vendorisée sous `vendor/` (Leaflet, SheetJS, pdf.js).
- **CSP en `<meta>`** par page (`script-src 'self' 'unsafe-inline'` ; worker pdf.js →
  `worker-src 'self' blob:`).
- **Rituel de version** (même commit) : bumper `CACHE` dans `sw.js` **+** l'`APP_VERSION`
  de chaque app modifiée ; tout nouveau fichier servi → l'ajouter à `APP_CRITICAL`.
- **`.gitignore` en liste blanche stricte** (aucune donnée perso versionnée) : un
  nouveau `.html` à la racine doit être whitelisté explicitement (`!fichier.html`).
- **i18n** : Convertisseur & Interviews en 4 langues (fr/nl/en/de) via `t('key')` +
  `data-i18n` (Planner aussi : fr/nl/en/de, sélecteur 🌐 propre) ; `esc()` sur toute donnée injectée dans le DOM.

## Skills (le détail vit là, pas ici)

- **`statbel-app`** — workflow contributeur : rituel de version complet, harnais de test
  headless, flux git/PR/merge/resync, pièges des mono-fichiers.
- **`statbel-data`** — métier LFS : n° de groupe `AAAA-VSSGG`, référent/cible/ménage,
  provinces, codes NIS pays.
- **`pwa-headless-test`** — technique de test headless (serveur éphémère + Playwright +
  seed des globals).
