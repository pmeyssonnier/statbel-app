# Statbel — Suite d'outils enquêtes

Trois applications web **sans build ni dépendance externe** (tout est vendoré), pensées
pour un usage **terrain, hors-ligne**, reliées entre elles (navigation croisée dans
l'en-tête / le menu) et installables en **PWA** (GitHub Pages).

- **Convertisseur** et **Planner** restent **mono-fichier** (un seul `.html`) : ouvrables par simple double-clic (`file://`).
- **Interviews** est découpé en **modules ES** (voir [Architecture](#architecture-modules-es-sans-build)) : il doit être **servi en http(s)** (PWA / Pages, ou un serveur statique local) — les modules ES ne se chargent pas en `file://`.

| App | Fichier | Rôle |
|---|---|---|
| 📋 **Interviews** | `index.html` | Suivi des contacts à interviewer |
| 🔄 **Convertisseur** | `statbel_converter.html` | Convertit les exports bruts STATBEL en CSV importables |
| 🗓️ **Statbel Planner** | `statbel_planner.html` | Agenda des vagues d'enquête + candidature enquêteur |

Le **numéro de version** de la PWA est affiché dans chaque app (aligné sur le cache du
service worker `sw.js`).

---

## 📋 Interviews (`index.html`)

Suivi des contacts à interviewer dans le cadre des enquêtes Statbel.

### Vues
- **📋 Liste** — recherche (nom/prénom/adresse/téléphone) + filtres par statut, fiche éditable.
- **🗺️ Carte** — Leaflet, marqueurs par statut, distance depuis votre position, popup adresse.
- **📅 Suivi** — barre de progression, **graphe d'activité quotidienne** par statut + **courbe de % de Fait cumulés**, journal chronologique (clic sur une barre → filtre du jour).
- **📊 Résumé** — KPI, progression globale, **courbe d'avancement**, tableau par enquête/statut, périmètre **Toutes / Enquête active**, export **Excel / PDF**.

### Suivi des interviews
- **Statuts personnalisables** (libellé, couleur, icône, « terminé », « rendez-vous »).
- **Historique** par contact : ajout/édition d'entrées (statut + date, heure, RDV), suppression ; statut/date courants = dernière entrée.

### Import / Export
- Import **CSV / Excel** ; séparateur auto-détecté (`,` ou `;`).
- **Aperçu d'import** : lignes lues / à importer / rejetées (motifs), colonnes reconnues/ignorées.
- **Contrôles de cohérence** (code pays, date de naissance, sexe, statut) ; valeurs incohérentes **barrées en rouge**.
- **Correction automatique des codes pays** : ISO-2 → ISO-3 et alias fréquents.
- **Comparaison avant écrasement** : ajouts / modifications / suppressions / inchangés, avec détail des changements d'historique.
- **Préservation du suivi** à la réimportation ; option **« N'importer que les enregistrements corrects »**.
- Export **CSV** (séparateur configurable), **vCard** par contact, **sauvegarde/restauration JSON** complète.

### Données dérivées
- Décodage **pays** (nom localisé + ISO-2), **état civil** (genré, alias FR/NL), **âge**, **taille du ménage**.

### Interface
- **Multilingue FR / NL / EN / DE** (pivot interne = anglais ; détection au 1er lancement).
- **Apparence** : police, taille du texte, thème. **Verrouillage par code PIN** (optionnel).

### Architecture (modules ES, sans build)

`index.html` charge `js/app.js` comme **module ES** (`<script type="module">`), qui orchestre
**16 modules**. Aucun bundler : les fichiers sont servis tels quels et pré-cachés par le
service worker.

| Dossier | Modules |
|---|---|
| `js/core/` | **util** (helpers purs) · **i18n** (dictionnaire FR/NL/EN/DE + `t()`) |
| `js/data/` | **idb** (persistance IndexedDB + localStorage) · **csv** (import/export CSV) · **canon** (canonicalisation pays / état civil / statuts + libellés) |
| `js/features/` | **geocoding** (fournisseurs carte/géocodage régionaux) · **history** (historique des visites) · **import** (CSV/XLSX + appariement/comparaison) · **backup** (sauvegarde/restauration JSON) |
| `js/ui/` | **pin** (verrouillage) · **stats** (graphes & journal) · **settings** (réglages + éditeur de statuts) · **map** (carte Leaflet) · **contacts** (liste & fiche) · **rdv** (vue Suivi) · **resume** (vue Résumé) |

- **`js/app.js`** — orchestration : état, accesseurs, gestion des enquêtes, `setView`, thème/langue, cache géo, `init`.
- **`css/`** — styles (`base`, `summary`, `modals`, `mobile`) · **`vendor/`** — Leaflet + SheetJS vendorés (aucun CDN).

Les modules communiquent par `import`/`export` ; les fonctions attendues par les gestionnaires
`onclick=` du HTML et par les tests sont réexposées au global par un **pont de compatibilité**
dans `app.js`.

### Tests

`tests/` — tests **headless** (`playwright-core`, servis via un petit serveur http local
`tests/_serve.js`) : non-régression sur l'**intégrité des données**, la **robustesse** (CSV,
dates, cache), le **confort**, la **sauvegarde**, la **CSP**, le **PIN**, la **vue contacts**
et le **Planner** (consommation des plannings du Convertisseur, agrégation « Tout », libellés province).

```
CHROMIUM_PATH=/chemin/vers/chrome node tests/data-integrity.test.js
```

---

## 🔄 Convertisseur (`statbel_converter.html`)

Convertit les exports bruts STATBEL `GRP_2026xxxxx` (Excel) en **CSV importables** par
l'app Interviews.

- Aperçu des cibles, **statistiques**, **planning** ; carte Leaflet.
- Multilingue **FR / NL / EN / DE** (langue partagée avec l'app Interviews).
- Tables de correspondance (lookup) et apparence configurables.

---

## 🗓️ Statbel Planner (`statbel_planner.html`)

Agenda des vagues d'enquête (LFS / IESS…). Les **plannings trimestriels** sont ceux
**déjà importés dans le Convertisseur** (onglet « Planning ») : le Planner les lit
directement (localStorage partagé) — **plus aucun fichier à recharger ici**.

- **Sélecteur de trimestre** avec une entrée **« Tout »** qui agrège tous les trimestres
  (déduplication par n° de groupe).
- Filtres en cascade **province / commune / quartier** ; la province est affichée en
  **libellé complet** (`BRU` → Bruxelles, `BWA` → Brabant wallon…).
- Vues **Liste / Semaine / Mois / Année** (mini-calendriers colorés par vague, mise en évidence du jour).
- Exports **Excel / CSV (app Interviews) / iCal / chevauchements**.
- **Sauvegarde locale** du choix de trimestre et de la sélection (localStorage).

### Candidature enquêteur (.docx)
Pop-up qui remplit le **formulaire officiel** de candidature et le télécharge en **`.docx`**,
**100 % hors-ligne et sans dépendance** (modèle embarqué + moteur `.docx` maison : gabarit
XML tokenisé, ZIP + CRC32) :

- **Coordonnées** mémorisées sur l'appareil ; **groupes/communes** et **nombre de groupes** pré-remplis depuis la sélection.
- **Signature** dessinée à la souris / au doigt, **intégrée au document** comme image.
- **Enquête paramétrable en une seule variable**, ex. `EFT 2026-Q4` :
  - le **sigle** est développé dans le **titre** (`EFT` → « Enquête sur les Forces de Travail ») ;
  - le sigle est **conservé** dans l'en-tête du tableau et la case à cocher (« … EFT 2026-Q4 ») ;
  - dictionnaire des sigles extensible (`CAND_SURVEYS`).
- Nom de fichier : `Candidature_EFT_2026_Q4_NOMPrenom.docx`.

---

## Confidentialité (RGPD)

- Toutes les données restent **dans le navigateur** (IndexedDB / localStorage) — **aucun serveur**.
- Géocodage par **services publics belges** (UrbIS/CIRB · Bruxelles, SPW · Wallonie, Geopunt · Flandre ; OSM/Nominatim en repli) — pas de transfert hors UE.
- ⚠️ **Aucune donnée personnelle n'est versionnée** : `.gitignore` en **liste blanche stricte**
  (seuls le code des apps — HTML, `css/`, `js/`, `vendor/`, `tests/` —, les fichiers PWA,
  `README.md` et `.gitignore`). Les CSV / JSON / vCard / xlsx d'enquêtés sont exclus.
- **CSP** (Content-Security-Policy) sur les trois pages : sources verrouillées sur l'origine,
  connexions réseau limitées aux seuls géocodeurs régionaux (aucun script/style externe — tout est vendoré).

## Déploiement

Site **statique GitHub Pages** (`.nojekyll` + workflow `pages.yml`). **Service worker**
(`sw.js`) pour le fonctionnement **hors-ligne** ; cache versionné (incrémenté à chaque
mise à jour pour forcer le rafraîchissement).

---
© Consultora sprl 2026
