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

### PDF → GRP — masquer la zone de dépôt après traitement
(SW `statbel-v363` → `statbel-v364`)
- Après extraction d'un PDF, la zone de dépôt se masque et laisse place au résultat
  (comme le Convertisseur). Un bouton **« ↻ Traiter un autre PDF »** la ré-affiche pour
  enchaîner. Le module reste FR uniquement (pas de version applicative propre).

### Convertisseur — allègement de l'en-tête et de l'état vide
(Convertisseur `225` → `226`, SW `statbel-v362` → `statbel-v363`)
- **Wordmark « Statbel Convertisseur » retiré** de l'en-tête pour libérer de la place
  au sélecteur de source (liste déroulante des fichiers importés).
- **Lien « Extraire un GRP depuis le PDF officiel → » retiré** de l'état vide : la zone
  de dépôt (glisser/cliquer) reste le moyen principal d'import ; le menu ⋮ « Importer un
  fichier source » couvre le reste. La ligne « 🔒 Traitement 100 % local » est conservée.

### Planner — passe design : contraste sombre + i18n (P2)
(Planner `208` → `209`, SW `statbel-v361` → `statbel-v362`)
- **Boutons d'export lisibles en thème sombre (colorize)** : Excel/CSV App/Chevauchements
  codaient leur couleur en hex dur (`#0e7c4a`, `#1a237e`, `#f57f17`) → en sombre le bouton
  « CSV App » était quasi invisible (1,17:1). Ils passent par les tokens thème-aware
  `--v2`/`--v1`/`--v4` comme les boutons voisins.
- **Bordures de puces de vague/fichier thème-aware** : `.v1`–`.v4` et `.file-chip` codaient
  leur bordure en pastel clair (`#b8ccff`…) non redéfini en sombre → nouveaux tokens
  `--v1b`–`--v4b` (clair + sombre).
- **i18n (clarify)** : l'option « Tout — N trimestres » du sélecteur, en français en dur,
  passe par `tf('sel_all_quarters')` (fr/nl/en/de).

### Planner — passe design (critique Impeccable 29/40, top 3 a11y)
(Planner `207` → `208`, SW `statbel-v360` → `statbel-v361`)
- **Sélection de groupe accessible (P0, harden)** : les puces `.grp-tag` deviennent des
  `<button>` focusables et activables au clavier (Entrée/Espace), avec `aria-pressed`
  reflétant l'état sélectionné. La tâche centrale (choisir des groupes) était jusqu'ici
  impossible au clavier / lecteur d'écran (WCAG 2.1.1).
- **Signature au clavier (P1, adapt)** : en plus du tracé à la souris/au doigt, un champ
  « Ou tapez votre nom » rend le nom saisi dans le canvas de signature (même pipeline PNG →
  .docx). Les utilisateurs clavier/SR peuvent enfin produire la candidature.
- **Anneau de focus visible (P1, harden)** : `outline:none` inconditionnel sur les inputs/
  selects remplacé par un `:focus-visible` tokenisé, global (WCAG 2.4.7).

### Convertisseur — passe design 2 (vérification Impeccable, couche a11y + onboarding)
(Convertisseur `224` → `225`, SW `statbel-v359` → `statbel-v360`)
- **État ARIA des contrôles (harden)** : les bascules (onglets de vue, périmètre Enquête/
  Population, thème/taille, onglets Personnaliser/Lookup) reflètent leur état via `aria-pressed` ;
  le menu ⚙️ porte `aria-haspopup`/`aria-controls` et un `aria-expanded` synchronisé. L'état actif
  était jusqu'ici visuel seulement (inaudible au lecteur d'écran).
- **Encadrés d'alerte thème-aware (colorize)** : l'alerte « ID scientifique » et les
  avertissements de codes/structure passent des littéraux hex en dur (`#fdecea`, `#bf360c`,
  `#ffe0b2`…) à des tokens (`--err-*`, `--warn-text`, nouveau `--code-bg`) → contraste correct
  en thème sombre.
- **Onboarding de l'état vide (clarify)** : lien « Extraire un GRP depuis le PDF officiel → »
  vers PDF→GRP sous la zone de dépôt, et l'indice de format devient traduisible (`data-i18n`).
- **Onglets de vue (adapt)** : libellé texte visible dès 480px (Aperçu/Statistiques) en plus
  de l'icône — le survol n'existe pas au tactile/clavier.

### Convertisseur — passe design (critique Impeccable, score 33/40)
(Convertisseur `223` → `224`, SW `statbel-v358` → `statbel-v359`)
- **A11y (harden)** : les en-têtes de tri (`th.sortable`/`th.ref-sort`) deviennent focusables
  au clavier, activables Entrée/Espace, et annoncent l'état de tri au lecteur d'écran
  (`aria-sort`, `scope="col"`, anneau `:focus-visible`).
