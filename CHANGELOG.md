# Changelog

Toutes les évolutions notables du dépôt **statbel-app**.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/).

Le numéro de version de référence est celui de l'app **Interviews**
(`APP_VERSION` dans `js/app.js`). Chaque release bumpe aussi le `CACHE` du
service worker (`sw.js`) — indiqué entre parenthèses. Le Convertisseur et le
Planner ont leur propre `APP_VERSION` interne (entier), signalés quand ils
changent. Les tags git `vX.Y` pointent sur le commit de merge correspondant
(exception : la 3.14, sans tag — voir la note de sa section).

## [Non publié]

Déjà en ligne (GitHub Pages déploie `main`) mais sans tag : ces changements ne
touchent pas Interviews, ils seront donc rattachés à la prochaine version d'app.

### Ajouté
- **Convertisseur (209) — KPI « Indemnité potentielle »** dans la vue Statistiques
  (SW `statbel-v270`) : montant maximal payé si toute l'enquête du groupe était
  réalisée (`ménages × quota ménage + cibles ≥ âge min × quota personne`). Quotas
  repris des **Paramètres d'Interviews** via `localStorage['statbel_settings']` ;
  « — » explicite + titre d'aide s'ils sont absents. Formule détaillée au survol,
  7ᵉ tuile désactivable via « Personnaliser les KPI », i18n 4 langues.

## [3.27] — 2026-09-04  (SW `statbel-v268` → `v269`)
### Ajouté
- **Résumé — 2ᵉ KPI « personnes ≥15 interrogées »**, avec le sous-libellé
  « sur N à interroger » = Σ des cibles ≥15 de **tous** les ménages du périmètre
  (réalisés ou non). Export XLSX aligné (ligne « 🎯 Total à interroger »).
- **Planner (183) — thème sombre** complet, piloté par `prefers-color-scheme`.
### Retiré
- Carte « 👥 Autres interrogés (hors référent) » du Résumé : elle prêtait à
  confusion en excluant implicitement les référents.

## [3.26] — 2026-09-04  (SW `statbel-v267`)
### Ajouté
- **Quotas de paiement** dans les Paramètres (indemnité par ménage réalisé et par
  personne ≥ âge cible interrogée) + **calcul des indemnités** au Résumé.

## [3.25] — 2026-09-04  (SW `statbel-v264` → `v266`)
### Ajouté
- **Planner (181) — durcissement a11y** : landmark principal, lien d'évitement,
  focus piégé et restauré dans les modales, respect de `prefers-reduced-motion`.
### Corrigé
- **KPI « interrogés » du Résumé basé sur le réalisé**, plus sur le traité.
- Planner (182) : polish a11y — contraste des textes tertiaires, bordure des
  onglets latéraux (« side-tab »).

## [3.24] — 2026-09-04  (SW `statbel-v251` → `v263`)
### Ajouté
- **Résumé — KPI « Autres interrogés (≥15, hors référent) »** *(retiré en 3.27)*.
- **Convertisseur (207-208) — durcissement a11y** : landmarks, navigation clavier,
  modales `<dialog>` avec piège de focus, puis polish contraste tertiaire et
  cibles tactiles.
- **Convertisseur (202) — bloc Sankey ménages** (taille → ≥N → âge dominant).
- **Planner (180)** : candidature `.docx` — titre centré + case à cocher au choix.
- **`PRODUCT.md` et `DESIGN.md`** : vérité produit et système visuel *incumbent*
  (rédigés à la main, l'hôte du bundle Impeccable étant bloqué en sortie réseau).
- Skill de design **Impeccable** dans `.claude/skills/`.
### Modifié
- **Convertisseur (199-206) — rangement interne** : régions logiques + table des
  matières, régions EXPORT / NORMALISATION / CHARTS / TABLES rendues physiquement
  contiguës, carte d'architecture. Même rangement pour le **Planner (179)**.
### Corrigé
- Convertisseur (203) : même hauteur pour les deux Sankey (`viewBox` commun).
- Convertisseur (205) : hauteur des donuts régulée sur mobile (lib partagée
  `js/charts.js`).
- Test a11y « lien d'évitement révélé au focus » fiabilisé (course d'animation).

## [3.23] — 2026-08-18  (SW `statbel-v250`)
### Corrigé
- **Appariement au ré-import sécurisé** : rapprochement sur le n° d'ordre avec
  contrôle de cohérence (plus de fiche écrasée par une ligne qui ne lui
  correspond pas).

## [3.22] — 2026-08-18  (SW `statbel-v235` → `v249`)
### Ajouté
- **Interviews — édition de fiche** limitée au statut, contact, note et
  historique (le reste reste piloté par l'import).
- **Convertisseur (185-198)** : drill-down treemap sur les tranches d'âge (libellé
  « LFS » retiré), bloc « Personnes à interroger (≥N) par ménage » + drill-down
  nationalités, drapeaux pays et icônes sexe/état civil dans les tables (y compris
  Lookup), colonnes du détail du ménage configurables, croix ✕ pour masquer un
  bloc à l'écran, légende H/F en bandeau permanent au-dessus des blocs, largeurs
  de colonne prédéfinies (Contacts + Lookup), entrée « Personnaliser l'affichage »
  dans le menu.
### Modifié
- Convertisseur : squelette commun pour les blocs d'analyse, colonnes du ménage en
  sous-groupe de l'onglet Colonnes, fenêtre « Personnaliser » agrandie.

