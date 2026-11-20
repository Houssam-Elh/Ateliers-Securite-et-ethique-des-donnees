import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Déploiement de CertificateRegistry sur le réseau local...");

  const net = await hre.network.connect();
  const [deployer] = await net.viem.getWalletClients();
  console.log("Compte déployeur (Owner) :", deployer.account.address);

  const registry = await net.viem.deployContract("CertificateRegistry", []);
  console.log("✅ CertificateRegistry déployé à l'adresse :", registry.address);

  // Mettre à jour contractInfo.json pour le frontend
  const artifactPath = path.resolve("./artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const configPath = path.resolve("./frontend/src/config/contractInfo.json");
  const configData = {
    address: registry.address,
    abi: artifact.abi,
    deployer: deployer.account.address
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  console.log("📄 frontend/src/config/contractInfo.json mis à jour !");
}

main().catch(console.error);
