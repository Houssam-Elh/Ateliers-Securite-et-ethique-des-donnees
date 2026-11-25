# Smart City & Blockchain

## Plateforme décentralisée de gestion des signalements urbains

**UrbanIssueRegistry** est une application décentralisée qui permet aux citoyens de signaler des problèmes dans l’espace public et à une municipalité d’en suivre le traitement. Le contrat intelligent conserve les signalements et leur historique sur une blockchain locale de développement.

Le parcours d’un signalement suit les statuts suivants :

```text
Reported → Assigned → InProgress → Resolved → Closed
```

Un citoyen peut créer un signalement au statut `Reported`. Le compte administrateur municipal affecte une équipe et fait avancer le statut. Le registre et l’historique restent consultables publiquement dans l’application.

## Fonctionnalités

- Création et consultation publique des signalements.
- Identifiants uniques et prévention des doublons.
- Affectation d’équipes et changements de statut réservés à l’administrateur municipal.
- Historique horodaté des actions, avec commentaires et adresses des comptes qui les ont effectuées.
- Import de fichiers Excel, XLS ou CSV avec aperçu, validation des lignes et sélection avant enregistrement.
- Interface React connectée à MetaMask par ethers.js.

## Technologies

- Solidity et Hardhat pour le contrat et la blockchain locale.
- React et Vite pour l’application web.
- ethers.js pour les transactions et les lectures du contrat.
- SheetJS pour lire les fichiers Excel et CSV dans le navigateur.

## Prérequis

- Node.js 18 ou supérieur et npm.
- MetaMask installé dans le navigateur.
- Les dépendances installées dans les dossiers racine et `frontend`.

## Installation

Ouvrir un terminal dans le dossier du mini-projet, puis installer les dépendances à la racine :

```powershell
npm ci
```

Installer ensuite les dépendances du frontend :

```powershell
Set-Location frontend
npm ci
Set-Location ..
```

## Démarrage local

Le démarrage utilise trois terminaux PowerShell. Garder les deux premiers ouverts pendant toute l’utilisation de l’application.

### 1. Démarrer la blockchain locale

Dans le premier terminal, depuis le dossier racine du mini-projet :

```powershell
npm run node
```

Hardhat démarre un nœud local à l’adresse RPC `http://127.0.0.1:8545` avec le Chain ID `31337`. Il affiche des comptes de test et leurs clés privées.

### 2. Déployer le contrat

Dans un deuxième terminal, ouvrir le même dossier racine et lancer :

```powershell
node ./node_modules/hardhat/internal/cli/cli.js run scripts/deploy.js --network localhost
```

Le script affiche l’adresse du contrat déployé et l’écrit dans `frontend/.env.local`. Le fichier est utilisé par Vite pour connecter l’application à ce déploiement local.

### 3. Démarrer le frontend

Dans un troisième terminal :

```powershell
Set-Location frontend
npm run dev
```