- **Mobile (adapt)** : chaque graphique SVG (anneau, treemap, Sankey) reçoit
  `role="img"` + `aria-label` ; toucher une forme portant un `<title>` en lit la valeur dans
  une zone live partagée (le survol n'existe pas au doigt) ; cibles tactiles agrandies
  (boutons d'en-tête 36→40px, ✕ de bloc 22→28px).
- **Confidentialité (onboard)** : ligne « 🔒 Traitement 100 % local — aucune donnée n'est
  envoyée » ajoutée à la zone de dépôt et à la fenêtre d'export (i18n fr/nl/en/de).
- **Couleur (quieter)** : les tuiles KPI passent d'un arc-en-ciel de 11 teintes à un accent
  indigo unique ; la couleur n'est conservée que là où elle encode un sens (genre H/F).
- **Identité (distill)** : wordmark « Statbel Convertisseur » visible dans le bandeau (i18n).
- **Nettoyage (polish)** : police par défaut alignée sur la pile système documentée
  (`_ui.font` `arial`→`system`, body idem) ; boîte `.erreur` et bordure `td` tokenisées
  (`--err-*`, `--line`) au lieu de littéraux hex non theme-aware.

### Accessibilité
- **PDF → GRP — accessibilité alignée sur les autres apps** (SW `statbel-v357` → `statbel-v358`) :
  `statbel_pdf2grp.html` recevait un traitement a11y minimal. Ajout d'un lien d'évitement
  (« Aller au contenu »), d'un landmark `<main id="contenu">`, d'un `<nav>` nommé, d'une région
  de résultat nommée (`aria-labelledby` → titre), de la zone d'aperçu défilable rendue
  atteignable au clavier (`role="region"` + `tabindex` + libellé), de `scope="col"` sur les
  en-têtes du tableau et d'une règle `prefers-reduced-motion`. Nouveau test
  `tests/pdf2grp-a11y.test.js`. (Le module reste FR uniquement — pas de version applicative propre.)

### Correctifs (audit — suite)
- **Interviews — validité calendaire des dates de rendez-vous** (Interviews `3.77` → `3.78`,
  SW `statbel-v356` → `statbel-v357`) : la normalisation corrigeait le format mais pas la
  validité. `toISODate` et `dateFrToISO` rejettent désormais les dates impossibles
  (`31/02`, `31/04`, `29/02` hors année bissextile) via le helper `jourValide` — au lieu du
  simple contrôle jour ≤ 31 / mois ≤ 12 ; `dateFrToISO` renvoie de l'ISO **0-paddé**.
  `toISODateTime` valide et normalise l'heure (`^([01]\d|2[0-3]):[0-5]\d$`) : une heure
  invalide (`25:99`, `24:60`) est écartée, la date du rendez-vous étant conservée. Même
  contrôle appliqué à l'import CSV **et** à la saisie manuelle (`lireRdvFields` →
  `dateFrToISO`). `tests/date-import.test.js` étendu (31/02, 29/02 bissextile ou non, 24:60).

### Correctifs mineurs (audit — lot LOW)
(Interviews `3.76` → `3.77`, Convertisseur `222` → `223`, Planner `206` → `207`,
SW `statbel-v355` → `statbel-v356`)
- **CSP resserrées** : Convertisseur `connect-src 'self'` (l'app ne fait aucun appel réseau ;
  5 domaines externes retirés) ; Planner : `*.ngi.be` retiré (jamais contacté).
- **Import CSV** : la taille de ménage / le nombre de cibles `0` (valeur légitime) n'est plus
  transformé en « inconnu » (`null`) ; nouveau helper `intOuNull`. Test étendu.
- **Planner — `parseDate`** : branche « format US » morte (regex dupliquée) corrigée → plus de
  débordement silencieux d'une date type `05/13/2026` ; le format US n'est pris que si `jj/mm`
  est impossible.
- **`saveCoords`** protégé contre un `QuotaExceededError` (cache de coordonnées plein ne casse
  plus la chaîne de géocodage).
- **Accessibilité** : les modales de contenu (Interviews) reçoivent un nom accessible
  (`aria-labelledby` → titre) ; boutons ✕ nommés (Planner vérif. adresse, Convertisseur) ;
  boutons monter/descendre du Convertisseur traduits (`pl_move_up`/`pl_move_down`, 4 langues).
- **Nettoyage** : entrée `.gitignore` périmée (`aqua-conseil.html`) retirée ; commentaire
  provider `osm` obsolète retiré ; table des versions du README réalignée.

### Sécurité / correctifs (audit)
- **Planner — XSS via le n° de groupe importé corrigée**
  (Planner `205` → `206`, SW `statbel-v354` → `statbel-v355`) : le n° de groupe issu d'un
  fichier planning était injecté brut dans un `onclick` et dans `innerHTML` (liste de
  groupes, vues semaine/mois) → exécution de code possible depuis un fichier piégé. Il passe
  désormais par un `data-num` échappé + écouteur délégué, et `esc()` sur tous les affichages.
  Test `tests/planner.test.js` étendu (bloc XSS).
- **Interviews — rendez-vous corrompus à l'import CSV corrigés**
  (Interviews `3.75` → `3.76`) : `rdv` (et le `rdv` d'historique) étaient importés au format FR
  alors que l'app les stocke en interne en ISO `YYYY-MM-DD HH:MM` (cf. `lireRdvFields`) → un
  aller-retour Export CSV → Import CSV faisait disparaître les rendez-vous du Suivi et de
  l'édition. Nouveau normaliseur `toISODateTime` ; `tests/date-import.test.js` étendu.
- **Interviews — alerte « échec de sauvegarde » enfin traduite** : la clé i18n
  `al_save_failed` (référencée par `idb.js`) n'existait pas → l'alerte bloquante restait
  toujours française. Ajoutée en fr/nl/en/de.

### Ajouté
- **Interviews — modèles de rappel : garde-fous et confidentialité**
  (Interviews `3.74` → `3.75`, SW `statbel-v353` → `statbel-v354`) : quatre améliorations
  des modèles de rappel personnalisables. (1) Les variables `{{…}}` inconnues d'un modèle
  sont désormais **signalées** dans l'aperçu (⚠️) au lieu d'être silencieusement remplacées
  par du vide. (2) L'aperçu affiche la **longueur estimée** de chaque SMS (caractères +
  nombre de segments, GSM-7 vs UCS-2). (3) Nouvelle option **« Inclure le mot de passe CAWI
  dans les rappels »** (activée par défaut) pour l'omettre des messages. (4) Un rappel CAWI
  dont le modèle référence `{{identifiant}}` ou `{{mot_de_passe}}` **demande confirmation**
  si la fiche ne contient pas cette donnée. Test `tests/reminder-templates.test.js` étendu.

### Sécurité / confidentialité
- **Interviews — données de sécurité locales exclues des sauvegardes**
  (Interviews `3.73` → `3.74`, SW `statbel-v352` → `statbel-v353`) : l'export JSON
  retirait seulement `pinCode`/`pinTimeout`. Il exclut désormais aussi `pinFails`,
  `pinLockUntil` et `bioCredId` — propres à l'appareil, inutiles dans une sauvegarde
  transférable (principe de minimisation). Test `tests/backup.test.js` étendu (côté export).
- **Interviews — retrait complet du géocodage OSM/Nominatim** : le fournisseur `osm`
  (envoi d'adresses à Nominatim, tiers hors UE) est **supprimé** de `GEO_PROVIDERS` ; il
  n'est donc plus accepté par `validerSettings` (une vieille sauvegarde `provider:"osm"`
  retombe sur un géocodeur belge) et `connect-src https://*.openstreetmap.org` est retiré
  de la CSP d'`index.html`. Le **fond de carte** reste des tuiles OpenStreetMap (images
  seules, sans donnée personnelle, via `img-src https:`). Test `tests/csp.test.js` adapté.

