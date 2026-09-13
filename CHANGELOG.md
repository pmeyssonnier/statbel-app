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

### Modifié
- **Interviews — délégation d'événements des fiches contact (lot 5 du chantier `onclick`)**
  (Interviews 3.57 → 3.58, SW `statbel-v325` → `statbel-v326`) : les 31 handlers inline de
  `js/ui/contacts.js` (le module le plus dense) — barre de statut, formulaire d'édition (GSM, e-mail
  avec suggestions, notes, RDV date/heure), boutons rappel/vCard/sauver, filtres, historique
  (statut, dates, RDV, ajout/suppression), suggestions e-mail — passent de `on*=` inline à `data-act`
  routé par `js/core/actions.js`. Le routeur gère désormais aussi `dblclick`, `mousedown` et
  `focusout` (variante propagée de `blur`, qui ne « bulle » pas). La carte n'ayant pas de handler de
  clic propre, la délégation cible naturellement le bouton le plus proche → les `event.stopPropagation()`
  deviennent inutiles et sont retirés. Actions enregistrées dans `js/app.js`. **`index.html` et
  l'ensemble des modules JS ne contiennent plus aucun handler inline.** Aucun changement de
  comportement visible ; pont `window` inchangé (allègement au lot 6, avec le durcissement CSP).
  Nouveau test `tests/contacts-delegation.test.js`.

### Corrigé
- **Interviews — cohérence HTML/JS du Service Worker (navigation cache-first)** (Interviews
  3.56 → 3.57, SW `statbel-v324` → `statbel-v325`) : le SW servait `index.html` **frais (réseau)**
  alors que les scripts restaient servis **« cache d'abord »**. Pendant la fenêtre de mise à jour
  (nouveau SW « en attente »), un `index.html` neuf pouvait donc être servi avec un `app.js` encore
  périmé → **HTML et JS désynchronisés**. Depuis la migration `onclick`→`data-act`, ce décalage
  devenait visible : les boutons portaient `data-act` mais l'ancien `app.js` n'enregistrait aucune
  action → **interface figée** (onglets sans effet). La navigation est désormais **cache-first** :
  HTML et scripts proviennent toujours de la même version du cache. Le popup « Mise à jour
  disponible » reste servi (il vit dans l'`index.html` en cache, présent dans toutes les versions)
  et le cycle SW (nouveau cache → « Poser » → `SKIP_WAITING` → `activate`/`claim` → reload) fait
  basculer HTML **et** scripts **atomiquement** vers la nouvelle version.

### Modifié
- **Interviews — délégation d'événements de la vue Résumé (lot 4 du chantier `onclick`)**
  (Interviews 3.55 → 3.56, SW `statbel-v323` → `statbel-v324`) : les 10 handlers générés par
  `js/ui/resume.js` (filtres de portée `all`/`active`, filtres de méthode `all`/CAPI/CATI/CAWI,
  exports XLSX/PDF) et `js/ui/stats.js` (colonne d'activité quotidienne, brique d'événement de la
  frise) passent de `onclick` à `data-act` routé par `js/core/actions.js`. La colonne d'activité
  réutilise son `data-iso` existant (déjà lu ailleurs pour le cumul de progression) : l'action
  `filtrerActiviteJour` lit désormais `data-iso` **ou** `data-jour`. Actions enregistrées dans
  `js/app.js`. Aucun changement de comportement visible ; pont `window` inchangé. Nouveau test
  `tests/resume-delegation.test.js`. Après ce lot, seul `js/ui/contacts.js` (lot 5) reste à migrer
  avant le durcissement CSP.
- **Interviews — délégation d'événements des vues Carte / Suivi / Import (lot 3 du chantier
  `onclick`)** (Interviews 3.54 → 3.55, SW `statbel-v322` → `statbel-v323`) : les 12 derniers
  handlers inline de `index.html` (import CSV, bouton recentrer la carte, recherche RDV, modale
  d'aperçu d'import) et ceux générés par `js/ui/map.js`, `js/ui/rdv.js`, `js/features/import.js`
  passent de `on*=` inline à `data-act` routé par `js/core/actions.js`. **`index.html` ne contient
  plus aucun handler inline.** Les paramètres (index de fiche, libellé de filtre, jour, bloc de
  comparaison) sont portés par `data-*` (le navigateur décode les entités à la lecture → `esc()` à
  l'écriture est un round-trip sûr). Actions enregistrées dans `js/app.js`. Aucun changement de
  comportement visible ; pont `window` inchangé. Nouveau test `tests/vues-delegation.test.js`.
  Restent à migrer les modules `js/ui/resume.js`/`stats.js` (lot 4) et `js/ui/contacts.js` (lot 5)
  avant le durcissement CSP.
- **Interviews — délégation d'événements du chrome (lot 2 du chantier `onclick`)** (Interviews
  3.53 → 3.54, SW `statbel-v321` → `statbel-v322`) : ~32 handlers inline de l'**en-tête**, de la
  **barre d'outils**, de la **bascule de vues**, du **menu kebab**, de la **bannière de sauvegarde**
  et des **modales génériques** (PIN, Renommer, Sauvegarde-détail, Aide, liste des adresses non
  géocodées) passent de `on*=` inline à `data-act` routé par `js/core/actions.js`. Le routeur gère
  désormais aussi l'événement **`keydown`** (validation « Entrée » de la modale Renommer). Les
  entrées du menu kebab, qui referment le menu après leur action, sont des actions nommées dédiées.
  Actions enregistrées dans `js/app.js`. Aucun changement de comportement visible ; pont `window`
  inchangé. Nouveau test navigateur `tests/chrome-delegation.test.js` (bascule de vues, ouverture
  kebab, 0 handler inline dans le chrome) + couverture `keydown` dans `tests/actions.test.js`.
