# Statbel Converter — Architecture Map

> Cartographie fonctionnelle et technique du Convertisseur Statbel (`statbel_converter.html`).
>
> Objectif : donner une vue claire des responsabilités, dépendances et zones de complexité du fichier principal sans casser le fonctionnement autonome en `file://`.

---

## 1. Vue d’ensemble

Le fichier principal `statbel_converter.html` contient l’essentiel de l’application Convertisseur : interface, import, normalisation, conversion, statistiques, graphiques, personnalisation, export et gestion des plannings.

La taille brute du fichier est principalement due à la bibliothèque SheetJS/XLSX embarquée afin de conserver le fonctionnement autonome hors serveur.

```text
statbel_converter.html
   │
   ├── SheetJS / XLSX embarqué
   │      └── lecture / écriture Excel
   │
   └── Code applicatif Statbel
          ├── DATA / I18N
          ├── IMPORT
          ├── NORMALISATION
          ├── CONVERSION
          ├── AFFICHAGE / UI
          ├── TABLES
          ├── ANALYTICS
          ├── CHARTS
          ├── PERSONNALISATION
          ├── EXPORT
          ├── PLANNING
          └── ÉVÉNEMENTS / INIT
```

---

## 2. Carte fonctionnelle globale

```text
                 FICHIERS STATBEL
                       │
                       ▼
               ┌───────────────┐
               │    IMPORT     │
               └───────┬───────┘
                       │
                       ▼
               ┌───────────────┐
               │ NORMALISATION │
               └───────┬───────┘
                       │
                       ▼
              ┌─────────────────┐
              │   CONVERSION    │
              │   cœur métier   │
              └────────┬────────┘
                       │
             ┌─────────┼─────────┐
             │         │         │
             ▼         ▼         ▼
          TABLES   ANALYTICS   EXPORT
                       │
                       ▼
                    CHARTS

             DATA ─────┼───── UI
                       │
              PERSONNALISATION

       FICHIERS PLANNING
              │
              ▼
           PLANNING
              │
              ▼
     localStorage["plannings"]
              │
              ▼
        STATBEL PLANNER
```

---

## 3. DATA / I18N

### Rôle

Contient les référentiels et traductions nécessaires au fonctionnement de l’application.

```text
Traductions FR / NL / EN / DE
Pays
   ├── codes
   ├── noms
   └── traductions
Sexe
État civil
Communes
REFNIS / NIS
Provinces
Régions
NUTS
En-têtes / colonnes
```

### Responsabilités

- dictionnaires i18n ;
- libellés multilingues ;
- tables de référence ;
- correspondances pays / communes / régions ;
- colonnes et en-têtes attendus.

### Complexité

**Moyenne en volume, faible à moyenne en logique.**

Beaucoup de lignes correspondent à des données de référence plutôt qu’à de la logique métier.

---

## 4. IMPORT

### Rôle

Porte d’entrée des fichiers Statbel.

```text
Fichier
   ↓
Détection du format
   ↓
Détection du séparateur
   ↓
Lecture des lignes / cellules
   ↓
Détection des colonnes
   ↓
Données brutes
```

### Responsabilités

- lecture CSV ;
- lecture TSV ;
- lecture Excel ;
- détection du séparateur ;
- découpage des lignes ;
- reconnaissance des colonnes ;
- préparation des données brutes.

### Complexité

**Moyenne.**

Le module doit rester centré sur la lecture des fichiers et éviter d’embarquer de la logique métier.

---

## 5. NORMALISATION

### Rôle

Transformer les données Statbel brutes en valeurs cohérentes et exploitables par le reste de l’application.

```text
Date brute
      ↓
Date normalisée

Code REFNIS
      ↓
Commune / arrondissement / province / région / NUTS

Code pays
      ↓
Pays canonique

Code état civil
      ↓
Libellé canonique
```

### Responsabilités

- normalisation des dates ;
- normalisation des adresses ;
- décodage REFNIS ;
- décodage pays ;
- décodage état civil ;
- harmonisation des valeurs avant conversion.

### Complexité

**Élevée.**

Beaucoup d’autres modules dépendent de la qualité de cette couche.

---

## 6. CONVERSION

### Rôle

Cœur métier du Convertisseur.

```text
Données GRP / source
        ↓
Ménages
        ↓
Membres
        ↓
Personnes cibles
        ↓
Données calculées
        ↓
Format exploitable par Interviews / analyses / exports
```

