import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Déploiement de CertificateRegistry...");

  const net = await hre.network.connect();
  const [deployer] = await net.viem.getWalletClients();
  console.log("Compte déployeur :", deployer.account.address);

  const registry = await net.viem.deployContract("CertificateRegistry", []);
  console.log("✅ CertificateRegistry déployé avec succès à l'adresse :", registry.address);

  // Sauvegarder l'adresse et l'ABI directement dans le dossier frontend
  const artifactPath = path.resolve("./artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const frontendConfigDir = path.resolve("./frontend/src/config");
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }

  const contractInfo = {
    address: registry.address,
    abi: artifact.abi,
    network: net.networkName,
  };

  fs.writeFileSync(
    path.join(frontendConfigDir, "contractInfo.json"),
    JSON.stringify(contractInfo, null, 2)
  );

  console.log("📄 Configuration du contrat copiée dans frontend/src/config/contractInfo.json");
}

main().catch((error) => {
  console.error("Erreur de déploiement :", error);
  process.exitCode = 1;
});