### Documentation
- **README réaligné** : versions actuelles (Interviews `3.74`, Convertisseur `222`,
  Planner `205`, cache `statbel-v353`), **23 modules** avec `js/core/actions.js` (routeur
  `data-act`) et `js/boot.js` ; suppression des mentions de gestionnaires `onclick=` inline
  (l'UI est en `data-act` + délégation, cohérent avec `script-src 'self'`) ; note géocodage
  mise à jour (OSM/Nominatim retiré).
- **Commentaires techniques corrigés** : CSP d'`index.html` (`script-src 'self'`, plus de
  `on*=`), `js/boot.js` et `sw.js` (navigation « cache d'abord », non plus « réseau »).

### Modifié
- **Interviews — vue Liste : fiche compacte n'affichant que le statut courant**
  (Interviews `3.70` → `3.73`, SW `statbel-v349` → `statbel-v352`) : sur mobile, chaque
  fiche de la liste montrait la barre complète des statuts (tous les boutons), très
  encombrante. Elle affiche désormais **uniquement le statut courant** sous forme d'une
  puce (comme le popup de la carte). Un clic sur la puce **ou** sur le crayon 🖊️ ouvre le
  formulaire d'édition — **l'édition et le choix du statut restent identiques** (barre
  complète dans le formulaire). Le cadenas 🔒 séparé a été **retiré** (la puce + le crayon
  suffisent). Puce et barre partagent une même primitive de bouton (`statutBtnHTML`) ;
  `statutChipHTML()` réutilise le `def` déjà calculé. Test `tests/statut-lock.test.js` adapté.

### Corrigé
- **Planner — candidature : génération bloquée si 0 groupe souhaité**
  (Planner `204` → `205`, SW `statbel-v348` → `statbel-v349`) : lorsque l'option
  « Nombre de groupes souhaités » est choisie mais qu'aucun groupe n'est sélectionné,
  la génération du .docx est refusée avec un message explicite (au lieu de produire un
  formulaire vide). Les options « Pas intéressé » / « Plus intéressé » restent
  générables sans groupe. Test `tests/planner.test.js` étendu.
- **Interviews — statuts du préréglage CATI/CAWI non traduits (nl/en/de)**
  (Interviews `3.69` → `3.70`, SW `statbel-v347` → `statbel-v348`) : les six statuts de la
  feuille de contact CATI (« Pas encore de contact entrepris », « Rdv fixé »,
  « Tentatives de contacts sans résultat », « Négatif », « Interview réalisée »,
  « Inconnu ») restaient en français dans la légende de carte, l'éditeur et les filtres,
  quelle que soit la langue. Ils sont désormais dans `STATUT_I18N` (fr/nl/en/de) — ex.
  « Nog geen contact opgenomen » (NL), « Noch kein Kontakt aufgenommen » (DE), « No
  contact yet » (EN). **Affichage seul** : la valeur stockée sur les fiches ne change pas
  (pas de migration). Test `tests/statut-preset.test.js` étendu.

### Modifié
- **Planner — candidature .docx : sigle d'enquête localisé + formulation NL/EN**
  (Planner `203` → `204`, SW `statbel-v346` → `statbel-v347`) : le **sigle** de l'enquête
  suit désormais la langue dans le formulaire (EFT en FR, **EAK** en NL, **LFS** en EN,
  **AKE** en DE) — intro, en-tête du tableau et cases à cocher. Les deux lignes
  « pas / plus intéressé » sont reformulées en NL (« Niet geïnteresseerd in het afnemen
  van enquêtes voor EAK 2026-T4 » / « Niet langer geïnteresseerd in het afnemen van
  enquêtes ») et en EN (« Not interested in conducting LFS 2026-T4 surveys » / « No longer
  interested in conducting surveys »), y compris les libellés des boutons radio. Test
  `tests/planner.test.js` étendu.

### Documentation
- **`docs/eft-2026-organisation.md`** : connaissance métier de l'organisation EFT 2026
  (vue d'ensemble + vague 1 CAPI) et de la feuille de contact **R35** — panel/vagues,
  numérotation groupe/ménage, rythme des groupes, tentatives de contact, motifs
  d'« interview impossible », recrutement TIC, structure des paiements. Reformulé depuis
  la formation Statbel : **processus uniquement, aucune donnée de ménage**, et **sans
  coordonnées personnelles** (noms/téléphones des superviseurs, boîtes internes) ni
  montants — conforme à la liste blanche `.gitignore`. Complète `docs/eft-cati-cawi.md`.

### Modifié
- **Planner — candidature : plus de pop-up, partage natif ou téléchargement**
  (Planner `202` → `203`, SW `statbel-v345` → `statbel-v346`) : la génération du .docx
  n'affiche plus la pop-up « Candidature générée ». Sur mobile, un **partage natif**
  (API Web Share avec fichier) ouvre la feuille système — Gmail, WhatsApp, Word,
  Enregistrer dans Fichiers… ; sur bureau / navigateur non compatible, **repli sur le
  téléchargement** classique que l'utilisateur ouvre lui-même. Helper de toast fichier et
  clés i18n associées retirés. Test `tests/planner.test.js` adapté (chemins partage /
  téléchargement).
- **Planner — candidature : n° de groupe dans l'aperçu et quartier dans le .docx**
  (Planner `201` → `202`, SW `statbel-v344` → `statbel-v345`) : l'aperçu des groupes
  retenus affiche désormais le **numéro de groupe** avec le quartier (ex. « Schaerbeek —
  201 - GD. RUE AU BOIS »), et le formulaire .docx ajoute le **quartier derrière la
  commune** dans la colonne « Commune » (ex. « 12605 · Schaerbeek - GD. RUE AU BOIS »),
  pour une meilleure cohérence avec les groupes sélectionnés. Test
  `tests/candidature-order.test.js` étendu.
- **Planner — candidature : priorité par commune + quartier (au lieu de commune seule)**
  (Planner `200` → `201`, SW `statbel-v343` → `statbel-v344`) : les groupes retenus ne
  sont plus regroupés en un seul bloc par commune. Chaque **quartier** d'une commune est
  une entrée ordonnable **séparément** (ex. « Schaerbeek — Gd. Rue au Bois » peut passer
  avant « Schaerbeek — Helmet »). Le tri par défaut est commune puis quartier, les
  flèches ▲/▼ déplacent chaque entrée indépendamment, et l'ordre du formulaire .docx suit
  cet ordre puis le n° de groupe. Nouveau test `tests/candidature-order.test.js`.

### Corrigé
- **Planner — dernières fuites FR de la candidature (.docx)**
  (Planner `199` → `200`, SW `statbel-v342` → `statbel-v343`) : le nom d'enquête
  développé du titre (`CAND_SURVEYS`, ex. « Enquête sur les Forces de Travail »)
  passe en 4 langues (fr/nl/en/de) et suit la langue active ; la ligne « Nombre de
  groupes souhaités : » du gabarit officiel ne se traduisait pas car le modèle emploie
  une **espace insécable** (U+00A0) avant « : » — l'appariement des libellés est
  désormais **normalisé** (espaces insécables et apostrophe courbe) et opère nœud par
  nœud `<w:t>`. Test `tests/planner-i18n.test.js` étendu.
- **Planner — fichiers exportés traduits (.docx candidature, .ics agenda)**
  (Planner `198` → `199`, SW `statbel-v341` → `statbel-v342`) : les libellés fixes du
  formulaire de candidature officiel (.docx) et la description des événements .ics
  restaient en français. Le .docx traduit ses libellés selon la langue active
  (`CAND_DOCX_I18N` fr/nl/en/de, appliqués APRÈS la case à cocher qui s'ancre sur le
  texte FR ; les jetons `@@…@@` de données sont préservés) ; le .ics traduit le nom du
  calendrier et les libellés de description (Groupe/Commune/Quartier/Vague/Semaine réf.),
  la commune suivant la langue. **NB : traductions de convivialité — le formulaire
  officiel Statbel en langue régionale peut différer ; à vérifier avant tout usage
  administratif.** Test `tests/planner-i18n.test.js` étendu.
- **Planner — filtres du tableau Planning non traduits (provinces / communes / quartiers)**
  (Planner `197` → `198`, SW `statbel-v340` → `statbel-v341`) : les listes déroulantes de
  l'onglet Planning restaient en français. Les défauts « Toutes les provinces / communes /
  quartiers » passent par des clés i18n (fr/nl/en/de) ; les libellés de **provinces** suivent
  la langue active (nouvelle table `PROV_I18N` 4 langues, `provLabel()` localisé) ; les
  **communes** bilingues « FR/NL » (Bruxelles/facilités) affichent la forme correspondant à la
  langue (NL → côté néerlandais ; fr/en/de → forme primaire, faute de noms officiels DE/EN).
  Les filtres des deux zones (tableau Planning et « Sélectionner des groupes ») sont reconstruits
  au changement de langue en préservant les sélections. Test `tests/planner-i18n.test.js` étendu.

### Ajouté
- **Planner — traduction complète en 4 langues (fr/nl/en/de)**
  (Planner `196` → `197`, SW `statbel-v339` → `statbel-v340`) : le module Planner,
  jusque-là uniquement en français, est désormais entièrement traduit — les trois
  onglets **Planning / Agenda / Candidature**, le menu ⋮, la modale de mapping des
  colonnes et les contenus générés en JS (agenda liste/semaine/mois/année, tableau
  de planning, statuts de géocodage, aperçu et validation de la candidature). Ajout
  d'une couche i18n `t()`/`tf()` + `data-i18n` (même mécanisme que le Convertisseur)
  et d'un **sélecteur 🌐 propre au Planner** dans le menu ⋮ ; la langue est partagée
  avec Interviews/Convertisseur via `localStorage['statbel_settings'].lang` et
  fonctionne aussi hors-ligne (`file://`). Les jours/mois de l'agenda suivent la
  langue active. Les contenus des fichiers exportés (ICS, formulaire .docx officiel)
  restent inchangés. Nouveau test `tests/planner-i18n.test.js`.

### Corrigé
- **Interviews — autres fuites FR au changement de langue (audit complet)**
  (Interviews `3.68` → `3.69`, SW `statbel-v338` → `statbel-v339`) : correction des
  contenus rendus en JS qui restaient en français quelle que soit la langue —
  panneau « Adresses non géocodées » (message « tout géocodé », option « Toutes les
  enquêtes », en-tête, replis « adresse vide »/« vide », libellé « envoyé »), aperçu
  des modèles de rappel (« Objet : »), infobulles RDV de l'historique et placeholder
  de date (`jj/mm/aaaa`), indicateur d'état de sauvegarde (infobulles ⏳/✓/⚠️), et
  détail de sauvegarde (« contact(s) », « Aucun contact »). `changerLangue()` rappelle
  désormais aussi la légende de carte, l'info de sauvegarde du menu ⋮, l'indicateur
  d'état et le panneau non-géocodées pour les retraduire à chaud. Nouvelles clés i18n
  fr/nl/en/de. Test `tests/settings-delegation.test.js` étendu.
- **Interviews — sélecteur d'enquête : « — Aucune enquête — » figé en français**
  (Interviews `3.67` → `3.68`, SW `statbel-v337` → `statbel-v338`) : sans enquête
  chargée, l'option du sélecteur d'enquête (en-tête) restait en français dans toutes
  les langues. Le libellé passe désormais par la clé i18n `opt_no_survey` (fr/nl/en/de)
  et `changerLangue()` rappelle `refreshSelect()` pour le retraduire à chaud. Couvert
  par `tests/settings-delegation.test.js`.
- **Interviews — Paramètres : contenus dynamiques non retraduits au changement de langue**
  (Interviews `3.66` → `3.67`, SW `statbel-v336` → `statbel-v337`) : dans la section
  **Données & sauvegarde**, l'option « Toutes les enquêtes » du sélecteur de purge et
  le statut de sauvegarde (« ⚠️ Aucune sauvegarde… ») restaient figés dans la langue
  précédente jusqu'à la réouverture de la modale. Ces éléments sont rendus en JS (hors
  `data-i18n`), or `changerLangue()` ne rafraîchissait que les contenus balisés et
  l'éditeur de statuts. Ils sont désormais retraduits à chaud (`majSettingsUI()` +
  `majLastBackupInfo()`) quand la modale est ouverte. Couvert par
  `tests/settings-delegation.test.js`.

