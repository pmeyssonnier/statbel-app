# Changelog

Toutes les évolutions notables du dépôt **statbel-app**.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/).

Le numéro de version de référence est celui de l'app **Interviews**
(`APP_VERSION` dans `js/app.js`). Chaque release bumpe aussi le `CACHE` du
service worker (`sw.js`) — indiqué entre parenthèses. Le Convertisseur et le
Planner ont leur propre `APP_VERSION` interne (entier), signalés quand ils
changent. Les tags git `vX.Y` pointent sur le commit de merge correspondant.

## [3.13] — 2026-08-14  (SW `statbel-v216`)
### Ajouté
- **CI ESLint « prudent »** (`eslint.config.js` + job `lint` dans le workflow, en
  `--max-warnings 0`) : bugs uniquement (vars/imports morts, `no-undef`, clés
  dupliquées, code mort), sans Prettier ni règle de style. Le pont `window` est
  extrait automatiquement de `app.js` pour garder `no-undef` utile.
### Corrigé / nettoyé
- Suppression du code mort remonté par le linter (helpers `colorFor`/`iconFor`,
  imports redondants dans `contacts.js`, variables inutilisées dans
  `resume.js`/`rdv.js`/`stats.js`) ; échappements regex inutiles dans `util.js`.

## [3.12] — 2026-08-14  (SW `statbel-v215`)
### Ajouté
- Alias pays **RDC**/**DRC** → `COD` (RD Congo, NIS 306) à l'import, pour lever le
  « Unknown country code » sur ces nationalités.

## [3.11] — 2026-08-14  (SW `statbel-v214`)
### Corrigé
- Import des dates au **format US `M/D/YY`** réécrit par Excel : désambiguïsation
  **au niveau de la colonne** `birth_date` (une date au 2ᵉ nombre > 12 fixe l'ordre
  « mois d'abord » pour tout le lot).

## [3.10] — 2026-08-14  (SW `statbel-v213`)
### Corrigé
- **Auto-mise à jour de la PWA installée** : `reg.update()` au démarrage + au retour
  au premier plan, et rechargement unique quand le nouveau service worker prend la
  main. Fini le « le lien installé ne se rafraîchit pas ».

## [3.9] — 2026-08-14  (SW `statbel-v212`)
### Ajouté
- **Édition du ménage** dans la fiche : taille du ménage et nombre de membres ≥15
  (`nb_cibles`) éditables manuellement (auparavant en lecture seule depuis l'import).

## [3.8] — 2026-08-14  (SW `statbel-v211`)
### Corrigé
- **Dates réécrites par Excel** tolérées au ré-import : `birth_date` re-normalisé en
  ISO, `date`/`rdv`/historique en `JJ/MM/AAAA[ HH:mm]` (heure préservée). Le contrôle
  strict reste actif (une date impossible comme 31/02 est toujours signalée).

---

## Outillage & documentation (hors version d'app)
- **CI tests headless** : workflow GitHub Actions (`.github/workflows/tests.yml`)
  qui lance tout `tests/*.test.js` (Playwright + Chromium) sur chaque push et PR.
- **`CLAUDE.md`** dégraissé (spécifique dépôt) + skills contributeur
  (`statbel-app`, `statbel-data`, `pwa-headless-test`).

## Versions antérieures (≤ 3.7)
Voir l'historique git : `git log --oneline`. Points marquants : découpage en
modules ES + pont `window`, pipeline Convertisseur → Interviews, lib de composants
`js/charts.js` (donut/table/sparkline), Planner branché sur `localStorage['plannings']`,
verrouillage du statut hors mode édition.

[3.13]: https://github.com/pmeyssonnier/statbel-app/releases/tag/v3.13
[3.12]: https://github.com/pmeyssonnier/statbel-app/releases/tag/v3.12
[3.11]: https://github.com/pmeyssonnier/statbel-app/releases/tag/v3.11
[3.10]: https://github.com/pmeyssonnier/statbel-app/releases/tag/v3.10
[3.9]: https://github.com/pmeyssonnier/statbel-app/releases/tag/v3.9
[3.8]: https://github.com/pmeyssonnier/statbel-app/releases/tag/v3.8