- **Interviews — délégation d'événements de l'écran Réglages (lot 1 du chantier `onclick`)**
  (Interviews 3.52 → 3.53, SW `statbel-v320` → `statbel-v321`) : les **29 handlers inline** de la
  modale Réglages (`index.html`) et de l'éditeur de statuts (`js/ui/settings.js`) — `onchange` des
  `<select>` (langue, thème, police, taille, fournisseur géo, fond de carte, navigation, séparateur
  CSV, délai PIN, indemnités), `oninput` du lien CAWI, `onclick` des boutons (statuts, sauvegarde,
  cache, PIN, fermeture) et `onchange`/`onclick` des lignes de l'éditeur de statuts — passent de
  `on*=` inline à `data-act` routé par le module de délégation (`js/core/actions.js`). Les actions
  sont enregistrées dans `js/app.js` (orchestrateur). Aucun changement de comportement visible. Le
  pont `window` est inchangé à ce stade (allègement prévu au dernier lot, avec le durcissement CSP).
  Nouveau test navigateur `tests/settings-delegation.test.js` (change/input/click via le routeur +
  0 handler inline restant dans la modale).

### Ajouté
- **Interviews — routeur de délégation d'événements (lot 0 du chantier `onclick`)** (Interviews
  3.51 → 3.52, SW `statbel-v319` → `statbel-v320`) : nouveau module **`js/core/actions.js`**
  (`registerActions`, `installerDelegation`, dispatch pur `_dispatch`) posant un écouteur unique par
  type d'événement (`click`/`change`/`input`) sur `document` ; au déclenchement, il remonte au plus
  proche élément `data-act` et appelle l'action enregistrée. Installé dans `init()`, il **coexiste**
  avec les `onclick` inline restants (aucun handler migré à ce stade). Infrastructure du chantier de
  suppression des scripts inline (voir `docs/chantier-delegation-onclick.md`) qui permettra, en fin
  de parcours, d'alléger le pont `window` et de retirer `'unsafe-inline'` de la CSP. Test **pur**
  `tests/actions.test.js` (dispatch, séparation par type, action inconnue ignorée, fusion des
  enregistrements). Aucun changement de comportement visible.
- **Interviews — temporisation anti-essais du code PIN** (Interviews 3.50 → 3.51,
  SW `statbel-v318` → `statbel-v319`) : après **3 échecs consécutifs**, la saisie du PIN est
  **gelée** un court instant, croissant à chaque nouvel échec (30 s → 1 min → 2 min → 5 min).
  Pendant le gel, le pavé est désactivé et un compte à rebours s'affiche. Le compteur d'échecs et
  l'échéance sont persistés (`settings`) → un simple rechargement ne remet pas les compteurs à zéro ;
  un code correct les réinitialise. Ce n'est pas une protection cryptographique (les données restent
  locales et en clair au repos), mais un frein contre l'essai systématique par un tiers ayant
  l'appareil en main. Helper **pur** `_pinDelaiTempo(fails)` + nouveaux tests
  `tests/pin-tempo.test.js` (paliers) et scénario de gel dans `tests/pin.test.js`.

### Corrigé
- **Interviews — robustesse `coordsCache` + nettoyage code mort** (Interviews 3.49 → 3.50,
  SW `statbel-v317` → `statbel-v318`) : `coordsCache()` (`js/data/idb.js`) protège désormais son
  `JSON.parse` — une valeur de cache corrompue ne peut plus interrompre le rendu (carte, fiches)
  ni l'export CSV (chemins chauds où la fonction est appelée) ; la clé fautive est **auto-purgée**
  et l'adresse sera simplement re-géocodée. Suppression de `splitLine()` mort dans
  `js/data/csv.js` (le vrai parseur robuste est `parseCSVRows` ; le Convertisseur garde sa propre
  copie autonome) et de son pont `window` dans `js/app.js`. Nouvelles assertions dans
  `tests/robustesse.test.js` (JSON corrompu non fatal + auto-purge de la clé).

### Modifié
- **Interviews — R7 : sérialisation backup dans un module pur** (Interviews 3.47 → 3.48,
  SW `statbel-v315` → `statbel-v316`) : la conversion modèle interne (FR) ↔ pivot anglais
  (`renommerCles`, `contactVersEN`, `contactVersInterne`, `enquetesVersEN`, `enquetesVersInterne`,
  + les tables `KEYMAP_OUT`/`KEYMAP_IN`) quitte `js/features/backup.js` pour un module **pur**
  `js/data/serialization.js` — renommage de clés uniquement, aucune lecture d'état applicatif, ni
  DOM, ni stockage, ni i18n → testable sans navigateur. `backup.js` conserve l'orchestration
  (fichier, bannière, comparaison, restauration) et importe la sérialisation. Nouveau test **pur**
  `tests/serialization.test.js` (renommage, historique, clés non mappées conservées, round-trip
  interne→EN→interne sans perte). Refactor sans changement de comportement visible.