### Ajouté
- **Interviews — section « Modèles de rappel » traduite en 4 langues**
  (Interviews `3.65` → `3.66`, SW `statbel-v335` → `statbel-v336`) : les libellés,
  l'aide, les exemples (placeholders) et les boutons de la section
  **✉️ Modèles de rappel — prototype** (modale Paramètres) suivent désormais la
  langue active (fr/nl/en/de) via `data-i18n`/`data-i18n-ph` ; ils étaient jusque-là
  figés en français. Test `tests/reminder-templates.test.js` étendu aux libellés NL.
- **Interviews — modèles de rappel proposés en 4 langues**
  (Interviews `3.64` → `3.65`, SW `statbel-v334` → `statbel-v335`) :
  « Charger les modèles proposés » remplit désormais les cinq modèles (objet
  e-mail, e-mails CATI/CAWI et SMS CATI/CAWI) et la signature par défaut dans la
  **langue active de l'application** (fr/nl/en/de), avec repli sur le français.
  La ligne « rendez-vous » insérée dans les modèles personnalisés est également
  localisée (plus de texte français figé en NL/EN/DE). Test
  `tests/reminder-templates.test.js` étendu à un chargement non francophone.
- **Interviews — prototype de modèles personnalisables pour les rappels**
  (Interviews `3.63` → `3.64`, SW `statbel-v333` → `statbel-v334`) :
  les Paramètres permettent de charger, modifier, prévisualiser et réinitialiser
  cinq modèles (objet e-mail, e-mails CATI/CAWI et SMS CATI/CAWI). Les variables
  `{{prenom}}`, `{{enquete}}`, `{{rendez_vous}}`, `{{lien}}`,
  `{{identifiant}}`, `{{mot_de_passe}}`, `{{signature}}` et
  `{{signature_courte}}` sont remplacées à l'ouverture de l'application
  mail/SMS. Les personnalisations restent locales, sont validées lors d'une
  restauration JSON, et les messages i18n historiques restent le repli lorsque
  les champs sont vides. Nouveau test `tests/reminder-templates.test.js`.


