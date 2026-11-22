import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Déploiement de AcademicCertificateNFT...");

  const net = await hre.network.connect();
  const [deployer] = await net.viem.getWalletClients();
  console.log("Compte déployeur :", deployer.account.address);

  const nft = await net.viem.deployContract("AcademicCertificateNFT", [
    "CertiChain Academic NFT",
    "CERT-NFT"
  ]);
  console.log("✅ AcademicCertificateNFT déployé avec succès à l'adresse :", nft.address);

  // Sauvegarder l'adresse et l'ABI directement dans le dossier frontend
  const artifactPath = path.resolve("./artifacts/contracts/AcademicCertificateNFT.sol/AcademicCertificateNFT.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const frontendConfigDir = path.resolve("./frontend/src/config");
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }

  const contractInfo = {
    address: nft.address,
    abi: artifact.abi,
    network: net.networkName,
    deployer: deployer.account.address,
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