### Responsabilités

- structuration des ménages ;
- regroupement des membres ;
- transformation des données Statbel ;
- calcul des champs dérivés ;
- production du modèle interne de données ;
- préparation des formats de sortie.

### Complexité

**Très élevée / critique.**

C’est la zone la plus importante à protéger lors de tout refactoring.

Principe recommandé :

```text
════════════════════════════════════
CONVERSION PRINCIPALE — NE PAS MÉLANGER UI
════════════════════════════════════
```

---

## 7. TABLES

### Rôle

Afficher et manipuler les données tabulaires du Convertisseur.

```text
Aperçu Contacts
Membres du ménage
Lookup pays
Lookup communes
Autres tables de référence
```

### Responsabilités

- définition des colonnes ;
- ordre des colonnes ;
- colonnes visibles ;
- largeur ;
- tri ;
- rendu spécifique ;
- drapeaux et libellés ;
- tableaux ménages / contacts / lookup.

### Registres associés

```text
COL_DEFS
HH_COL_DEFS
...
```

### Complexité

**Élevée.**

Le registre de colonnes est préférable à une multiplication de conditions réparties dans plusieurs fonctions.

---

## 8. ANALYTICS

### Rôle

Calculer les indicateurs et répartitions statistiques.

```text
Nombre de contacts
Nombre de ménages
Sexe
Âges
Nationalités
Pays de naissance
État civil
Taille des ménages
Régions
Provinces
Communes
Autres répartitions
```

### Responsabilités

- calcul des KPI ;
- agrégations ;
- regroupements ;
- statistiques ;
- préparation des données pour les graphiques.

### Structures associées

```text
majStats
BLOC_DEFS
RENDERERS
```

### Complexité

**Élevée mais bien structurée lorsque les blocs passent par des registres.**

---

## 9. CHARTS

### Rôle

Transformer les données analytiques en représentations visuelles.

```text
Barres
Barres empilées
Donut
Treemap
100 %
Pyramide des âges
Sankey
...
```

### Principe architectural

```text
ANALYTICS
   │
   │ données préparées
   ▼
CHARTS
   │
   ▼
SVG / HTML
```

Les graphiques ne devraient pas recalculer eux-mêmes les données métier.

### Bibliothèque partagée

`js/charts.js` peut fournir des composants communs tels que :

```text
sparkline()
donut()
lineChart()
table()
```

### Complexité

**Élevée.**

---

## 10. PERSONNALISATION

### Rôle

Permettre à l’utilisateur de configurer l’affichage du Convertisseur.

```text
KPI visibles
Blocs visibles
Ordre des blocs
Colonnes visibles
Largeur des colonnes
...
```

### Registres associés

```text
PERSO
BLOC_DEFS
COL_DEFS
```

### Complexité

**Moyenne.**

L’utilisation de registres permet d’éviter de dupliquer la logique entre HTML, paramètres, rendu et menus.

---

## 11. EXPORT

### Rôle

Produire les fichiers ou rapports de sortie à partir des données déjà converties.

```text
Données converties
      │
      ├── CSV Interviews
      ├── Excel
      ├── Rapports
      └── Autres téléchargements
```

### Fonctions typiques

```text
toCsv()
telecharger()
```

### Principe recommandé

EXPORT doit sérialiser des données déjà prêtes plutôt que recalculer les données métier.

### Complexité

**Moyenne.**

---

## 12. PLANNING

### Rôle

Gérer les fichiers de planning Statbel à l’intérieur du Convertisseur puis transmettre les données au Planner.

```text
Fichier planning Statbel
        ↓
CONVERTISSEUR
        ↓
Normalisation planning
        ↓
localStorage["plannings"]
        ↓
PLANNER
```

### Responsabilités

- import des plannings ;
- normalisation ;
- analyse ;
- stockage persistant ;
- éventuelle cartographie ;
- fourniture des données au Planner.

### Complexité

**Élevée.**

C’est pratiquement une sous-application autonome du Convertisseur.

---

## 13. AFFICHAGE / UI

### Rôle

Orchestrer l’interface visible par l’utilisateur.

```text
Bandeau
Menus
Onglets
Cartes
Sections
Modales
Thème
Langues
Aide
Rapport
```

### Responsabilités

- affichage ;
- navigation ;
- modales ;
- interactions utilisateur ;
- thèmes ;
- langues ;
- orchestration des autres modules.