### Corrigé
- **Interviews — popup PIN figé par-dessus les Paramètres (`inert` selon le z-index, plus l'ordre DOM)**
  (Interviews `3.62` → `3.63`, SW `statbel-v332` → `statbel-v333`) : la modale « Verrouillage par code PIN »
  (`#modalPin`, `z-index:300`) s'ouvre **par-dessus** les Paramètres (`#modalSettings`, `z-index:200`) mais
  la **précède dans le DOM**. `setupA11y()` déterminait la modale « du dessus » par l'ordre DOM et marquait
  donc `inert` la modale pourtant **visible** (modalPin) → boutons et clic sur le fond **morts** : impossible
  de sortir du popup. La modale active est désormais choisie par **z-index effectif** (départage par l'ordre
  DOM à z-index égal), pour toutes les neutralisations (`inert`), le piège de focus (Tab) et la fermeture par
  Échap. Régression réelle (pas un cache). Couvert par `tests/modal-backdrop.test.js` (scénario empilé).

### Ajouté
- **Interviews — fermeture des modales par tap sur le fond (backdrop)**
  (Interviews `3.61` → `3.62`, SW `statbel-v331` → `statbel-v332`) : un clic/tap sur le fond (hors de la
  carte) ferme la modale du dessus. Indispensable sur mobile, **sans touche Échap** : sans cette issue,
  une modale dont les boutons ne répondraient pas (ex. `index.html` neuf servi avec un `js/app.js` encore
  en cache pendant une mise à jour → `data-act` sans routeur enregistré) piégeait l'utilisateur (cas
  « impossible de sortir du popup PIN »). Le clic n'agit que sur l'overlay lui-même, jamais sur son
  contenu ; l'import (`modalNom`) passe par sa fermeture propre. L'**écran de verrouillage PIN**
  (`#lockScreen`, hors `.modal-overlay`) reste volontairement **non-fermable par le fond**. Complète la
  fermeture par Échap existante. Test `tests/modal-backdrop.test.js`.