- **Interviews — R4 : moteur de réimport pur** (Interviews 3.46 → 3.47, SW `statbel-v314` →
  `statbel-v315`) : le cœur métier de l'appariement/diff du réimport quitte `js/features/import.js`
  pour un module **pur** `js/data/reimport.js` — `apparieurAnciens` (appariement hiérarchique qui
  préserve l'historique/statut/RDV), `diffHistorique`, `_diffContacts`, `_contactKey`. Ces fonctions
  ne lisent **aucun** état applicatif (`enquetes`, `settings`, `enqueteActive`), ni DOM, ni stockage,
  ni i18n → testables sans navigateur. `import.js` conserve l'orchestration (modale, aperçu,
  confirmation) et la validation de cohérence (`valeurIncoherente`/`recordEnErreur`/`raisonsErreur`,
  liées au vocabulaire de statuts actif + i18n — hors périmètre R4) ; il consomme le moteur.
  `features/backup.js` importe désormais `apparieurAnciens` depuis `data/reimport.js`. Nouveau test
  **pur** (sans navigateur) `tests/reimport.test.js` couvrant les 4 priorités d'appariement, les
  incertains, et les diffs. Refactor sans changement de comportement visible.
- **Interviews — R3 : logique des statuts dans un module pur** (Interviews 3.45 → 3.46,
  SW `statbel-v313` → `statbel-v314`) : le modèle par défaut (`STATUTS_DEFAULTS`, `STATUT_COULEURS`,
  `cloneStatuts`) et la **résolution du vocabulaire par enquête** quittent `js/app.js` pour
  `js/data/statuses.js`. Les fonctions de résolution y sont **pures** : elles reçoivent la liste de
  statuts (ou la map par enquête + le nom) en **paramètres**, sans lire `settings` ni `enqueteActive`
  (`resoudreStatuts`, `statutDefautDe`, `statutDefDe`, `semerStatutsParEnquete`). `app.js` conserve de
  fines **enveloppes globales** de signature inchangée (`statutDefaut()`, `statutDef(label)`,
  `statutsActifs()`, `migrerStatutsParEnquete()`…) qui lisent l'état et délèguent — aucun site d'appel
  (ni handler inline) n'est modifié. Nouveau test **pur** (sans navigateur) `tests/statuses.test.js`.
  Couplage : la logique métier des statuts ne lit plus aucun global ; l'état reste concentré dans
  l'orchestrateur. Refactor sans changement de comportement visible.
- **Interviews — R6 : rappels CATI/CAWI dans un module découplé** (Interviews 3.44 → 3.45,
  SW `statbel-v312` → `statbel-v313`) : `construireRappel` (construction du message e-mail/SMS
  prérempli) quitte `ui/contacts.js` pour le module `js/features/reminders.js`. Elle devient une
  fonction **sans lecture de l'état applicatif** : le lien CAWI (`cawiUrl`) est reçu **en paramètre**
  au lieu d'être lu dans `settings` (`construireRappel({ contact, canal, cawiUrl })`). `envoyerRappel`
  reste côté UI (`contacts.js`) — elle fournit le contact courant et `settings.cawiUrl`, puis délègue.
  Le test `tests/rappel.test.js` passe désormais `cawiUrl` explicitement (plus de dépendance au
  global). Couplage `contacts.js` : −1 lecture de `settings` dans la logique de rappel. Refactor sans
  changement de comportement visible (la dette i18n/`settings.lang`, partagée par tout le dépôt, reste
  hors périmètre).
- **Interviews — module métier unique « méthode de collecte »** (Interviews 3.43 → 3.44,
  SW `statbel-v311` → `statbel-v312`) : la classification CAPI / CATI / CAWI vivait en double
  (`classerMethode` dans `ui/contacts.js`, `methodeCatiCawi` dans `ui/settings.js`) plus une 3ᵉ copie
  inline dans le badge de fiche. Elle est désormais centralisée dans `js/data/collect-method.js`
  (fonctions **pures** `classerMethode` / `estCatiCawi`, source unique des regex). Effets : fin de la
  dépendance `ui/resume.js → ui/contacts.js` (le Résumé importe maintenant le module métier) ;
  `contacts.js`/`settings.js` réutilisent la même logique ; `classerMethode` retiré du pont `window`
  (inutilisé). Ajout d'un test **pur** (sans navigateur) `tests/collect-method.test.js` couvrant la
  classification et vérifiant que la copie du Convertisseur (mono-fichier `file://`, non importable)
  reste alignée sur les mêmes regex. Refactor sans changement de comportement visible.
