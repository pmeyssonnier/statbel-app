# EFT 2026 — Organisation de l'enquête (vue d'ensemble, vague 1 CAPI)

> Connaissance métier (terrain) reformulée depuis la formation Statbel
> « EFT 2026 — Organisation de l'enquête » et le gabarit de feuille de contact
> **R35 (CAPI)**. Ce fichier décrit le **processus et le modèle de données**,
> **jamais des données de ménage ni des coordonnées personnelles** (les noms,
> téléphones directs et boîtes mail des superviseurs restent hors dépôt —
> coordonnées communiquées par Statbel). Complète `docs/eft-cati-cawi.md`
> (vagues 2 à 4) et le skill `statbel-data` (n° de groupe, référent/cible,
> provinces, codes NIS).

## L'EFT en bref

L'**Enquête sur les Forces de Travail** (EFT / LFS / EAK / AKE) mesure l'emploi,
le chômage et l'inactivité selon les définitions du **BIT**, identiques dans
toute l'U.E. → seule source fiable pour les comparaisons internationales
(coordination Eurostat, ~33 pays). Échantillon **représentatif** tiré chaque
trimestre du **registre national** (par âge, sexe, région) ; tous les ménages
résidents sauf ménages collectifs, ménages composés exclusivement de personnes
de 89 ans et plus, et personnel diplomatique protégé. **Chaque membre de 15 ans
et plus** est interrogé.

## Le panel : 4 vagues, mixed-mode

Chaque ménage est interrogé **4 fois sur 15 mois** : vague 1, puis +3 mois,
+9 mois, +3 mois. Les modes (détaillés dans `docs/eft-cati-cawi.md`) :

| Vague | Mode |
|---|---|
| 1 | **CAPI** — face-à-face (Computer-Assisted Personal Interviewing) |
| 2, 3, 4 | **CATI** (téléphone) ou **CAWI** (web) |

Un même enquêteur qui fait la vague 1 **suit ensuite le ménage** aux vagues
suivantes. Volumes indicatifs : ~19 000 ménages / trimestre, soit ~1 100 groupes
(≈ 290 en vague 1 CAPI, le reste en vagues 2-4).

## Numérotation (modèle de données clé)

**Numéro de groupe** = `V-SS-GG` :

- `V` = n° de **vague** (1-4) ;
- `SS` = **semaine de référence** par trimestre : **T1 → 01-13**, **T2 → 14-26**,
  **T3 → 27-39**, **T4 → 40-52** ;
- `GG` = **n° de groupe** (01-48).

**Numéro de ménage** = `AAAA-V-SS-GG-MMM-split` : année d'enquête + le triplet
ci-dessus + **n° de ménage** (001-026) + **n° de split**. Voir le skill
`statbel-data` pour le format complet et son usage dans le Convertisseur.

## Travailler au rythme des groupes

- Les adresses sont **liées à un groupe**. Taille d'un groupe en vague 1 :
  **23 ménages en Wallonie, 26 à Bruxelles** ; aux autres vagues, la taille
  dépend du taux de réponse précédent.
- **~1,5 mois avant** le trimestre : la liste des groupes ouverts en vague 1 est
  envoyée → l'enquêteur **se porte candidat** → attribution (**max 4 groupes**).
  Les groupes des vagues 2-4 sont attribués **d'office**.
- Chaque groupe a une **semaine de référence** ; le terrain commence le **lundi
  suivant**, avec **3 semaines** pour interroger. Tout retard doit être signalé à
  Statbel ; un groupe fourni en retard sans autorisation peut être **refusé**
  (donc non payé).
- **1 groupe = 1 enquêteur** (prise de contact, entretien, paiement).

## Vague 1 — CAPI en pratique

- **1 semaine avant** : réception par la poste du matériel (badge de
  légitimation, cartes de passage, questionnaires TIC papier…).
- **Pendant la semaine de référence** : un courrier annonce la visite au ménage
  (nom de l'enquêteur, moyens de contact, n° du Contact Center). Bourgmestres et
  zones de police concernés sont informés.
- L'enquêteur dispose de la **liste des ménages** (composition, adresse ; par
  membre : nom, prénom, âge, nationalité, lieu de naissance, état matrimonial) et
  d'une **carte** d'aide à l'itinéraire.
- **Face-à-face**, sauf ménages composés exclusivement d'inactifs de plus de
  65 ans → par téléphone. Toutes les personnes de 15 ans et plus doivent répondre.
- **Obligation légale** de participer (AR du 10 janvier 1999, modifié le
  25 mars 2016) mais l'enquêteur **n'a aucun pouvoir de contrainte** : on
  **convainc**, on ne menace pas.
- La vague 1 **collecte les infos pour la suite** : personne de contact vague 2,
  téléphone + e-mail, intention de déménager (+ nouvelle adresse), **mode
  souhaité** (CAWI ou CATI).

### Minimum 4 tentatives de contact

Contacter **tous** les ménages à partir du lundi suivant la semaine de référence,
avec **au moins 4 tentatives** dont **1 en soirée (après 18 h)** et **1 le
week-end**, **réparties sur deux semaines calendrier**. Plus il y a de tentatives,
meilleures sont les chances. Aux 2 premières tentatives infructueuses : laisser
une carte de visite avec proposition de RDV.

