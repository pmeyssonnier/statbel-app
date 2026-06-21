# Statbel Interviews

Application **mono-fichier** (HTML/CSS/JS, sans dépendance ni build) pour le suivi
des contacts à interviewer dans le cadre de l'enquête Statbel sur les forces de
travail (LFS). Conçue pour un usage **terrain, hors-ligne** : il suffit d'ouvrir
`enquetes_statbel.html` dans un navigateur (double-clic, `file://`) ou de
l'installer en **PWA** (GitHub Pages).

Version actuelle : **3.2**.

## Vues

- **📋 Liste** — recherche (nom/prénom/adresse/téléphone) + filtres par statut, fiche éditable.
- **🗺️ Carte** — Leaflet, marqueurs par statut, distance depuis votre position, popup adresse.
- **📅 Suivi** — barre de progression, **graphe d'activité quotidienne** par statut + **courbe de % de Fait cumulés** (axe %, infobulles), journal chronologique des événements (clic sur une barre → filtre du jour).
- **📊 Résumé** — KPI, progression globale, **courbe d'avancement**, tableau par enquête/statut, périmètre **Toutes / Enquête active**, export **Excel / PDF**.

## Suivi des interviews

- **Statuts personnalisables** (libellé, couleur, icône, « terminé », « rendez-vous »).
- **Historique** par contact : ajout/édition d'entrées (statut + date via 📅, **heure**, **RDV** via sélecteur date-heure), suppression ; statut/date courants = dernière entrée.
- Statut et date courants recalculés automatiquement ; RDV rattaché à l'entrée « En cours ».

## Import / Export

- Import **CSV / Excel** ; séparateur auto-détecté (`,` ou `;`).
- **Aperçu d'import** : lignes lues / à importer / rejetées (motifs), colonnes reconnues/ignorées.
- **Contrôles de cohérence** : code pays inconnu, date de naissance invalide, sexe ≠ M/F, statut inconnu — signalés, et valeurs incohérentes **barrées en rouge** dans la comparaison et sur la fiche.
- **Correction automatique des codes pays** : ISO-2 → ISO-3 (DE→DEU…) et alias fréquents (GER→DEU, ENG→GBR, SPA→ESP, POR→PRT, BUL→BGR).
- **Comparaison avant écrasement** (import dans une enquête existante ou restauration) : ajouts / modifications (ancienne → nouvelle valeur) / suppressions / inchangés, avec **détail des changements d'historique** (entrée modifiée, ➕ ajoutée en vert, ➖ supprimée en rouge barré).
- **Préservation du suivi** : à la réimportation, le statut/date/RDV/historique des contacts déjà suivis est conservé ; seuls les champs descriptifs sont mis à jour.
- Option **« N'importer/restaurer que les enregistrements corrects »** : les enregistrements en erreur sont exclus (raison affichée) ; un enregistrement erroné **déjà présent n'est jamais supprimé**.
- Export **CSV** (séparateur configurable : auto régional / `,` / `;`), l'historique conserve heure et RDV ; export **vCard** par contact ; **sauvegarde/restauration JSON** complète (avec option de préservation de l'historique).

## Données dérivées

- Décodage **pays** (nom localisé + ISO-2), **état civil** (genré, nombreux alias FR/NL reconnus), **âge**, **taille du ménage**.

## Interface

- **Multilingue FR / NL / EN / DE** (langue pivot interne = anglais ; détection au 1er lancement).
- **Apparence** : police, taille du texte (la courbe se ré-ancre après rotation/zoom mobile), thème.
- **Verrouillage par code PIN** (optionnel, jamais inclus dans les sauvegardes).

## Confidentialité (RGPD)

- Toutes les données restent **dans le navigateur** (IndexedDB) — **aucun serveur**.
- Géocodage par **services publics belges** (UrbIS/CIRB · Bruxelles, SPW · Wallonie, Geopunt · Flandre ; OSM/Nominatim en repli générique) — pas de transfert hors UE ; navigation par coordonnées GPS.
- ⚠️ **Aucune donnée personnelle n'est versionnée** : `.gitignore` en liste blanche stricte (seuls `enquetes_statbel.html`, `README.md`, `.gitignore`) — les CSV/JSON/vCard/xlsx d'enquêtés sont exclus.

## Utilisation

Ouvrir `enquetes_statbel.html`, puis menu ⋮ → **Importer** un fichier CSV/Excel.
Voir ⋮ → **Aide** dans l'application pour le détail des fonctions.

> Outil complémentaire (dépôt séparé) : **statbel-converter** convertit les exports
> bruts STATBEL `GRP_2026xxxxx` en CSV importables par cette application.

---
© Consultora sprl 2026