- **Convertisseur — Statistiques : mutualiser les drill-downs par nationalité** (Convertisseur
  219 → 220, SW `statbel-v310` → `statbel-v311`) : les six fonctions de drill-down préexistantes
  (tranche d'âge, sexe, statut matrimonial, taille de ménage, tranches LFS, cibles par ménage)
  recopiaient chacune le même bloc « compter par nationalité → trier → en-tête + ✕ → treemap ».
  Elles passent désormais toutes par le helper commun `natTreemapInto` (introduit pour la dépendance
  et la composition), soit ~40 lignes dédupliquées et une seule logique à maintenir. **Correctif
  i18n** au passage : le drill-down par taille de ménage affichait un titre **en dur en français**
  (« Ménages de N membre(s) ») — il est maintenant traduit en 4 langues (`txt_households_of_size`).
  Aucun changement de comportement visible par ailleurs.
- **Interviews — Résumé : masquer les KPI de statuts hors méthode filtrée** (Interviews 3.42 → 3.43,
  SW `statbel-v309` → `statbel-v310`) : quand un filtre de méthode est actif (🏠 CAPI / 📞 CATI /
  🌐 CAWI), les cartes KPI des statuts sans aucun contact dans cette méthode sont désormais **masquées**
  (au lieu d'afficher « 0 »), pour ne montrer que les statuts qui la concernent réellement. En vue
  **Toutes méthodes**, tout le vocabulaire de statuts reste affiché (0 compris). La barre de
  progression, la légende et le donut masquaient déjà les statuts à 0 ; le comportement des KPI est
  ainsi aligné.

### Ajouté
- **Convertisseur — Statistiques : treemap par nationalité pour le ratio de dépendance et la
  composition des ménages** (Convertisseur 218 → 219, SW `statbel-v308` → `statbel-v309`) : ces deux
  cartes gagnent un **drill-down par nationalité** (treemap `renderTreemapNlty`) de la sous-population
  concernée (référent du ménage pour la composition), avec en-tête, compte et bouton ✕ — même principe
  que les autres blocs Statistiques (âge, sexe, statut matrimonial, taille de ménage…). i18n fr/nl/en/de.
  - **Composition** : le donut passe au rendu **cliquable local** (`renderDonut`, comme la carte
    Sexe) — un clic sur un segment ou sa ligne de légende ouvre le treemap ; catégories
    Mono-personne / Multi avec mineur / Multi sans mineur.
  - **Ratio de dépendance** : le donut de la lib partagée (`js/charts.js`) garde le **ratio au centre**
    (donc non cliquable) ; le drill se fait via des **puces de catégorie cliquables** sous le graphe —
    Jeunes (<15) / Actifs (15–64) / Âgés (65+).
- **Interviews — Résumé : filtre par méthode de collecte** (Interviews 3.42, SW `statbel-v307`) :
  la vue Résumé gagne un filtre **Toutes méthodes / 🏠 CAPI / 📞 CATI / 🌐 CAWI**, sous le
  périmètre existant (Toutes / Enquête active) — les deux se combinent. Le filtre s'applique à
  **tout le Résumé** : KPI, répartition (donut), barres de progression, tableau par enquête,
  activité (sparklines + courbe d'avancement) et **exports XLSX/PDF** cohérents avec l'écran.
  Chaque bouton affiche son **compte** dans le périmètre courant (désactivé si 0). La méthode est
  déduite de `CD_WSH_CLCT_MTHD` (via `classerMethode`) ; **CAPI** = ni CATI ni CAWI (face-à-face).
  L'export XLSX respecte désormais aussi le **périmètre** affiché (auparavant : toujours toutes
  les enquêtes).

### Interviews — accessibilité, i18n & mobile (revue design)
- **Accessibilité, 4 langues et confort tactile** (Interviews 3.41, SW `statbel-v306`) : suite à une
  critique design (score 34/40). **Noms accessibles** : les ~22 contrôles jusqu'ici anonymes
  (recherches, sélecteur d'enquête, tous les sélects/champs des Réglages, sélecteurs de fichiers,
  champs Import/Renommer) reçoivent un `aria-label` traduit (`data-i18n-aria`). **États annoncés** :
  le toast, `#geocodeProgress` et l'erreur de code PIN passent en régions live (`role="status"`/
  `"alert"` + `aria-live`). **Dialogue** : l'écran de verrouillage devient `role="dialog"`
  `aria-modal` `aria-labelledby`. **Carte** : chaque marqueur porte désormais son **statut** dans
  l'info-bulle/`title` (indice non-coloré, en plus de la couleur du pin). **i18n** : les chaînes FR
  codées en dur (titres carte/`#btnGeo`, popup « Éditer la fiche », calendrier/vCard/suppression
  d'historique, modale Renommer) sont routées via `t()` → fr/nl/en/de. **Tactile** : boutons de vue
  36 → 40 px, boutons de ligne d'historique 40 px, statuts inactifs plus lisibles. **Couleur** :
  bloc RDV et boutons vCard/rappel deviennent thème-aware (fini les aplats clairs en sombre).
  **Mode sombre** : par défaut sur **« Automatique (système) »** — l'appli suit désormais l'OS
  (`prefers-color-scheme`) tant qu'aucun thème n'est choisi manuellement. Divers : `rel="noopener"`
  sur les liens d'adresse.

### PDF → GRP — accessibilité & contraste (revue design)
- **Outil PDF → GRP rendu accessible** (SW `statbel-v305`) : suite à une critique design (score
  ~32/40). **Clavier** : la zone de dépôt (`#dz`) devient un vrai bouton (`role="button"`,
  `tabindex`, Entrée/Espace) — l'outil était **injoignable au clavier** ; `#file` étiqueté.
  **États annoncés** : `#msg` et `#warn` reçoivent `aria-live` ; le focus va au résultat sur
  succès et au message sur erreur. **Contraste (mode sombre)** : le bouton primaire (texte blanc
  sur lavande, 2,31:1) passe en texte foncé, l'en-tête sombre repasse sur un fond indigo foncé
  (fini le blanc sur lavande), `.err` et `--warn` deviennent thème-aware (nouveau `--err`,
  `--warn` redéfini en sombre, token mort `--ok` retiré). **Tactile** : boutons ≥ 44 px, liens de
  navigation agrandis. **Copie** : le message « valeurs sans code » ne renvoie plus à
  `js/pdfgrp.js` (public développeur) mais aux tables de correspondance du Convertisseur ;
  l'aperçu affiche le vrai nombre de lignes. Titre `h2` ajouté au bloc résultat.

### Planner — accessibilité, validation & clavier (revue design)
- **Candidature, carte & agenda plus sûrs et accessibles** (Planner 194, SW `statbel-v304`) :
  suite à une critique design (score 26/40). **Formulaire de candidature** : les ~15 champs
  reçoivent un `<label for=>` associé (auparavant 12 champs sans nom accessible), les blocs
  téléphones/e-mails et le groupe radio passent en `<fieldset><legend>`, le canvas de signature
  gagne `role="img"` + `aria-label` et un **statut annoncé** « signature saisie/vide ». Types
  de champs corrigés (`email`/`tel`/`inputmode`). **Validation bloquante** : la génération du
  `.docx` officiel est désormais **refusée** si le nom, le prénom, l'adresse **ou la signature**
  manquent — messages d'erreur inline sous les champs + focus, au lieu d'un `.docx` vide ou non
  signé ; l'échec de génération s'affiche inline (fini l'`alert` brut). **Clavier** : la barre
  d'onglets suit le modèle WAI-ARIA (flèches/Home/End + roving tabindex) et affiche un **libellé
  texte** ≥640 px ; les cases-jour de la vue **Mois** sont focusables avec `aria-label` (date +
  vagues). **Vue Année** : ajout du **numéro de vague** dans les cases (indice non-coloré, pour
  les daltoniens). **États annoncés** : `aria-live` sur le toast et les statuts de géocodage/comptage.
  **Tokens** : violet candidature (`--cand`) et rouge d'erreur (`--danger`) tokenisés (fini les
  hex en dur, adaptés au mode sombre).

### Convertisseur — accessibilité & UX (revue design)
- **Accessibilité et allègement** (Convertisseur 217, SW `statbel-v303`) : suite à une critique
  design (score 30/40). **Clavier** : la zone de dépôt devient un vrai bouton (`role="button"`,
  `tabindex`, Entrée/Espace) — l'action principale n'est plus réservée à la souris ; `#fileInput`
  étiqueté. **États annoncés** : `#loading` (`role="status"`) et `#erreur` (`role="alert"` + focus)
  sont lus par les lecteurs d'écran, et le spinner ⏳ **tourne** enfin (`@keyframes spin`, neutralisé
  par `prefers-reduced-motion`). **Contraste** : les encadrés d'alerte passent par des tokens
  thème-aware (`--warn-*`, lisibles en sombre au lieu d'un aplat orange), le bouton export « enquête »
  passe par un token (`--violet`), et les libellés du treemap adoptent une encre selon la luminance
  de la tuile (fini le blanc sur ambre ≈1,97:1). **Étiquetage** : `aria-label` traduits sur les
  sélects/inputs de filtres, et un `h1` de repérage + les titres de cartes stats en `h2`.
  **i18n** : « âge moyen/médian » n'affiche plus « ans » en dur (clé `age_years`). **Densité** :
  la vue Statistiques n'ouvre plus 15 blocs d'un coup — 6 blocs cœur par défaut (nouveaux
  utilisateurs), le reste activable via Personnaliser ; les préférences enregistrées priment.
  Commentaire « Leaflet (CDN) » corrigé (la lib est vendorée).

### Documentation
- **Manuel — finitions post-critique** (SW `statbel-v302`) : suite à une re-critique
  (score 24→28 / 32). **Mobile** : `overflow-wrap:anywhere` sur `.feat li` et `code` (les codes
  longs comme `TX_WEB_USER_PSWRD` ne peuvent plus provoquer de défilement horizontal) ; le bouton
  retour-haut est dégagé du pied de page (padding + opacité réduite hors survol). **Repérage** :
  la section atteinte par une ancre est légèrement teintée (`section.module:target`, CSS pur —
  pas de JS sous CSP). **Lisibilité** : les sous-titres `.subh` passent de 12 à 13 px (ne sont
  plus plus petits que le corps). **Clôture** : une note finale « Vous êtes prêt » referme la
  lecture (hors-ligne + sauvegarde JSON + retour au sommaire).
- **Manuel — accessibilité, navigation & cohérence** (SW `statbel-v301`) : suite à une revue
  design du manuel illustré (`docs/manuel.html`). **Accessibilité** : les pastilles de statut
  reçoivent enfin une palette éclaircie en **mode sombre** (auparavant illisibles, texte saturé
  sur fond sombre) ; les 12 `alt` des captures — qui contenaient du HTML littéral et
  doublonnaient la légende — passent en `alt=""` (la `figcaption` décrit déjà chaque figure) ;
  ajout d'un focus clavier visible (`:focus-visible`) ; les sous-sections (« Les quatre vues »…)
  deviennent des vrais titres `h3` (réintégrées à l'arbre de titres). **Navigation** : les
  numéros du sommaire s'alignent enfin sur les badges de section (plus de décalage d'un cran),
  et un bouton **retour au sommaire** (CSS pur, sans JS — CSP `script-src 'none'`) accompagne
  la lecture d'une page longue. **Densité & repères** : l'outil PDF → GRP reçoit sa liste de
  fonctionnalités (parité avec les autres outils) et le glossaire « Repères métier » explicite
  **CAPI/CATI/CAWI**, `CD_WSH_CLCT_MTHD` et `TX_WEB_USER_ID`/`TX_WEB_USER_PSWRD`. Nettoyage :
  `.pill.a` passe par un token, le titre « Principes » rejoint le système de styles.
- **RGPD adaptée aux sorties de données** (SW `statbel-v300`) : les sections Confidentialité
  du manuel et du README précisent désormais les **deux seules sorties de données, déclenchées
  par l'utilisateur** — les **rappels e-mail/SMS** (l'app pré-remplit l'appli mail/SMS de
  l'appareil, qui transmet le message et, en CAWI, l'identifiant + mot de passe) et le
  **géocodage** (l'adresse est envoyée aux géocodeurs publics belges, le mode point GPS
  restant local). Sous-titre du manuel ajusté (« …sauf action explicite de votre part »).
- **Mode d'emploi + README actualisés** (SW `statbel-v298`) : le manuel illustré
  (`docs/manuel.html`) et le `README.md` documentent désormais les enquêtes **CATI/CAWI**
  (pastille de méthode, statuts propres à chaque enquête, rappel e-mail/SMS avec lien +
  identifiant + mot de passe, identifiants d'accès web importés, téléphone `+32`), le
  réglage « Lien enquête web (CAWI) », et la lecture Excel robuste du Convertisseur
  (identifiants numériques longs préservés). Bump du cache pour que le manuel à jour
  atteigne les PWA installées hors-ligne.

### Ajouté
- **Interviews — rappel e-mail / SMS pour les contacts CATI/CAWI** (Interviews 3.39,
  SW `statbel-v296`) : dans la fiche d'un contact dont la méthode est CATI ou CAWI, deux
  boutons **✉️ Rappel** (mailto:) et **💬 Rappel** (sms:) ouvrent l'appli mail/SMS de
  l'appareil avec un message prérempli invitant à compléter l'enquête. Pour le **CAWI**, le
  message inclut le **lien du portail**, l'**identifiant** et le **mot de passe** d'accès web
  du ménage ; pour le **CATI**, un simple rappel de disponibilité (avec le RDV s'il existe).
  L'import reconnaît désormais et conserve (round-trip) les colonnes **`TX_WEB_USER_ID`** et
  **`TX_WEB_USER_PSWRD`** du CSV « cibles » du Convertisseur (identifiants = données perso,
  jamais versionnées). Nouveau réglage **« Lien enquête web (CAWI) »** (Paramètres), préréglé
  sur le portail LFS 2026. Aucun envoi automatique : rien ne quitte l'appareil sans action de
  l'utilisateur. Nouveau test `tests/rappel.test.js`.

### Corrigé
- **Interviews — correctif lint** (Interviews 3.40, SW `statbel-v299`) : suppression d'une
  affectation morte (`no-useless-assignment`) dans `construireRappel` — `href` est désormais
  déclaré sans valeur initiale, affecté dans chaque branche. Aucun changement de comportement ;
  la CI ESLint repasse au vert.
- **Convertisseur — identifiants numériques longs cassés en notation scientifique**
  (Convertisseur 216, SW `statbel-v297`) : à la lecture d'un fichier source **Excel**,
  un identifiant numérique long en format « Standard » (ex. `TX_WEB_USER_ID`) était rendu
  `2.02612E+11` par SheetJS (`raw:false`), perdant les derniers chiffres. `parseXlsx`
  récupère désormais l'**entier complet** depuis la valeur brute (`raw:true`) pour toute
  cellule affichée en scientifique ; les dates, codes à zéros de tête et décimaux restent
  inchangés. Nouveau test `tests/converter-xlsx-bignum.test.js`.

### Modifié
- **Interviews — téléphone affiché au format `+32 xxx xx xx xx`** (Interviews 3.38,
  SW `statbel-v295`) : les numéros importés (souvent bruts, ex. `465812582`) sont
  formatés à l'affichage (vues Liste, Agenda, popup carte) via `telBE()` — mobile
  groupé 3-2-2-2, fixe 2-2-2-2, préfixes `0`/`32`/`0032` tolérés ; le lien `tel:`
  utilise l'E.164 `+32…`. Valeur stockée inchangée (formatage à l'affichage seul).
- **Interviews — pastille méthode de collecte repositionnée** (Interviews 3.37,
  SW `statbel-v294`) : CATI/CAWI quitte la ligne démographique (où elle passait à la
  ligne) pour devenir une pastille dédiée sur la ligne des canaux de contact
  (📞 CATI en bleu / 🌐 CAWI en vert), à côté du téléphone et de l'e-mail, dans les
  vues Liste et Agenda.

## [3.36] — 2026-09-11  (SW `statbel-v288` → `v293`)

Palier de publication regroupant le chantier depuis la 3.32, centré sur le suivi
**CAPI vs CATI/CAWI** dans Interviews. Versions internes atteintes :
**Interviews 3.36**, **Planner 193**, SW **v293**. Convention : les tags `vX.Y`
pointent sur le commit de merge.

### Ajouté
- **Interviews — méthode de collecte + préréglage auto** (Interviews 3.36, SW `statbel-v293`) :
  l'import reconnaît et conserve la colonne **`CD_WSH_CLCT_MTHD`** (CATI/CAWI) du CSV
  exporté par le Convertisseur, l'affiche en **pastille** dans la fiche, et **déduit
  automatiquement** le préréglage de statuts d'une enquête neuve (≥1 fiche CATI/CAWI →
  feuille de contact CATI ; sinon CAPI). Modifiable ensuite via les boutons de préréglage.
  Round-trip conservé à l'export. Nouveau test `tests/statut-autopreset.test.js`.
- **Interviews — statuts propres à chaque enquête** (Interviews 3.35, SW `statbel-v292`) :
  le vocabulaire de statuts n'est plus global mais **cloisonné par enquête**
  (`settings.statutsParEnquete`). Éditer un statut ou appliquer un préréglage n'affecte
  plus que l'enquête active → une enquête **CAPI** (face-à-face) et une enquête
  **CATI/CAWI** ne se mélangent plus. Nouveau préréglage **« CAPI (face-à-face) »** à côté
  du préréglage CATI. Migration idempotente (chaque enquête existante hérite une copie du
  modèle, aucun statut de contact modifié) ; round-trip sauvegarde préservé. Le résumé
  multi-enquêtes agrège l'**union** des vocabulaires. Nouveau test `tests/statut-scope.test.js`.
- **Planner — pastille de comptage aussi sur l'onglet Candidature** (Planner 192,
  SW `statbel-v288`) : le nombre de groupes retenus s'affiche en pastille verte sur
  l'icône 📝, comme sur l'onglet Agenda 📅 ; masquée quand aucun groupe n'est retenu.