### Documentation
- **Manuel & README — déverrouillage par empreinte** (`docs/manuel.html`, `README.md`) : le manuel
  (carte « Langue & apparence », légende de l'écran Paramètres, section Confidentialité RGPD) et le
  README (section Interface + table des modules `js/ui/`, avec le nouveau module `biometrie`) mentionnent
  désormais le déverrouillage par empreinte / Face ID en complément du code PIN, avec la nuance « porte
  d'accès, pas un chiffrement » et le repli PIN. Changement documentaire seul (pas de bump de version).
- **Manuel — guide des rappels e-mail / SMS (CAWI & CATI)** (`docs/manuel.html`) : nouvelle sous-section de
  la partie Interviews expliquant l'envoi d'un rappel (fiche → boutons ✉️ / 💬 → appli mail/SMS préremplie),
  l'adaptation automatique du message selon la méthode de collecte (CAWI avec lien/identifiant/mot de passe,
  CATI avec rendez-vous), le SMS sans objet, la préparation du lien CAWI et la note de confidentialité.
  Complétée pour couvrir le **prototype de modèles personnalisables** (Paramètres › ✉️ Modèles de rappel,
  variables `{{…}}`, aperçu) et le comportement de repli, avec renvoi vers `docs/templates-rappels.md`.
  Changement documentaire seul (pas de bump de version).

