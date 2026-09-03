# PRODUCT.md — statbel-app

> Vérité produit durable : à qui, pourquoi, dans quel contexte, sous quelles
> contraintes, avec quelle voix. Ce fichier décrit *le produit*, pas la direction
> visuelle (voir `DESIGN.md`). Il sert de socle stable aux décisions ultérieures.
>
> Format inspiré d'Impeccable (`/impeccable init`). Rédigé à la main : le bundle
> de skills Impeccable n'a pas pu être installé dans cet environnement (hôte
> `impeccable.style` bloqué par la politique de sortie réseau).

## Public

- **Utilisateur principal — l'enquêteur EFT/LFS de Statbel (Belgique).** Personne
  de terrain qui contacte des ménages tirés au sort pour l'Enquête sur les Forces
  de Travail. Travaille surtout **en déplacement, sur téléphone**, souvent **sans
  réseau** (caves, zones rurales, données coupées). Compétence technique variable :
  l'outil doit marcher sans configuration, sans compte, sans installation.
- **Utilisateur secondaire — le mainteneur** (auteur du dépôt) qui prépare les
  fichiers GRP, convertit, planifie sa tournée et dépose sa candidature.
- **Non-public :** ce n'est pas un produit grand public ni un SaaS. Aucune
  acquisition, aucun onboarding marketing, aucune télémétrie.

## Raison d'être

Trois PWA **100 % hors-ligne** + un outil, qui couvrent le cycle de travail d'un
enquêteur EFT sans jamais dépendre d'un serveur :

| App | Fichier | Rôle |
|-----|---------|------|
| **Interviews** | `index.html` + `js/**` | Suivi des contacts d'un groupe : statuts, historique, RDV, carte, résumé. |
| **Convertisseur** | `statbel_converter.html` | GRP → CSV, décodage REFNIS/pays/état civil, tableaux et analyses (KPI, tranches d'âge, ménages, Sankey…). |
| **Planner** | `statbel_planner.html` | Agenda LFS des interrogations, filtres, carte, et **génération de la candidature enquêteur en `.docx`**. |
| **PDF→GRP** | `statbel_pdf2grp.html` + `js/pdfgrp.js` | Extraction d'un GRP depuis un PDF officiel. |

La valeur centrale : **transformer des données administratives brutes (GRP) en
information exploitable sur le terrain**, en gardant la maîtrise totale des
données personnelles.

## Contexte opérationnel

- **Hors-ligne d'abord.** Aucune requête réseau requise à l'usage. Service worker
  (`sw.js`) qui met en cache tout le shell applicatif.
- **Deux modes de lancement.** Interviews via GitHub Pages (PWA installable) ;
  **Convertisseur et Planner ouvrables en double-clic `file://`** — d'où
  l'architecture mono-fichier de ces deux-là (les modules ES ne se chargent pas
  en `file://`).
- **Terrain mobile.** Petits écrans, tactile, une main. La densité de données doit
  rester lisible sans défilement horizontal.
- **Déploiement statique** (GitHub Pages). Pas de backend, pas de base de données
  côté serveur : l'état vit dans `localStorage` / `IndexedDB` de l'appareil.

## Contraintes non négociables

Ces invariants priment sur toute considération esthétique ou de confort :

1. **Zéro réseau à l'usage** — l'app doit être pleinement fonctionnelle avion/cave.
2. **Zéro CDN.** Toute bibliothèque est vendorisée sous `vendor/` (Leaflet, SheetJS,
   pdf.js). Jamais de `<script src="https://…">`.
3. **CSP stricte en `<meta>`** par page (`script-src 'self' 'unsafe-inline'`).
4. **Les données personnelles ne quittent jamais l'appareil.** Aucun envoi, aucune
   analytics. `.gitignore` en **liste blanche stricte** : aucune donnée réelle
   n'est jamais versionnée.
5. **i18n** — Convertisseur & Interviews en **4 langues** (fr/nl/en/de) via `t()`
   + `data-i18n` ; Planner en FR. Toute donnée injectée passe par `esc()`.
6. **Rituel de version** (même commit) — bumper `CACHE` dans `sw.js` **et**
   l'`APP_VERSION` de chaque app modifiée ; sinon le changement reste invisible
   derrière le cache du service worker.
7. **Accessibilité** — landmarks, lien d'évitement, `:focus-visible`, contrastes
   WCAG (voir `tests/a11y*.test.js`).

## Voix

- **Sobre, administrative, précise.** Registre d'un formulaire officiel belge, pas
  d'un produit lifestyle. Pas de superlatifs, pas de marketing.
- **Bilingue Belgique** (FR/NL) avec EN/DE en appoint. Terminologie métier exacte
  (référent, cible, ménage, REFNIS, groupe `AAAA-VSSGG`).
- **Neutre et factuelle.** Les libellés décrivent l'action ou la donnée, jamais le
  ressenti. Les emoji servent d'**icônes fonctionnelles** (📞 ✉️ 👥 drapeaux),
  pas de décoration.

## Preuves & sources de vérité

- `CLAUDE.md` — invariants du dépôt et architecture par app.
- Skills `statbel-app` (workflow contributeur) et `statbel-data` (métier LFS :
  n° de groupe, référent/cible/ménage, provinces, codes NIS pays).
- `docs/architecture-convertisseur.md` — cartographie en régions du Convertisseur.
- Suite `tests/**` (Playwright headless) — comportement de référence, 18 suites.
