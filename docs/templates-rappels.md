# Note d’utilisation — modèles de rappel e-mail et SMS

## Objectif

L’application **Statbel Interviews** permet de préparer des rappels personnalisés
pour les contacts **CATI** (entretien téléphonique) et **CAWI** (questionnaire en
ligne).

L’application n’envoie aucun message automatiquement. Elle ouvre l’application
de messagerie ou de SMS de l’appareil avec le destinataire et le texte
préremplis. L’enquêteur garde donc la possibilité de relire, modifier ou annuler
le message avant son envoi.

## Accéder aux modèles

1. Ouvrir **Interviews**.
2. Ouvrir le menu **⋮**.
3. Sélectionner **Paramètres**.
4. Déplier **✉️ Modèles de rappel — prototype**.
5. Cliquer sur **Charger les modèles proposés**.

Les modèles proposés se chargent dans la **langue active de l’application**
(français, néerlandais, anglais ou allemand). Pour obtenir les modèles dans une
autre langue, changez d’abord la langue dans les Paramètres, puis rechargez les
modèles proposés.

Cinq modèles sont disponibles :

- objet de l’e-mail ;
- e-mail CATI ;
- e-mail CAWI ;
- SMS CATI ;
- SMS CAWI.

Deux signatures peuvent également être définies :

- une signature complète pour les e-mails ;
- une signature courte pour les SMS.

## Variables utilisables

Les variables sont remplacées automatiquement lors de la préparation du message.

| Variable | Valeur insérée |
|---|---|
| `{{prenom}}` | prénom du contact |
| `{{enquete}}` | nom de l’enquête active |
| `{{rendez_vous}}` | date et heure du rendez-vous, si elles existent |
| `{{lien}}` | adresse du questionnaire CAWI configurée dans les Paramètres |
| `{{identifiant}}` | identifiant web CAWI du contact |
| `{{mot_de_passe}}` | mot de passe web CAWI du contact |
| `{{signature}}` | signature complète |
| `{{signature_courte}}` | signature courte pour SMS |

La syntaxe doit être conservée exactement avec les doubles accolades, par
exemple `{{prenom}}`.

## Modèle d’e-mail CATI proposé

**Objet**

```text
Rappel – Enquête {{enquete}} de Statbel
```

**Message**

```text
Bonjour {{prenom}},

Je me permets de vous rappeler que votre ménage a été sélectionné pour participer à l’enquête {{enquete}} organisée par Statbel.

{{rendez_vous}}
Si ce moment ne vous convient pas, vous pouvez me répondre directement.

Merci d’avance pour votre participation.

Bien cordialement,
{{signature}}
```

## Modèle d’e-mail CAWI proposé

```text
Bonjour {{prenom}},

Votre ménage a été sélectionné pour participer à l’enquête {{enquete}} organisée par Statbel.

Lien : {{lien}}
Identifiant : {{identifiant}}
Mot de passe : {{mot_de_passe}}

Merci d’avance pour votre participation.

Bien cordialement,
{{signature}}
```

## Modèle de SMS CATI proposé

```text
Bonjour {{prenom}}, rappel Statbel pour l’enquête {{enquete}}. {{rendez_vous}} Merci, {{signature_courte}}
```

## Modèle de SMS CAWI proposé

```text
Bonjour {{prenom}}, enquête {{enquete}} de Statbel : {{lien}} – ID : {{identifiant}} – MDP : {{mot_de_passe}}. Merci, {{signature_courte}}
```

## Prévisualiser les messages

Le bouton **Aperçu** produit quatre exemples avec des contacts fictifs :

- e-mail CATI ;
- e-mail CAWI ;
- SMS CATI ;
- SMS CAWI.

L’aperçu permet de vérifier le texte et le remplacement des variables sans
ouvrir l’application de messagerie et sans utiliser les données d’un véritable
contact.

## Enregistrement et sauvegarde

Les modèles et signatures sont enregistrés automatiquement dans le navigateur,
dans les paramètres locaux de l’application.

Ils sont également intégrés à la sauvegarde JSON générale. Lors d’une
restauration, seuls les champs autorisés sont acceptés et leur longueur est
limitée.

Les modèles ne sont pas envoyés à un serveur et ne sont pas enregistrés dans le
dépôt GitHub.

## Revenir aux messages automatiques

Le bouton **Réinitialiser** efface les modèles personnalisés.

Lorsqu’un modèle est vide, Interviews utilise le message automatique historique
correspondant à la langue active de l’application. La réinitialisation ne
supprime pas les données des enquêtes ou des contacts.

## Précautions pour les messages CAWI

Les identifiants et mots de passe CAWI sont des données confidentielles.

Avant tout envoi :

1. vérifier l’identité du destinataire ;
2. vérifier l’adresse e-mail ou le numéro de téléphone ;
3. relire le message prérempli ;
4. ne pas envoyer les identifiants à une autre personne du ménage sans
   justification ;
5. supprimer manuellement les informations inutiles du message.

L’application ne garantit pas la confidentialité offerte par l’application
e-mail ou SMS utilisée après l’ouverture du message.

## Limites du prototype

- Les modèles proposés existent en français, néerlandais, anglais et allemand ;
  le modèle chargé suit la langue active de l’application.
- Les variables inconnues ou mal orthographiées sont remplacées par une valeur
  vide.
- Un SMS long peut être découpé en plusieurs SMS par l’opérateur.
- Le système prépare le message mais ne peut pas confirmer sa réception.
- Le PIN et la biométrie protègent l’accès à l’application, mais ne chiffrent pas
  les données stockées sur l’appareil.