## Feuille de contact R35 (CAPI)

Le gabarit **R35** structure le suivi des tentatives (aligne les statuts de
l'app Interviews). Trois axes :

**Mode de prise de contact** : sonner à la porte · par e-mail · carte dans la
boîte aux lettres · le répondant a contacté le Contact Center · l'enquêteur n'a
pas contacté le ménage.

**Résultat des tentatives** : rendez-vous pris (noter **date + heure**) ·
problème avec l'habitation (pas construite, entreprise, ménage collectif,
inhabitée) · refus · entretien impossible · pas disponible au moment du contact ·
pas de réponse (porte, téléphone, courrier). **Le code final n'est posé
qu'après au moins 4 tentatives.**

**Interview impossible** — motifs : déménagé en Belgique · émigré à l'étranger ·
déménagé vers un ménage collectif · décédé · **barrière linguistique**
(questionnaire disponible en **FR, NL, EN, DE**) · malade / handicap / mémoire de
**longue durée** sans proxy possible · indisponible pendant toute la collecte
(vacances, voyage) · autre raison.

**Suivi des déménagements / splits** :

- **Même commune** : interroger le ménage sélectionné à sa nouvelle adresse,
  ou celui habitant à l'adresse sélectionnée ; sinon « interview impossible —
  a déménagé ».
- **Autre commune** : interroger le ménage habitant à l'adresse sélectionnée ;
  sinon « interview impossible — a déménagé ».
- **Ménage splité** : suivre la partie du ménage joignable en premier
  (préférence à qui reste à l'adresse sélectionnée) ; retirer les partants de la
  composition, ajouter les nouveaux membres.

## Recrutement TIC des ménages (ICT HH)

Aux **T1 et T2**, un module TIC : le ménage remplit lui-même le questionnaire en
ligne (CAWI) ou le renvoie par la poste. **Qui répond** : la personne de **16 à
74 ans dont l'anniversaire est le plus récent** (déterminée par le programme
CAPI). L'enquêteur informe et motive (surtout les personnes peu familières
d'internet), note le prénom + le n° d'identification complet + son n° d'enquêteur
sur le questionnaire, et remet la feuille d'instructions + codes personnels
d'accès web. Un rappel automatique part **14 jours** après la visite si aucun
questionnaire (web ou papier) n'est reçu.

## Paiements (structure)

- **Statut reconnu** : un **contrat** est signé pour chaque enquête et chaque
  trimestre ; enquêteurs enregistrés comme employés du SPF Economie (Persopoint),
  connus de l'ONEM et de l'inspection sociale. En cas de cumul avec une
  allocation, prévenir ONEM/mutualité **et** Statbel. Assurance accidents
  corporels (Ethias) pendant le terrain.
- **Payé pour** : les formations (déplacements inclus) et **chaque enquête
  positive** réalisée selon les consignes. Une enquête est **« réussie »** si :
  ménages sélectionnés interrogés, info collectée pour tous les 15 ans et +,
  dans les délais, par soi-même, correctement (manuels) et complètement
  (bulletin de ménage → fin d'entretien).
- **Clôture** : encoder le **bordereau via SharePoint** à la clôture de chaque
  groupe et chaque vague (déclarer le nombre de ménages positifs) ; seul le
  premier bordereau encodé compte. Puis **déclaration de créance** signée à
  renvoyer. Paiement **à la clôture du groupe** (pas à la fin des 4 vagues).
- **Montants** : indexés sur les salaires des fonctionnaires, communiqués par
  Statbel via le **barème officiel** (non repris ici). Un montant net combine une
  part non imposable (indemnité de frais) et une part imposable soumise à l'ONSS
  et au précompte.

## Informatique

- Vague 1 : enquêtes menées sur un **PC fourni par Statbel** ; **pas besoin
  d'internet** pour interroger le ménage. Document à signer à la réception et au
  retour du PC ; en cas de vol, déposer plainte (PV) et avertir Statbel.
- Vagues 2+ : plateforme **CATI accessible par navigateur** (questionnaire web,
  feuille de contact, outils de suivi des groupes/ménages).

## Encadrement & communication

- Des **superviseurs régionaux** répartis par province traitent les délais et les
  questions de contenu (coordonnées fournies par Statbel — hors dépôt).
- Communication via les boîtes fonctionnelles **par enquête** et les outils
  Statbel (SharePoint, Teams, adresse SPF Economie). Tout changement de situation
  personnelle passe par le canal « enquêteurs » dédié.

## Ce que cela implique pour les apps

- **Interviews** — les statuts par défaut et le préréglage **CAPI** reflètent la
  feuille R35 (à faire / RDV / réalisé / absent / refus / déménagé) ; les rappels
  e-mail/SMS servent le suivi des tentatives et l'accès CAWI (identifiant + mot de
  passe depuis 2026, cf. `docs/eft-cati-cawi.md`).
- **Planner** — la candidature vague 1 (max 4 groupes), les **semaines de
  référence** par trimestre et le rythme des groupes structurent l'agenda et le
  formulaire de candidature.
- **Convertisseur** — la **numérotation** `AAAA-V-SS-GG-MMM` pilote le rattachement
  GRP ↔ planning et l'extraction référent/cible/ménage.