### Modifié / Déplacé
- **Interviews — menu ⋮ réorganisé** (Interviews 3.34, SW `statbel-v291`) :
  « Renommer » / « Supprimer cette enquête » remontés au-dessus d'Importer /
  Exporter CSV ; « Paramètres », « Aide » et « Manuel d'utilisation » déplacés
  en fin de menu.
- **Planner — gestion du planning déplacée dans le menu ⋮** (Planner 193,
  SW `statbel-v289`) : les trois boutons de l'onglet Planning (📥 Importer,
  ✏️ Renommer, 🗑️ Supprimer) laissent place à trois entrées du menu ⋮
  (« Importer un planning », « Renommer le planning », « Supprimer le planning ») ;
  Renommer/Supprimer n'apparaissent que lorsqu'un planning unique est actif.

## [3.32] — 2026-09-11  (SW `statbel-v271` → `v287`)

Palier de publication regroupant le chantier depuis la 3.28. Versions internes
atteintes : **Convertisseur 215**, **Planner 191**, SW **v287**. Interviews n'évolue
que par corrections (pas de nouvelle fonctionnalité majeure).

### Ajouté
- **Manuel d'utilisation illustré** (`docs/manuel.html`) décrivant les modules, avec
  captures d'écran ; lien depuis le README et entrée « 📘 Manuel » du menu d'Interviews.