### Principe recommandé

Éviter que la couche UI recalcule directement de la logique métier.

### Complexité

**Moyenne à élevée.**

---

## 14. ÉVÉNEMENTS / INITIALISATION

### Rôle

Démarrer l’application et relier les événements aux fonctions correspondantes.

```text
Boutons
Inputs
Onglets
Événements
localStorage
Préférences
      ↓
INITIALISATION
      ↓
Application prête
```

### Responsabilités

- `addEventListener` ;
- initialisation des préférences ;
- lecture du stockage local ;
- activation des menus ;
- lancement du premier rendu.

### Complexité

**Faible à moyenne**, mais avec beaucoup de dépendances.

---

## 15. Dépendances principales

```text
DATA / I18N
   ├── NORMALISATION
   ├── TABLES
   ├── ANALYTICS
   └── UI

IMPORT
   ↓
NORMALISATION
   ↓
CONVERSION
   ├── TABLES
   ├── ANALYTICS
   ├── EXPORT
   └── PLANNING

ANALYTICS
   ↓
CHARTS

PERSONNALISATION
   ├── TABLES
   ├── ANALYTICS
   └── UI

PLANNING
   ↓
localStorage["plannings"]
   ↓
STATBEL PLANNER
```

---

## 16. Classement des zones par difficulté de maintenance

1. **CONVERSION** — cœur métier, zone la plus sensible.
2. **NORMALISATION** — nombreuses dépendances fonctionnelles.
3. **PLANNING** — sous-application presque autonome.
4. **ANALYTICS / CHARTS** — grande surface fonctionnelle.
5. **TABLES** — nombreuses interactions avec UI et personnalisation.
6. **IMPORT** — sensible mais bien délimitable.
7. **EXPORT** — relativement facile à isoler.
8. **PERSONNALISATION** — simplifiée par les registres.
9. **UI / INIT** — volumineux mais moins critique pour la cohérence métier.

---

## 17. Priorités pour un futur refactoring

Le Convertisseur peut rester compatible `file://` tout en améliorant progressivement sa structure interne.

### Priorité 1 — protéger le cœur métier

Séparer clairement :

```text
IMPORT
NORMALISATION
CONVERSION
```

Ces trois zones constituent la chaîne de traitement la plus critique.

### Priorité 2 — éviter les doubles calculs

Les statistiques doivent suivre :

```text
CONVERSION
   ↓
ANALYTICS
   ↓
CHARTS / TABLES / EXPORT
```

Les graphiques et exports ne devraient pas recalculer eux-mêmes les règles métier.

### Priorité 3 — continuer les registres déclaratifs

Favoriser :

```text
COL_DEFS
BLOC_DEFS
RENDERERS
PERSO
```

plutôt que des séries de `if` réparties dans le code.

### Priorité 4 — isoler conceptuellement PLANNING

Même s’il reste physiquement dans le fichier HTML, PLANNING doit rester clairement séparé des données Contacts / Ménages.

---

## 18. Architecture cible sans casser `file://`

Une architecture logique propre peut être conservée même dans un seul HTML :

```text
statbel_converter.html
│
├── CONFIG / DATA
│
├── IMPORT
│
├── NORMALISATION
│
├── CONVERSION
│
├── TABLES
│
├── ANALYTICS
│
├── CHARTS
│
├── PERSONNALISATION
│
├── EXPORT
│
├── PLANNING
│
├── UI
│
└── INIT
```

Cette organisation permet de garder les avantages du fichier autonome tout en rendant le code plus lisible et plus facile à auditer.

---

## 19. Résumé

Le Convertisseur n’est pas un simple utilitaire de formatage : c’est une application complète de traitement et d’analyse de données Statbel.

Son architecture peut être résumée ainsi :

```text
IMPORT
   ↓
NORMALISATION
   ↓
CONVERSION
   ↓
┌──────────────┬───────────────┬───────────────┐
│              │               │               │
TABLES      ANALYTICS        EXPORT         PLANNING
               │                               │
               ▼                               ▼
             CHARTS                          PLANNER

DATA / I18N ───────► toutes les couches
PERSONNALISATION ─► UI / TABLES / ANALYTICS
UI / INIT ─────────► orchestration générale
```

Le point central à préserver est la séparation entre **lecture des données**, **normalisation**, **logique métier**, **analyse** et **présentation**.