Ouvrir l’adresse locale affichée par Vite, généralement [http://localhost:5173](http://localhost:5173).

## Configuration de MetaMask

Ajouter le réseau local Hardhat dans MetaMask :

| Paramètre | Valeur |
|---|---|
| Nom du réseau | Hardhat Localhost |
| URL RPC | http://127.0.0.1:8545 |
| Chain ID | 31337 |
| Devise | ETH |

Pour administrer le registre ou importer un fichier, utiliser le **compte de test n° 0** affiché par le nœud Hardhat. Importer dans MetaMask la clé privée de test correspondant à ce compte. Le contrat définit le compte qui le déploie comme administrateur municipal.

Les comptes et clés affichés par Hardhat sont réservés au réseau local de test. Ne jamais utiliser ces clés pour un portefeuille réel ou un réseau public.

## Essayer l’application

### Signaler un problème

1. Dans la DApp, ouvrir **Report Issue**.
2. Connecter un portefeuille MetaMask au réseau Hardhat Localhost.
3. Renseigner la catégorie, la localisation, la description et la priorité.
4. Envoyer la transaction. Le nouveau signalement apparaît au statut `Reported`.

### Gérer un signalement

1. Connecter le compte administrateur municipal.
2. Ouvrir **Municipality**, puis **Manage Issues**.
3. Affecter une équipe à un signalement `Reported`.
4. Faire avancer le signalement dans l’ordre des statuts et ajouter un commentaire aux changements.

Les comptes autres que l’administrateur peuvent consulter la console en lecture seule. Ils ne peuvent pas affecter une équipe ou modifier un statut.

### Importer un fichier

1. Connecter le compte administrateur municipal.
2. Ouvrir **Municipality**, puis **Batch Import (Excel/CSV)**.
3. Charger un fichier `.xlsx`, `.xls` ou `.csv`.
4. Vérifier l’aperçu et les erreurs signalées, puis sélectionner les lignes valides à enregistrer.
5. Cliquer sur le bouton d’enregistrement et confirmer les transactions dans MetaMask.

Le classeur de démonstration `urban_issues.xlsx` se trouve à la racine du projet. La première feuille doit contenir les colonnes suivantes :

| Colonne | Règle |
|---|---|
| `issueId` | Obligatoire et unique |
| `issueType` | Obligatoire |
| `location` | Obligatoire |
| `description` | Obligatoire |
| `reportDate` | Obligatoire, date réelle au format `YYYY-MM-DD` |
| `priority` | Obligatoire : `Low`, `Medium` ou `High` |
| `reportedBy` | Facultatif |
| `assignedTo` | Facultatif si le statut est `Reported`, obligatoire pour les autres statuts |
| `status` | Facultatif. Si renseigné, doit être un statut reconnu et correspondre à l’équipe |

Le module lit et valide les données dans le navigateur. Rien n’est envoyé sur la blockchain avant que l’utilisateur sélectionne les lignes et lance l’enregistrement. Si une transaction échoue après la création d’un signalement, réimporter la même ligne permet de reprendre les étapes de statut restantes lorsque les données correspondent au signalement déjà enregistré.

## Compiler et exécuter les tests

Depuis le dossier racine du projet :

```powershell
npm run compile
npm test
```

La suite comprend 11 tests portant sur la création et la consultation des signalements, les droits de l’administrateur, l’affectation, le workflow et l’historique.

## Réseau et adresse du contrat

Le projet est configuré pour Hardhat Localhost, Chain ID `31337`. L’adresse est créée lors du déploiement local et enregistrée dans `frontend/.env.local`. Elle peut différer après un redémarrage du nœud.

Le nœud Hardhat conserve les données uniquement pendant son exécution. Après son arrêt, les signalements sont effacés. Pour repartir d’un état propre, redémarrer le nœud, redéployer le contrat et redémarrer Vite afin qu’il recharge l’adresse du nouveau déploiement.

## Dépannage

- **L’application indique qu’aucune adresse de contrat n’est configurée** : démarrer le nœud, déployer le contrat, puis redémarrer Vite.
- **Impossible de lire le contrat** : vérifier que le nœud Hardhat tourne toujours sur le port `8545` et que l’adresse dans `frontend/.env.local` correspond au déploiement courant.
- **MetaMask affiche un mauvais réseau** : sélectionner Hardhat Localhost avec le Chain ID `31337`.
- **Les actions municipales sont en lecture seule** : connecter dans MetaMask le compte de test n° 0 qui a déployé le contrat.
- **La transaction échoue** : vérifier les messages de validation, le statut courant du signalement et les confirmations MetaMask.

## Structure du projet

```text
contracts/UrbanIssueRegistry.sol       Contrat intelligent
test/UrbanIssueRegistry.test.js        Tests Hardhat
scripts/deploy.js                      Déploiement local et configuration frontend
frontend/src/                          Application React
urban_issues.xlsx                      Classeur de démonstration
README.md                              Guide du projet
```

## Informations académiques

- Établissement : Faculté des Sciences et Techniques de Tanger, Université Abdelmalek Essaâdi
- Module : M115 — Sécurité et Éthique des Données
- Formation : Master 1 IDIA
- Encadrante : Prof. BENABDELOUAHAB Ikram
- Année universitaire : 2026–2027
- Étudiant : EL HAJIOUI Houssam