import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Déploiement de AcademicCertificateNFT sur le node http://127.0.0.1:8545...");

  const net = await hre.network.connect("localhost");
  const [deployer] = await net.viem.getWalletClients();
  console.log("Compte déployeur :", deployer.account.address);

  const nft = await net.viem.deployContract("AcademicCertificateNFT", [
    "CertiChain Academic NFT",
    "CERT-NFT"
  ]);
  console.log("✅ Contrat AcademicCertificateNFT déployé à l'adresse :", nft.address);

  // Mettre à jour contractInfo.json pour le frontend
  const artifactPath = path.resolve("./artifacts/contracts/AcademicCertificateNFT.sol/AcademicCertificateNFT.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const configPath = path.resolve("./frontend/src/config/contractInfo.json");
  const configData = {
    address: nft.address,
    abi: artifact.abi,
    deployer: deployer.account.address,
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  console.log("📄 frontend/src/config/contractInfo.json synchronisé avec l'adresse :", nft.address);
}

main().catch(console.error);