## [3.21] — 2026-08-18  (SW `statbel-v224` → `v234`)
### Ajouté
- **Convertisseur (174-184) — personnalisation complète** : KPI au style du Résumé
  d'Interviews, grille 2×3 avec tuile « Taille moy. ménage », KPI affichables /
  masquables / réordonnables, blocs d'analyse personnalisables via un panneau à
  onglets, colonnes du tableau personnalisables, 3 nouveaux blocs d'analyse +
  libellé « Cibles » dynamique, et **stockage persistant** des réglages d'une
  session à l'autre.
- Popup de mise à jour plus compact (bouton « OK »).
### Modifié
- Convertisseur : Ménages avant Population totale dans les KPI ; KPI retirés de
  l'Aperçu (redondants avec Statistiques).
### Corrigé
- « % mineurs » suit l'âge cible configuré ; côté Convertisseur, il est calculé sur
  le **ménage complet** et non sur le périmètre.

## [3.20] — 2026-08-17  (SW `statbel-v223`)
### Corrigé
- **Popup de mise à jour autonome dans `index.html`** : il ne dépend plus du bundle
  mis en cache, ce qui débloque les installations figées sur une vieille version.

## [3.19] — 2026-08-17  (SW `statbel-v222`)
### Ajouté
- **a11y — passe 3** : landmarks, lien d'évitement, focus clavier visible.

## [3.18] — 2026-08-17  (SW `statbel-v221`)
### Ajouté
- **a11y — passe 2** : piège de focus, `inert` sur l'arrière-plan et restauration
  du focus à la fermeture des modales.

## [3.17] — 2026-08-17  (SW `statbel-v220`)
### Modifié
- **Mise à jour de la PWA en opt-in** : popup « Mise à jour disponible » au lieu du
  rechargement automatique (plus de perte de saisie en cours).

## [3.16] — 2026-08-17  (SW `statbel-v219`)
### Ajouté
- **a11y — passe 1** : noms accessibles et états ARIA sur les contrôles.

## [3.15] — 2026-08-17  (SW `statbel-v218`)
### Ajouté
- **Garde-fous de sauvegarde** : rappel déclenché par le **risque** (volume de
  données non sauvegardées, ancienneté) et visibilité renforcée de l'état.
- Outillage : `package.json` (`npm test` / `npm run lint`) + garde CI du **rituel
  de version** (`tools/check-version-bump.js`).
### Corrigé
- Test `statut-lock` rendu en FR pour garder le cas multilingue réellement couvert.

## [3.14] — 2026-08-16  (SW `statbel-v217`)

> ⚠️ **Seule version sans tag ni release** (v3.8 → v3.27 sont tagués). Le tag
> `v3.14` devrait pointer sur `6264e62` (merge de #80). Impossible à poser
> depuis Actions : le `GITHUB_TOKEN` est un jeton d'App et GitHub refuse un ref
> dont l'arbre `.github/workflows/*` diffère de celui de la branche par défaut
> (« refusing to allow a GitHub App to create or update workflow
> `.github/workflows/tests.yml` without `workflows` permission ») — or ce commit
> précède la refonte de `tests.yml`. L'API Git Refs oppose le même refus (403),
> et l'interface web ne sait cibler qu'une branche ou un commit récent. Pour
> combler le trou : `git push origin v3.14` depuis un clone dont les
> identifiants ont le scope `workflow`, ou un PAT *Contents + Workflows: write*
> mis en secret et utilisé par `tag-release.yml`.

### Ajouté
- **Nouveau set d'icônes Statbel** (presse-papiers + checklist) et favicon, pour
  les trois apps et la PWA installée.
- CI : workflows manuels **« Créer un tag de version »** et **« Créer une
  release »** (notes tirées du CHANGELOG, backfill des releases manquantes,
  normalisation de la casse du tag).
### Modifié
- CI : `actions/checkout` et `actions/setup-node` en v5 (fin de l'avertissement
  Node 20).

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
- **`docs/eft-cati-cawi.md`** : connaissance terrain des vagues 2 à 4 (CATI/CAWI)
  — panel à 4 vagues, bascule CAWI, les deux axes d'état côté Statbel
  (complétion du questionnaire vs feuille de contact), recrutement EBM, et ce
  que ça implique pour nos statuts. Processus uniquement, aucune donnée de ménage.
- **Pose des tags** (`tag-release.yml`) : réduit au tag unique une fois le
  backfill v3.8 → v3.27 fait (il reste dans l'historique du fichier). Casse
  normalisée (`3.28`/`V3.28` → `v3.28`), cible vérifiée, et **un tag existant
  n'est jamais déplacé en silence** : même commit → rien à faire, commit
  différent → échec explicite. Limite du `GITHUB_TOKEN` : il ne peut taguer
  qu'un commit dont les `.github/workflows/*` sont **identiques** à ceux de la
  branche par défaut ; un commit antérieur à une refonte de workflow n'est
  taguable que depuis un clone ou avec un PAT *Workflows: write* (voir la note
  de la 3.14).
- **Notes de release** (`create-release.yml`) : une section de CHANGELOG
  manquante déclenche désormais un `::warning::` (notes auto à la création,
  notes inchangées à la mise à jour) au lieu de passer inaperçue dans le log.
- **CI** : `node-version` 20 → 22 (Node 20 déprécié côté runners).

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
