# CertiChain Academic — Système de Certification Académique sur Blockchain

> **Devoir 1 : M115 — Sécurité et éthique des données**  
> **Master 1 — Intelligence Décisionnelle & Intelligence Artificielle (M1-IDIA)**  
> **Faculté des Sciences et Techniques de Tanger (FSTT)**  
> **Enseignante :** Pr. Ikram BEN ABDEL OUAHAB  
> **Étudiant :** EL HAJIOUI Houssam  

---

## 🎯 Présentation du Projet

Ce projet implémente une solution décentralisée complète (Smart Contract + Frontend React + Import Excel SheetJS) permettant à une université d'émettre, gérer et vérifier des diplômes et attestations de manière infalsifiable sur la blockchain.

### Fonctionnalités Clés :
- 🔒 **Contrôle d'accès strict :** Seuls le propriétaire ou les administrateurs autorisés peuvent émettre ou révoquer un certificat.
- 🚫 **Protection Anti-Doublon :** Un même identifiant étudiant (CNE) ne peut être émis deux fois.
- 📊 **Import Tableur Excel / CSV :** Analyse directe côté client via **SheetJS** sans fuite de données vers un tiers.
- ⚡ **Émission Groupée Atomique (`batchMint`) :** Émission de plusieurs dizaines d'étudiants en une seule transaction.
- 🔍 **Vérification Publique Gratuite :** Consultation par numéro de diplôme ou par CNE avec statut de validité (Valide / Révoqué).

---

## 🏗️ Architecture du Répertoire

```text
04 - Devoir 1 - Certification Fonctionnelle/
├── contracts/
│   └── CertificateRegistry.sol       # Smart contract Solidity
├── test/
│   └── CertificateRegistry.test.js   # 19 tests unitaires automatisés
├── scripts/
│   ├── deploy.js                     # Script de déploiement Hardhat
│   └── deploy_to_node.js             # Déploiement vers nœud local
├── frontend/                         # Application React + Vite + Wagmi
│   ├── src/
│   │   ├── App.jsx                   # Interface Admin & Public
│   │   ├── wagmi.js                  # Configuration Web3 Wagmi/Viem
│   │   └── config/contractInfo.json  # ABI et adresse du contrat
│   └── package.json
├── etudiants.xlsx                    # Fichier Excel d'exemple (4 étudiants)
├── etudiants.csv                     # Version CSV
├── hardhat.config.js                 # Configuration Hardhat 3
├── package.json
└── Rapport_Devoir_1.md               # Rapport complet avec captures
```

---

## 🚀 Guide d'Installation et d'Exécution

### 1. Prérequis
- [Node.js](https://nodejs.org/) (v18+ ou v20+)
- Portefeuille [MetaMask](https://metamask.io/) installé dans votre navigateur

### 2. Installation des Dépendances
Dans la racine du projet :
```powershell
npm install
cd frontend
npm install
cd ..
```

### 3. Exécution des Tests Automatisés (19/19 Tests)
```powershell
npm test
```

### 4. Démarrage du Nœud Local Hardhat
Dans un premier terminal :
```powershell
npx hardhat node
```

### 5. Déploiement du Smart Contract
Dans un second terminal :
```powershell
node scripts/deploy_to_node.js
```

### 6. Lancement de l'Application Frontend
Dans le dossier `frontend` :
```powershell
cd frontend
npm run dev
```
Ouvrez votre navigateur à l'adresse indiquée : [http://localhost:5173](http://localhost:5173).

---

## 🦊 Configuration de MetaMask (Hardhat Local)

- **Nom du réseau :** `Hardhat Local`
- **URL RPC :** `http://127.0.0.1:8545`
- **ID de chaîne :** `31337`
- **Symbole :** `ETH`
- **Clé privée du compte Admin (Account #0) :**
  ```text
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  ```
