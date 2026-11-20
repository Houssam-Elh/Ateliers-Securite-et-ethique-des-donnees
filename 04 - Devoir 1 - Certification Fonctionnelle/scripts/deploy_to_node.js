import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Déploiement de CertificateRegistry sur le node http://127.0.0.1:8545...");

  const net = await hre.network.connect("localhost");
  const [deployer] = await net.viem.getWalletClients();
  console.log("Compte déployeur :", deployer.account.address);

  const registry = await net.viem.deployContract("CertificateRegistry", []);
  console.log("✅ Contrat déployé à l'adresse :", registry.address);

  // Mettre à jour contractInfo.json pour le frontend
  const artifactPath = path.resolve("./artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const configPath = path.resolve("./frontend/src/config/contractInfo.json");
  const configData = {
    address: registry.address,
    abi: artifact.abi,
    deployer: deployer.account.address,
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  console.log("📄 frontend/src/config/contractInfo.json synchronisé avec l'adresse :", registry.address);
}

main().catch(console.error);
