# DESIGN.md — statbel-app

> Système visuel *incumbent* : les couleurs, la typographie, les composants et les
> règles réellement en place dans le dépôt. À lire avant toute modification d'UI ;
> à mettre à jour quand le système évolue. Décisions produit dans `PRODUCT.md`.
>
> Tokens relevés dans `css/base.css`, `statbel_converter.html`, `statbel_planner.html`.
> Rédigé à la main (bundle Impeccable indisponible ici — hôte `impeccable.style`
> bloqué par la politique de sortie réseau).

## Direction (brand lane)

**Outil administratif officiel belge — sobre, dense, fiable.** Le registre est
celui d'un formulaire d'État : indigo institutionnel, tables denses, hiérarchie
claire. La **fiabilité et la lisibilité priment sur l'effet**. Pas de hero, pas de
dégradé décoratif, pas d'animation gratuite. Chaque pixel sert la donnée.

**Thème-aware** : clair par défaut, sombre complet, pilotés par des *custom
properties* CSS redéfinies sous `@media (prefers-color-scheme: dark)`. Toute
couleur passe par un token — jamais de littéral en dur dans un composant.

## Couleur

### Couleur de marque
- **Indigo 900 `#1a237e`** — couleur primaire commune aux trois apps (en-tête
  Interviews, `--bleu` Convertisseur, base de l'ink Planner). C'est l'ancre visuelle.

### Tokens par app (clair → sombre)

**Interviews** (`css/base.css`)
- `--bg #f0f2f5` · `--card-bg #fff` · `--text #222 / #444 / #666`
- `--header-bg #1a237e` (sombre `#0d1257`) · `--focus-ring #0b57d0` (sombre `#8ab4f8`)
- `--ordre-bg #e8eaf6` · `--border #ccc`

**Convertisseur** (`statbel_converter.html`)
- `--bleu #1a237e` · `--gold #f9a825` · `--vert #2e7d32`
- fond `--gris #f0f2f5` · `--card2 #e8eaf6` · `--hover #d0d5f5`
- **barres genrées** : `--bar-h #1a237e` (hommes) / `--bar-f #c2185b` (femmes)
- sombre : `--accent #aab4ff`, barres `#7986cb` / `#ef5e8c`

**Planner** (`statbel_planner.html`)
- ink `#1a1f2e / #3d4460 / #7b82a0` · `--bg #f4f6fb` · `--card #fff`
- `--accent #2255cc` · `--accent2 #1a42a0` · `--border #dde2f0`
- accent d'action candidature : **violet `#7b22cc`**

### Couleurs sémantiques (partagées)
- **Or `#f9a825`** — attention / jeunes (<15) · **Vert `#2e7d32`** — ok / actifs
- **Rouge `#c62828`** — alerte · **Brun `#8d6e63`** — âgés (65+)
- Le sémantique est **distinct de l'accent** : il code un état, pas une marque.

### Palette catégorielle (graphiques)
15 teintes stables, dans l'ordre, pour donuts/treemaps/séries (`PALETTE` du
Convertisseur) :
`#1a237e #00897b #f9a825 #6a1b9a #c62828 #2e7d32 #0277bd #ef6c00 #5d4037 #ad1457 #558b2f #4527a0 #00838f #9e9d24 #d84315`

## Typographie

- **Pile système** : `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial,
  sans-serif`. Aucune webfont (contrainte zéro-CDN). Rendu natif, léger, hors-ligne.
- **Corps 14px** (`--app-font-size`), échelle modeste. Pas de display face.
- **Chiffres alignés** dans les tables et KPI (colonnes de valeurs, `.bar-val`).

## Mise en page & espacement

- **Cartes** sur fond neutre (`--card-shadow: 0 1px 4px rgba(0,0,0,.1)`), coins
  arrondis discrets.
- **Mobile-first, une main.** Le corps ne défile jamais horizontalement : tout
  contenu large (tables, graphes) scrolle dans son propre conteneur `overflow-x`.
- Densité assumée : beaucoup de données par écran, hiérarchie par taille/graisse
  plutôt que par espace vide.

## Composants récurrents

- **Cartes de bloc** (`.card` / `.blk-*`) — unité d'affichage des analyses, avec
  titre + croix ✕ de masquage, pilotées par un registre (`BLOC_DEFS`).
- **Tables triables denses** — Aperçu contacts + accordéon ménage, tables de
  correspondance (lookup Pays/Communes), colonnes configurables (`COL_DEFS` /
  `HH_COL_DEFS`), drapeaux 🇧🇪 et icônes ♂/♀/💍 en Unicode (hors-ligne).
- **Tuiles KPI** (`KPI_DEFS`) — chiffre + libellé, personnalisables.
- **Graphiques maison, SVG inline** (`js/charts.js` `window.Charts` + primitives
  du Convertisseur) : barres, barres empilées, donut, treemap, pyramide des âges,
  Sankey. Ne recalculent pas de métier — ANALYTICS prépare, CHARTS dessine.
  Donuts à taille compacte homogène sur mobile (`DONUT_SIZE`).
- **Modales** — paramètres, personnalisation de l'affichage, mapping planning.
- **Barres de filtres** (`--filter-*`) — bordées d'indigo, sélection en cascade.

## Motion

- **Minimal et fonctionnel.** Ex. lien d'évitement révélé par transition `.15s`.
- **`prefers-reduced-motion: reduce` respecté** (les transitions sont neutralisées).

## Accessibilité (non négociable)

- Landmarks (`<header>` bannière, `<main id="contenu">`), **lien d'évitement**
  premier focusable, révélé au focus clavier.
- Anneau de focus clavier via `:focus-visible` (contraste ≥ 3:1).
- Contrastes texte WCAG ; `esc()` sur toute donnée injectée.

## Anti-références (à éviter)

- ❌ L'esthétique « AI slop » : dashboard générique, dégradé violet→bleu en hero,
  cartes arrondies flottantes sans contenu, emoji comme marqueurs de section
  décoratifs. *(Ici les emoji sont des icônes fonctionnelles — 📞 ✉️ 👥 drapeaux —
  jamais du décor.)*
- ❌ Webfonts / ressources CDN (viole zéro-CDN + hors-ligne).
- ❌ Animation ou parallaxe décorative ; tout mouvement doit servir la lecture.
- ❌ Couleur en dur dans un composant : toujours via token, pour rester thème-aware.
- ❌ Défilement horizontal de la page ; confiner le large dans un conteneur scrollable.
- ❌ Introduire une couleur hors des palettes ci-dessus sans raison sémantique.