### Ajouté
- **Interviews — déverrouillage par empreinte / Face ID (complément du code PIN)**
  (Interviews `3.60` → `3.61`, SW `statbel-v330` → `statbel-v331`) : nouveau module `js/ui/biometrie.js`
  (WebAuthn, authentificateur de plateforme). Une fois un **PIN défini**, un interrupteur des Réglages
  « Déverrouillage par empreinte / Face ID » enrôle l'appareil ; l'écran de verrouillage affiche alors
  un bouton empreinte et **invite la biométrie automatiquement à l'ouverture**. Un succès déverrouille
  comme un PIN correct ; un échec/annulation **retombe silencieusement sur le pavé PIN**. Le **PIN reste
  le repli obligatoire** (biométrie indisponible sur un autre appareil, données du site vidées, navigateur
  sans capteur). 100 % **hors-ligne** : vérification faite par l'OS, sans serveur (le succès de l'assertion
  `userVerification:'required'` suffit — pas de backend à interroger). Comme le PIN, c'est une **porte
  d'accès, pas un chiffrement** des données au repos. Détection défensive (masqué si l'API/capteur manque
  ou hors contexte sécurisé). Clés i18n fr/nl/en/de. Test `tests/biometrie.test.js` (authentificateur
  virtuel via CDP : disponibilité, enrôlement, déverrouillage, repli PIN, désactivation).
- **Convertisseur — garde-fou : enquête mémorisée avec identifiants en notation scientifique**
  (Convertisseur `221` → `222`, SW `statbel-v329` → `statbel-v330`) : le correctif `cellTexte`
  (v216) ne répare les ID numériques longs qu'à l'**import**. Une enquête importée avant, restaurée
  depuis IndexedDB au démarrage, garde ses identifiants cassés (`2.02612E+11`) → re-télécharger son
  CSV ressort des logins CAWI inutilisables. `afficher()` détecte désormais ce cas et montre un
  avertissement `role="alert"` invitant à **ré-importer le `.xlsx` d'origine** (glisser-déposer) pour
  ré-analyser l'enquête avec le correctif. Clés i18n fr/nl/en/de. Test `tests/converter-sci-id-warn.test.js`.
