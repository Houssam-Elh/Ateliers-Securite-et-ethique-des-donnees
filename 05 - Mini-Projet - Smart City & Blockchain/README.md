# Mini-Projet : Smart City & Blockchain
## Plateforme Décentralisée de Gestion des Services Urbains

[![Solidity](https://img.shields.io/badge/Solidity-^0.8.28-blue.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22-yellow.svg)](https://hardhat.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev/)
[![Ethers](https://img.shields.io/badge/Ethers.js-v6-purple.svg)](https://docs.ethers.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

### 🎓 Informations Académiques
- **Établissement :** Faculté des Sciences et Techniques de Tanger (FSTT) — Université Abdelmalek Essaâdi (UAE)
- **Module :** M115 — Sécurité et Éthique des Données (Master 1 IDIA)
- **Encadrante :** Mme. Ikram Benabdelouahab
- **Année Universitaire :** 2026 – 2027

---

## 📋 Présentation du Projet

**UrbanIssueRegistry** est une application décentralisée (DApp) permettant la gestion transparente, collaborative et auditable du cycle de vie des incidents dans l'espace public (éclairage en panne, voirie et nids-de-poule, fuites d'eau, déchets, signalisation).

Grâce à un Smart Contract développé en **Solidity (`UrbanIssueRegistry.sol`)**, chaque étape du traitement (déclaration citoyenne, affectation d'équipe municipale, intervention terrain, résolution et clôture) est enregistrée sur la blockchain Ethereum avec horodatage immuable et traçabilité de l'opérateur (`msg.sender`).

---

## 🌟 Fonctionnalités Clés

1. **Signalement Citoyen Direct :**
   - Enregistrement immédiat sur la blockchain d'un dysfonctionnement avec localisation précise, catégorie et priorité (`Low`, `Medium`, `High`).
   - Identifiant unique généré et contrôlé pour interdire les doublons.

2. **Traçabilité Immuable (Audit Trail) :**
   - Historique complet pour chaque incident, retraçant toutes les actions, commentaires d'intervention, équipes mobilisées, horodatages et adresses Ethereum associées.

3. **Espace de Gestion Municipale :**
   - Réservé aux comptes accrédités (`municipalityAdmin`).
   - Affectation d'équipes techniques et transition des statuts conformément au workflow :
     ```text
     [Reported] ──▶ [Assigned] ──▶ [InProgress] ──▶ [Resolved] ──▶ [Closed]
     ```

4. **Importation Massive Excel (SheetJS) :**
   - Module client de chargement du fichier standard `urban_issues.xlsx` ou CSV.
   - Contrôle d'intégrité et validation préalable des colonnes requises avec sélection unitaire ou groupée avant enregistrement on-chain.

---

## 📁 Structure du Répertoire

```text
05 - Mini-Projet - Smart City & Blockchain/
├── contracts/
│   └── UrbanIssueRegistry.sol      # Smart contract de registre urbain et traçabilité
├── test/
│   └── UrbanIssueRegistry.test.js  # Tests unitaires automatisés Hardhat
├── scripts/
│   └── deploy.js                   # Script de déploiement et configuration frontend
├── frontend/                       # DApp React + Vite + Ethers v6
│   ├── src/
│   │   ├── App.jsx                 # Dashboard principal & KPI overview
│   │   ├── Issues.jsx              # Registre public, recherche et audit trail
│   │   ├── Manage.jsx              # Espace municipal d'affectation et suivi
│   │   ├── Report.jsx              # Formulaire de signalement citoyen
│   │   ├── Import.jsx              # Module d'importation Excel / CSV SheetJS
│   │   ├── ui.jsx                  # Composants visuels, Stepper et Timeline
│   │   ├── icons.jsx               # Collection d'icônes SVG
│   │   └── config.js               # ABI, adresses et helpers de formatage
│   ├── package.json
│   └── vite.config.js
├── hardhat.config.js               # Configuration du framework Hardhat
├── urban_issues.xlsx               # Fichier modèle d'importation Excel
└── README.md                       # Documentation officielle
```

---

## 🚀 Guide d'Installation & Démarrage

### Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure)
- Extension de portefeuille [MetaMask](https://metamask.io/)

### 1. Démarrer le Nœud Blockchain Local (Terminal 1)
```bash
npm run node
```
*Le simulateur Ethereum démarre sur `http://127.0.0.1:8545` (Chain ID : `31337`).*

### 2. Déployer le Smart Contract (Terminal 2)
```bash
node ./node_modules/hardhat/internal/cli/cli.js run scripts/deploy.js --network localhost
```
*Le script déploie `UrbanIssueRegistry` et met à jour automatiquement `frontend/.env.local`.*

### 3. Lancer la DApp Frontend (Terminal 3)
```bash
cd frontend
npm run dev
```
Ouvrez votre navigateur sur **`http://localhost:5173`**.

---

## 🧪 Tests Unitaires Automatisés

Pour exécuter la suite de tests unitaires du Smart Contract (10 tests vérifiant création, contrôle d'accès `onlyAdmin`, intégrité du workflow séquentiel, événements et traçabilité) :
```bash
npm test
```
*Résultat attendu : `10 passing`.*

---

## 📍 Contrat Déployé
- **Adresse locale du Smart Contract :** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Réseau :** Hardhat Localhost (`http://127.0.0.1:8545`)
- **Chain ID :** `31337`

---

## 🦊 Configuration MetaMask
- **Nom du réseau :** `Hardhat Localhost`
- **RPC URL :** `http://127.0.0.1:8545`
- **Chain ID :** `31337`
- **Devise :** `ETH`
- **Compte Administrateur Municipal :**
  - Utiliser le **Compte #0** généré par votre nœud Hardhat local.
  - Adresse publique correspondante : `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
