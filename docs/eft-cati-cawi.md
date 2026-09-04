# EFT — vagues 2 à 4 : CATI / CAWI

> Connaissance métier (terrain) reformulée depuis la formation Statbel
> « EFT 2025 — CATI/CAWI, formation nouveaux enquêteurs ». Ce fichier décrit le
> **processus**, jamais des données de ménage. Complète `docs/architecture-convertisseur.md`
> (technique) et le skill `statbel-data` (n° de groupe, référent/cible, provinces, NIS).

## Le panel : 4 vagues, deux modes

L'EFT interroge chaque ménage sur **4 vagues**. La vague 1 est en face-à-face (CAPI) ;
à partir de la **vague 2**, le ménage répond soit lui-même en ligne (**CAWI**), soit par
téléphone avec un enquêteur (**CATI**). Le questionnaire CATI/CAWI est **plus court**
que le CAPI : il porte surtout sur les **changements** depuis la vague précédente.

Avant chaque vague, le ménage reçoit une **lettre d'introduction** avec les instructions
pour participer par internet. La préférence (téléphone ou internet) a été recueillie
**dès la vague 1**, et elle pilote le travail de l'enquêteur :

| Préférence du ménage | Travail de l'enquêteur |
|---|---|
| **Par téléphone** | il appelle et administre le questionnaire (CATI) |
| **Par internet** | il **vérifie que le questionnaire est complété entièrement** ; sinon il relance par mail ou téléphone — au téléphone, on motive la personne à répondre **immédiatement** |

### La bascule vers le CAWI s'accentue à chaque vague

| Vague | CAWI (ménage seul) | CATI (enquêteur) |
|---|---|---|
| 2 | 20 % | 80 % |
| 3 | 40 % | 60 % |
| 4 | 95 % | 5 % |

La charge de travail de l'enquêteur décroît donc fortement de la vague 2 à la vague 4 :
en vague 4, l'essentiel du travail est du **suivi de complétion**, pas de l'interview.

## Les deux applications

| Usage | Adresse |
|---|---|
| Ménage, en autonomie (CAWI) | `https://statbel.statdata.be/b/LFSPanel2025` — **ne pas chercher via Google** |
| Enquêteur (CATI) | `https://lfspanel.statdata.be/lfspanel/` |

L'enquêteur utilise **la même application CAWI** que les ménages : pas d'identification
par ménage, ni pour le questionnaire en ligne ni pour la feuille de contact — on y entre
par le **lien propre à chaque ménage** depuis la liste.

Documents reçus par l'enquêteur : la **liste des ménages**, une **copie de la lettre**
envoyée aux ménages, et le **bordereau**.

## La liste des ménages (application CATI)

On sélectionne son lot par trois menus déroulants : **année**, **trimestre**, **groupe**.
L'écran donne ensuite, pour le groupe : n° de groupe, année, trimestre, **n° de vague**,
**semaine de référence** et **période du terrain**.

Puis, par ménage :

- **données de contact** : n° du ménage, nom de la personne de contact, adresse,
  téléphone, e-mail ;
- **préférence** de méthode d'interrogation (en ligne ou par téléphone) ;
- **état d'avancement** du questionnaire ;
- **résultat de la feuille de contact** ;
- **lien vers le CAWI** et **lien vers la feuille de contact** (par ménage, sans login) ;
- **centre** de rattachement : Bruxelles, Liège, Charleroi, Gand, Anvers.

### État d'avancement du questionnaire (4 valeurs)

`Vide` → `HH s'est connecté` → `Partiellement complété` → `Clôturé`

C'est l'axe *complétion*, alimenté par l'application en ligne.

### Résultat de la feuille de contact (6 valeurs)

`Pas encore de contact entrepris` · `Rdv fixé` · `Tentatives de contacts sans résultat` ·
`Négatif` · `Interview réalisée` · `Inconnu`

C'est l'axe *démarche de l'enquêteur*, saisi par lui. Consigne explicite de la formation :
**remplir la feuille de contact à temps et correctement**. Un commentaire peut être ajouté
pour une enquête **négative**.

> **Règle à retenir** : quand le ménage complète lui-même l'enquête via internet,
> il n'y a **pas de feuille de contact** à remplir.

## Recrutement EBM en fin de vague 4

À la fin de la **4ᵉ** vague, une question ajoutée au questionnaire recrute le ménage pour
l'**Enquête sur le Budget des Ménages** : méthode de travail, **2 semaines** de relevé des
dépenses, période de passage d'un enquêteur pour remettre les documents et expliquer, et
**incitant financier de 45 € (papier) ou 50 € (internet)**. L'EBM sert de base au schéma de
pondération de l'**indice des prix à la consommation**.

## Ce que ça implique pour nos apps

- **Deux axes distincts, pas un seul.** L'application Statbel sépare la *complétion du
  questionnaire* (4 valeurs) de la *démarche de contact* (6 valeurs). Le module Interviews
  n'a qu'un axe, ses statuts par défaut (`To do`, `In progress`, `Done`, `Absent`,
  `Refusal`, `Moved`) avec les drapeaux `done` / `rdv` / `realise`. Correspondance
  naturelle côté démarche : `Rdv fixé` → statut à drapeau `rdv`, `Interview réalisée` →
  drapeau `realise`, `Négatif` → un statut terminal non réalisé. Les statuts étant
  **personnalisables**, un enquêteur qui veut coller à la feuille de contact peut recréer
  les 6 valeurs telles quelles ; rien n'est à figer dans le code.
- **Les vagues 2 à 4 sont surtout du suivi.** Le besoin dominant en vague 3 et 4 n'est plus
  « organiser une tournée » mais « repérer les questionnaires non clôturés à relancer ».
  Un lot y contient une majorité de ménages sans déplacement.
- **Le n° de vague fait partie de l'identité du lot**, au même titre que l'année, le
  trimestre et le groupe (cf. `AAAA-VSSGG` dans le skill `statbel-data`) ; la semaine de
  référence et la période du terrain encadrent le travail.
- **Les liens par ménage sont sans login.** Un lien CAWI ou feuille de contact est donc un
  secret de fait : s'il devait un jour transiter par nos apps, il se traite comme une
  donnée personnelle — il reste sur l'appareil, jamais dans un export partagé.
- **Le Planner reste centré sur le face-à-face** (vague 1 / CAPI, déplacements, agenda) ;
  le CATI/CAWI est du travail « au bureau », sans itinéraire.
