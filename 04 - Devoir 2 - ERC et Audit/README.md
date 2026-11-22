# Devoir 2 : Standards ERC (ERC-721) & Audit des Smart Contracts

Projet réalisé dans le cadre du module **M115 : Sécurité & Éthique des Données**  
**Master 1 Intelligence Artificielle & Sciences des Données (M1-IDIA)**  
Université Abdelmalek Essaâdi — sous la direction du **Pr. Ikram BEN ABDEL OUAHAB**

---

## 🎯 Objectifs du Projet

1. **Standard ERC-721 (NFT) :**
   - Implémentation du contrat `AcademicCertificateNFT.sol` basé sur **OpenZeppelin Contracts v5** (`ERC721URIStorage` + `AccessControl`).
   - Gestion des métadonnées décentralisées via `tokenURI` (IPFS-ready).

2. **Contrôle d'Accès Granulaire (RBAC) :**
   - `DEFAULT_ADMIN_ROLE` : Administration globale et attribution des rôles.
   - `MINTER_ROLE` : Autorisation exclusive d'émettre des certificats (unitaire ou groupé).
   - `REVOKER_ROLE` : Autorisation exclusive de révoquer un certificat avec motif officiel on-chain.

3. **Sécurité & Protection Anti-Doublon :**
   - Hachage cryptographique du CNE étudiant (`keccak256`) garantissant l'unicité de chaque diplôme.
   - Contrôles stricts sur les entrées : `address(0)` rejetée, chaînes non vides, tableaux synchronisés.

4. **Audit de Sécurité & Suite de Tests :**
   - Batterie de **14 tests automatisés** couvrant les standards ERC-721, le RBAC, les rejets de sécurité et les révocations.
   - Rapport d'audit complet : `Rapport_EL_HAJIOUI_Houssam.docx`.

5. **DApp Frontend :**
   - Application **React + Vite + Wagmi/Viem**.
   - Émission unitaire, import et émission Excel groupée (`batchMintCertificates`), révocation motivée, et vérification publique par Token ID ou CNE.

---

## 📂 Structure du Répertoire

```text
04 - Devoir 2 - ERC et Audit/
├── contracts/
│   └── AcademicCertificateNFT.sol     # Smart contract ERC-721 + AccessControl
├── test/
│   └── AcademicCertificateNFT.test.js # Suite de 14 tests automatisés
├── scripts/
│   ├── deploy.js                      # Déploiement Hardhat standard
│   └── deploy_to_node.js              # Déploiement vers nœud local (port 8545)
├── frontend/                          # DApp React + Vite + Wagmi
│   ├── src/
│   │   ├── App.jsx                    # Interface : onglets Admin, Révocation, Public
│   │   └── config/contractInfo.json   # Adresse et ABI synchronisées post-déploiement
│   └── package.json
├── etudiants.csv                      # Données de test (émission groupée)
├── etudiants.xlsx                     # Données de test (import Excel frontend)
├── Rapport_EL_HAJIOUI_Houssam.pdf     # Version PDF du rapport
├── hardhat.config.js                  # Configuration Hardhat (Solidity 0.8.24, Cancun)
└── package.json
```

---

## 🚀 Guide d'Installation et d'Exécution

### 1. Prérequis
- **Node.js** v18+ ou v20+
- Extension navigateur **MetaMask**

### 2. Installation des dépendances
```bash
npm install
```

### 3. Compilation du Smart Contract
```bash
npx hardhat compile
```

### 4. Exécution de la Suite de Tests
```bash
node --test test/AcademicCertificateNFT.test.js
```
> Résultat attendu : **14 tests réussis**.

### 5. Déploiement Local

**Terminal 1 — démarrer le nœud Hardhat :**
```bash
npx hardhat node
```

**Terminal 2 — déployer le contrat :**
```bash
node scripts/deploy_to_node.js
```

### 6. Lancement de l'Application Frontend
```bash
cd frontend
npm install
npm run dev
```
> L'application est accessible sur `http://localhost:5173`.

---

## 🔒 Résumé de l'Audit de Sécurité

| Critère Audité | Statut | Synthèse |
| :--- | :---: | :--- |
| **Access Control (RBAC)** | ✅ Conforme | Rôles `MINTER_ROLE` et `REVOKER_ROLE` hermétiques via OpenZeppelin. |
| **Reentrancy** | ✅ Conforme | Aucun transfert d'Ether, respect strict du pattern Checks-Effects-Interactions. |
| **Anti-Duplicate** | ✅ Conforme | Enregistrement `keccak256(studentId)` inviolable. |
| **Input Validation** | ✅ Conforme | `address(0)` rejetée, chaînes obligatoires, tableaux synchronisés. |
| **Arithmetic Safety** | ✅ Conforme | Solidity 0.8.24 avec vérifications overflow/underflow natives. |

Pour l'analyse détaillée, consultez `Rapport_EL_HAJIOUI_Houssam.docx`.

---

## 👤 Auteur

**EL HAJIOUI Houssam** — M1-IDIA  
Module M115 : Sécurité & Éthique des Données
