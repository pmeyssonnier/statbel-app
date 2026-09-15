# Statbel — Suite d'outils enquêtes

Trois applications web **sans build ni dépendance externe** (tout est vendoré), pensées
pour un usage **terrain, hors-ligne**, reliées entre elles (navigation croisée dans
l'en-tête / le menu) et installables en **PWA** (GitHub Pages).

- **Convertisseur** et **Planner** restent **mono-fichier** (un seul `.html`) : ouvrables par simple double-clic (`file://`).
- **Interviews** est découpé en **modules ES** (voir [Architecture](#architecture-modules-es-sans-build)) : il doit être **servi en http(s)** (PWA / Pages, ou un serveur statique local) — les modules ES ne se chargent pas en `file://`.

| App | Fichier | Rôle |
|---|---|---|
| 📋 **Interviews** | `index.html` | Suivi des contacts à interviewer |
| 🔄 **Convertisseur** | `statbel_converter.html` | Convertit les exports bruts STATBEL (Excel/CSV/PDF) en CSV importables |
| 🗓️ **Statbel Planner** | `statbel_planner.html` | Agenda des vagues d'enquête + candidature enquêteur |

### Versions actuelles

| Composant | Version |
|---|---:|
| Interviews | **3.78** |
| Convertisseur | **235** |
| Planner | **211** |
| Cache PWA / service worker | **statbel-v376** |

Le numéro de version est affiché dans Interviews, le Convertisseur et le Planner. Le
cache versionné du service worker est incrémenté à chaque mise à jour livrée afin de
forcer le rafraîchissement des fichiers hors-ligne.

📘 **[Manuel d'utilisation illustré](docs/manuel.html)** (`docs/manuel.html`) — présentation de chaque
module avec captures d'écran ; fichier HTML autonome, ouvrable hors-ligne par double-clic.

✉️ **[Note d’utilisation des modèles de rappel](docs/templates-rappels.md)** — configuration,
variables disponibles, exemples CATI/CAWI et précautions avant envoi.

🗺️ **[Carte du code](docs/carte-du-code.html)** — vue interactive et filtrable de tous les
fichiers (module, type, taille, lignes, complexité, couverture de test, dernière modif git,
imports) + graphe de dépendances des modules ES. Page HTML autonome, ouvrable hors-ligne.

🗂️ **[Référentiels & données](docs/referentiels.html)** — dictionnaire des structures :
modèle de fiche, formats CSV/PDF/GRP, n° de groupe `AAAA-VSSGG`, codes métier et référentiel
pays NIS ↔ ISO (227 pays, 4 langues). Page HTML autonome, ouvrable hors-ligne.

---

## 📋 Interviews (`index.html`)

Suivi des contacts à interviewer dans le cadre des enquêtes Statbel.

### Vues
- **📋 Liste** — recherche (nom/prénom/adresse/téléphone) + filtres par statut, fiche éditable.
- **🗺️ Carte** — Leaflet, marqueurs par statut, distance depuis votre position, popup adresse.
- **📅 Suivi** — barre de progression, **graphe d'activité quotidienne** par statut + **courbe de % de Fait cumulés**, journal chronologique (clic sur une barre → filtre du jour).
- **📊 Résumé** — KPI, progression globale, **courbe d'avancement**, tableau par enquête/statut, périmètre **Toutes / Enquête active**, export **Excel / PDF**.

### Suivi des interviews
- **Statuts personnalisables** (libellé, couleur, icône, « terminé », « rendez-vous », « réalisé »), **propres à chaque enquête** : une enquête **CAPI** (face-à-face) et une enquête **CATI/CAWI** ne partagent pas leur vocabulaire. Le préréglage (CAPI ou « feuille de contact » CATI/CAWI) est **déduit automatiquement** de la méthode de collecte à l'import, et reste modifiable.
- **Historique** par contact : ajout/édition d'entrées (statut + date, heure, RDV), suppression ; statut/date courants = dernière entrée.

### Enquêtes CATI / CAWI
- **Pastille 📞 CATI / 🌐 CAWI** sur chaque fiche, d'après la méthode de collecte (`CD_WSH_CLCT_MTHD`) transmise par le Convertisseur.
- **Rappel ✉️ e-mail / 💬 SMS** depuis la fiche d'un contact CATI/CAWI : ouvre l'appli mail ou SMS de l'appareil avec un message prérempli. Pour le **CAWI**, il inclut le **lien du portail, l'identifiant et le mot de passe** d'accès web ; pour le **CATI**, un rappel de disponibilité. Aucun envoi automatique. Le lien du portail est configurable dans les Paramètres.
- **Identifiants d'accès web** (`TX_WEB_USER_ID` / `TX_WEB_USER_PSWRD`) importés et conservés à l'export — donnée personnelle, reste sur l'appareil.
- **Téléphone** affiché au format belge `+32 xxx xx xx xx` (lien d'appel / SMS en E.164 `+32…`).

### Import / Export
- Import **CSV / Excel** ; séparateur auto-détecté (`,` ou `;`).
- **Aperçu d'import** : lignes lues / à importer / rejetées (motifs), colonnes reconnues/ignorées (dont la **méthode de collecte** et les **identifiants d'accès web**, conservés à l'export — round-trip).
- **Contrôles de cohérence** (code pays, date de naissance, sexe, statut) ; valeurs incohérentes **barrées en rouge**.
- **Correction automatique des codes pays** : ISO-2 → ISO-3 et alias fréquents.
- **Comparaison avant écrasement** : ajouts / modifications / suppressions / inchangés, y compris le nombre de cibles, la méthode de collecte, les identifiants CATI/CAWI et le détail des changements d'historique (date, heure, statut et RDV).
- **Préservation du suivi** à la réimportation grâce à un appariement hiérarchique. Une concordance d'ordre et d'adresse n'est pas acceptée automatiquement si l'identité diffère ; le cas reste incertain afin d'éviter d'attribuer l'historique à la mauvaise personne.
- Option **« N'importer que les enregistrements corrects »**.
- Export **CSV** (séparateur configurable), **vCard** par contact, **sauvegarde/restauration JSON** complète.

### Données dérivées
- Décodage **pays** (nom localisé + ISO-2), **état civil** (genré, alias FR/NL), **âge**, **taille du ménage**.

### Interface
- **Multilingue FR / NL / EN / DE** (pivot interne = anglais ; détection au 1er lancement).
- **Apparence** : police, taille du texte, thème. **Verrouillage par code PIN** (optionnel), avec
  **déverrouillage par empreinte / Face ID** en option (WebAuthn, hors-ligne ; le PIN reste le repli).

### Architecture (modules ES, sans build)

`index.html` charge `js/app.js` comme **module ES** (`<script type="module">`), qui orchestre
**23 modules** (+ `boot.js`, chargé à part). Aucun bundler : les fichiers sont servis tels
quels et pré-cachés par le service worker.

| Dossier | Modules |
|---|---|
| `js/core/` | **util** (helpers purs) · **i18n** (dictionnaire FR/NL/EN/DE + `t()`) · **actions** (routeur d'événements `data-act` → handlers, en remplacement des `onclick=` inline) |
| `js/data/` | **idb** (persistance IndexedDB + localStorage) · **csv** (import/export CSV) · **canon** (canonicalisation pays / état civil) · **collect-method** (classification CAPI/CATI/CAWI) · **statuses** (modèle et résolution des statuts) · **reimport** (appariement et différences) · **serialization** (conversion du modèle de sauvegarde) |
| `js/features/` | **geocoding** (fournisseurs carte/géocodage régionaux) · **history** (historique des visites) · **import** (orchestration CSV/XLSX et aperçu) · **backup** (orchestration sauvegarde/restauration JSON) · **reminders** (messages de rappel CATI/CAWI) |
| `js/ui/` | **pin** (verrouillage) · **biometrie** (déverrouillage empreinte / Face ID, WebAuthn) · **stats** (graphes & journal) · **settings** (réglages + éditeur de statuts) · **map** (carte Leaflet) · **contacts** (liste & fiche) · **rdv** (vue Suivi) · **resume** (vue Résumé) |

- **`js/app.js`** — orchestration : état, accesseurs, gestion des enquêtes, `setView`, thème/langue, cache géo, `init`.
- **`js/boot.js`** — amorçage autonome (enregistrement du service worker + popup « Mise à jour disponible »), indépendant de `app.js`.
- **`css/`** — styles (`base`, `summary`, `modals`, `mobile`) · **`vendor/`** — Leaflet + SheetJS vendorés (aucun CDN).

Les modules communiquent par `import`/`export`. L'interface n'utilise **aucun gestionnaire
`onclick=` inline** : les boutons portent un attribut `data-act` routé vers le bon handler par
`js/core/actions.js` (délégation d'événements) — cohérent avec la CSP `script-src 'self'`. Les
fonctions appelées par ce routeur et par les tests sont réexposées au global par un **pont de
compatibilité** dans `app.js`.

### Tests

`tests/` — tests **headless** avec **Playwright** et Chromium, servis via un petit
serveur HTTP local (`tests/_serve.js`). Ils couvrent notamment l'**intégrité des données**,
la **robustesse** (CSV, dates, cache), le **réimport**, la **sérialisation**, les
**statuts**, les **rappels**, la **sauvegarde**, la **CSP**, le **PIN**, la vue contacts
et le **Planner**.

```bash
npm install
npm test
```

Pour exécuter une seule suite :

```bash
npm run test:one -- tests/data-integrity.test.js
```

Le script `pretest` installe Chromium via Playwright. La variable `CHROMIUM_PATH`
reste disponible comme solution de repli vers un binaire Chrome/Chromium existant.

---

## 🔄 Convertisseur (`statbel_converter.html`)

Convertit les exports bruts STATBEL `GRP_2026xxxxx` (Excel) en **CSV importables** par
l'app Interviews.

- Aperçu des cibles, **statistiques**, **planning** ; carte Leaflet.
- Multilingue **FR / NL / EN / DE** (langue partagée avec l'app Interviews).
- Tables de correspondance (lookup) et apparence configurables.
- **Lecture Excel robuste** : les identifiants numériques longs (ex. identifiant d'accès web) sont préservés en entier — plus de troncature en notation scientifique (`2.02612E+11`).
- Transmet la **méthode de collecte** (`CD_WSH_CLCT_MTHD`) et les **identifiants d'accès web** (`TX_WEB_USER_ID` / `TX_WEB_USER_PSWRD`) au CSV importable par Interviews.

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

- Toutes les données restent **dans le navigateur** (IndexedDB / localStorage) — **aucun serveur, aucune analytics**. Les seules sorties de données sont les deux actions ci-dessous, **déclenchées par vous**.
- **Rappels e-mail / SMS** : ouvrir un rappel ne fait que **pré-remplir** l'appli mail ou SMS *de votre appareil* — l'app n'envoie rien elle-même. Le message, et pour le **CAWI** l'**identifiant et le mot de passe** d'accès web du ménage, sont alors transmis à cette appli tierce puis au destinataire que vous choisissez. À n'utiliser que pour joindre la personne concernée.
- **Géocodage** : lorsqu'une adresse est géocodée, **cette adresse** (donnée personnelle) est envoyée **uniquement** aux **services publics belges** (UrbIS/CIRB · Bruxelles, SPW · Wallonie, Geopunt · Flandre) — **pas de transfert hors UE**. Le géocodage OSM/Nominatim a été **retiré** (tiers hors UE). Le **fond de carte** provient d'OpenStreetMap, mais ce sont des **tuiles-images sans donnée personnelle**. Le mode de navigation par **point GPS** garde votre position sur l'appareil.
- ⚠️ **Aucune donnée personnelle n'est versionnée** : `.gitignore` en **liste blanche stricte**
  (seuls le code des apps — HTML, `css/`, `js/`, `vendor/`, `tests/` —, les fichiers PWA,
  `README.md` et `.gitignore`). Les CSV / JSON / vCard / xlsx d'enquêtés sont exclus.
- **CSP** (Content-Security-Policy) sur les quatre pages : sources verrouillées sur l'origine,
  connexions réseau limitées aux seuls géocodeurs régionaux (aucun script/style externe — tout est vendoré).

## Déploiement

Site **statique GitHub Pages** (`.nojekyll` + workflow `pages.yml`). **Service worker**
(`sw.js`) pour le fonctionnement **hors-ligne** ; cache versionné (incrémenté à chaque
mise à jour pour forcer le rafraîchissement).

---
© Consultora sprl 2026