- **Convertisseur & Planner — bannière « Mise à jour disponible » (mono-fichiers)**
  (Convertisseur `220` → `222`, Planner `195` → `196`, Interviews `3.59` → `3.60`, SW
  `statbel-v328` → `statbel-v330`) : depuis le passage de la navigation en *cache-first*,
  une page mono-fichier restait figée sur l'ancienne version en cache tant que la mise à
  jour n'avait pas été « posée » **depuis Interviews** — la seule page dotée du popup. Les
  deux pages **réutilisent désormais `js/boot.js`** (l'amorçage PWA autonome d'Interviews) :
  elles proposent le **même popup opt-in** « Mise à jour disponible → Poser » et se mettent
  donc à jour toutes seules. `js/boot.js` gagne un garde anti-doublon du `<link rel="manifest">`
  (les mono-fichiers en déclarent un en statique). Enregistrements SW inline supprimés des deux
  pages. Test garde-fou pur `tests/monofile-sw-update.test.js`.
- **Interviews — garde-fou d'import : identifiant web en notation scientifique**
  (Interviews `3.59` → `3.60`) : un `TX_WEB_USER_ID`/`TX_WEB_USER_PSWRD` numérique long cassé
  par un tableur en `2.02612E+11` a **perdu sa précision** — irréparable. `parseCSV` le détecte
  (`stats.idsCorrompus`) et l'aperçu d'import affiche un **avertissement `role="alert"`** invitant
  à réimporter depuis le `.xlsx` d'origine via le Convertisseur à jour, plutôt que d'envoyer un
  login CAWI inutilisable à un répondant. Non bloquant (le reste de l'import se poursuit). Couvre
  aussi l'import `.xlsx` direct dans Interviews. Clés i18n fr/nl/en/de. Test
  `tests/import-id-corrompu.test.js`.
- **Planner — lien « Ouvrir » après génération de la candidature `.docx`**
  (Planner `194` → `195`, SW `statbel-v327` → `statbel-v328`) : à la fin de
  `genererCandidature()`, le fichier est toujours téléchargé, mais un toast d'action
  remplace le simple message de confirmation : il propose un bouton **« Ouvrir »**
  qui ré-adresse l'URL blob du `.docx` (`target="_blank"`), pour éviter d'aller
  chercher le fichier dans le dossier Téléchargements — surtout utile sur mobile, où
  le lien déclenche « Ouvrir avec… ». Rappel : une page web ne peut pas lancer Word
  elle-même ; l'ouverture effective reste décidée par la plateforme. Le nouveau helper
  `afficherToastFichier()` maintient l'URL blob vivante jusqu'à la fermeture du toast
  (bouton ✕ ou expiration ~9 s), puis la révoque. Toast = région live accessible
  (`role="status"`), lien étiqueté du nom de fichier. Couvert par `tests/planner.test.js`.

### Sécurité
- **Interviews — CSP durcie : `script-src 'self'` sans `'unsafe-inline'` (lot 6 du chantier `onclick`)**
  (Interviews 3.58 → 3.59, SW `statbel-v326` → `statbel-v327`) : aboutissement du chantier de
  délégation. Le dernier bloc `<script>` inline d'`index.html` (amorçage PWA + popup de mise à jour)
  est externalisé dans **`js/boot.js`** (script classique, autonome, ajouté à `APP_CRITICAL`), et
  `'unsafe-inline'` est **retiré de `script-src`**. Combiné à la disparition de tous les handlers
  `on*=` inline (lots 1→5), le navigateur bloque désormais **toute** exécution de script inline
  (défense en profondeur contre l'injection, pour une app manipulant des données personnelles).
  `style-src 'unsafe-inline'` est conservé (styles inline hors périmètre). Nouveau test garde-fou
  **pur** `tests/no-inline-handlers.test.js` : refuse tout handler inline (statique ou généré),
  tout `<script>` inline, et toute réapparition de `'unsafe-inline'` dans `script-src`. Le test
  existant `csp.test.js` (écoute des `securitypolicyviolation`) confirme 0 violation sous la CSP
  stricte. Note : le pont de compatibilité `window` est **conservé** — il ne sert plus aux handlers
  inline mais reste requis par le harnais de tests headless (qui pilote l'app via les globals) ; son
  allègement supposerait de migrer les tests vers des imports ES (chantier distinct).

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