- **Convertisseur — export CSV UTF-8 avec BOM + séparateur régional** (`;`/`,` selon
  `statbel_settings.csvSep`, partagé avec Interviews).
- **Convertisseur — Aperçu plus lisible** : date de naissance en `jj/mm/aaaa`, e-mail
  cliquable (`mailto:`), téléphone au format `+32 xxx xx xx xx` avec liens `tel:`/`sms:`.
- **Convertisseur — import des identifiants web du ménage** : colonnes
  `CD_WSH_CLCT_MTHD`, `TX_WEB_USER_ID`, `TX_WEB_USER_PSWRD` (conservées à l'export).
- **Convertisseur — colonne optionnelle « Méthode de collecte »** (opt-in), préférence
  CATI/CAWI affichée en pastille lisible.
- **Interviews — préréglage de statuts « Feuille de contact CATI »** (6 valeurs, re-mappe
  le suivi existant).
- **Planner — renommer un planning** (bouton « ✏️ Renommer ») ; le libellé se répercute
  partout (sélecteur du header, agenda, annexe du Convertisseur).
- **Planner — import sans doublon** : un planning déjà importé est reconnu par son
  **contenu** (ensemble des codes de groupes), insensible au renommage du fichier ; ses
  données et son libellé sont remplacés au lieu d'être dupliqués.
- **Planner — pastille de comptage** des groupes sélectionnés sur l'icône de l'onglet Agenda.

### Modifié / Déplacé
- **Planner en 3 onglets** — Planning / Agenda / Candidature, présentés **dans le bandeau**
  (icône seule + libellé au survol, comme Interviews et le Convertisseur). La Candidature
  devient un onglet plein (plus une modale).
- **Planner — box « Communes choisies » éditable** (onglet Candidature) : une ligne par
  commune, ordre de priorité (▲▼), retrait (✕) et recalcul automatique du nombre de groupes.
- **Planner — un seul sélecteur de trimestre** (celui du header) qui pilote à la fois
  l'agenda et la carte de l'onglet Planning ; suppression du sélecteur redondant.
- **Planner — titre de candidature synchronisé** : « EFT 2026-Tx » dérivé du trimestre
  sélectionné dans le header (champ éditable).
- **Onglet « Planning » : Convertisseur → Planner** (Convertisseur 215, Planner 184,
  SW `statbel-v280`). L'import et la gestion des plannings trimestriels LFS
  (`LFS_IESS_GRP_APPEL_Y2026Qx_FR`) — sélecteur, filtres province/commune/quartier,
  carte Leaflet, vérificateur d'adresse par géocodage régional (UrbIS/SPW/Geopunt +
  Nominatim) et tableau de référence — quittent le Convertisseur pour le module
  **Planning Statbel** (`statbel_planner.html`), où vivait déjà la consultation
  (agenda, candidature). Le Planner reçoit la CSP élargie (géocodeurs en `connect-src`,
  tuiles en `img-src https:`) et Leaflet vendorisé (déjà en cache, aucune nouvelle
  ressource servie). Textes portés en FR en dur (le Planner n'a pas de `t()`) ;
  `communeRegion()` (table REFNIS ~2 800 lignes) remplacée par une résolution allégée
  par code province + repli Bruxelles.
  **Lien GRP↔LFS conservé** : l'import écrit toujours l'index `grp` dans le stockage
  partagé `localStorage['plannings']`, que le Convertisseur relit
  (`chargerRegistrePlannings`/`chercherPlanning`/`planningPourGRP`) pour relier chaque
  `GRP_2026xxxxx` au planning importé dans son annexe « Aperçu » — le Convertisseur
  garde cette couche de lecture mais n'a plus d'onglet Planning. Nouveau test bout-en-bout
  `tests/planning-move.test.js`, branche Planner ajoutée à `tests/csp.test.js` ;
  suite complète 25/25 verte.
- **Convertisseur (210) — refactorisation interne du KPI « Indemnité potentielle »**
  (SW `statbel-v272`), sans changement de comportement (`/simplify` sur la PR #136) :
  les quotas de paiement sont lus via `lireSettings()`, un helper désormais partagé
  avec la lecture de la langue au lieu d'un `JSON.parse(localStorage…)` dupliqué à
  trois endroits ; `val` et `tip` du KPI factorisent leur calcul commun (quotas,
  test « a-t-on un quota ? », montant) dans `paieCalc()` plutôt que de le redériver
  chacun de leur côté. Les quotas restent lus à chaque rendu (pas mis en cache dans
  `_kpiCtx`) : un changement de quotas doit rester visible sans réimporter — suite
  `converter-kpi.test.js` inchangée, 19/19 verts.

### Corrigé
- **Interviews — import non destructif** : à la ré-importation, les statuts, dates
  d'historique, n° de téléphone, e-mails, dates/heures de rendez-vous et notes existants
  ne sont plus écrasés ; correction d'une ligne d'historique « fantôme » qui réapparaissait
  après édition de sa date.
- **Interviews — e-mail du contact cliquable** (`mailto:`) sur la fiche contact.

## [3.28] — 2026-09-07  (SW `statbel-v270` → `v271`)

Version de publication du KPI du Convertisseur livré après la 3.27 : le code était
déjà sur `main` (donc en ligne), il lui manquait le numéro de version et le tag.
Interviews n'est pas modifiée fonctionnellement.

### Ajouté
- **Convertisseur (209) — KPI « Indemnité potentielle »** dans la vue Statistiques :
  montant maximal payé si toute l'enquête du groupe était réalisée
  (`ménages × quota ménage + cibles ≥ âge min × quota personne`). Quotas repris des
  **Paramètres d'Interviews** via `localStorage['statbel_settings']` ; « — » explicite
  + titre d'aide s'ils sont absents. Formule détaillée au survol, 7ᵉ tuile
  désactivable via « Personnaliser les KPI », i18n 4 langues.

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
