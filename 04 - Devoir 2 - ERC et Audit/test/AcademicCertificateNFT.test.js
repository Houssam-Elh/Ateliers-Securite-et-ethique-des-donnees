import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";

describe("AcademicCertificateNFT (ERC-721 + AccessControl) — Suite de Tests", async () => {
  async function deployFixture() {
    const net = await hre.network.connect();
    const [admin, minter, revoker, student1, student2, hacker] =
      await net.viem.getWalletClients();

    const nft = await net.viem.deployContract("AcademicCertificateNFT", [
      "CertiChain Academic NFT",
      "CERT-NFT",
    ]);

    const MINTER_ROLE = await nft.read.MINTER_ROLE();
    const REVOKER_ROLE = await nft.read.REVOKER_ROLE();
    const DEFAULT_ADMIN_ROLE = await nft.read.DEFAULT_ADMIN_ROLE();

    // Accorder les rôles au minter et au revoker pour tester le contrôle d'accès
    await nft.write.grantRole([MINTER_ROLE, minter.account.address]);
    await nft.write.grantRole([REVOKER_ROLE, revoker.account.address]);

    return {
      nft,
      admin,
      minter,
      revoker,
      student1,
      student2,
      hacker,
      MINTER_ROLE,
      REVOKER_ROLE,
      DEFAULT_ADMIN_ROLE,
      net,
    };
  }

  describe("1. Initialisation & Standards ERC-721 / AccessControl", () => {
    it("Possède le bon nom et symbole de NFT", async () => {
      const { nft } = await deployFixture();
      assert.equal(await nft.read.name(), "CertiChain Academic NFT");
      assert.equal(await nft.read.symbol(), "CERT-NFT");
    });

    it("Le déployeur a le rôle DEFAULT_ADMIN_ROLE et MINTER_ROLE", async () => {
      const { nft, admin, DEFAULT_ADMIN_ROLE, MINTER_ROLE } = await deployFixture();
      assert.equal(await nft.read.hasRole([DEFAULT_ADMIN_ROLE, admin.account.address]), true);
      assert.equal(await nft.read.hasRole([MINTER_ROLE, admin.account.address]), true);
    });

    it("Prend en charge les interfaces ERC-721 et AccessControl (ERC-165)", async () => {
      const { nft } = await deployFixture();
      // ERC721 interfaceId = 0x80ac58cd
      assert.equal(await nft.read.supportsInterface(["0x80ac58cd"]), true);
      // AccessControl interfaceId = 0x7965db0b
      assert.equal(await nft.read.supportsInterface(["0x7965db0b"]), true);
    });
  });

  describe("2. Émission Unitaire (mintCertificate)", () => {
    it("Un compte avec MINTER_ROLE peut émettre un certificat NFT", async () => {
      const { nft, minter, student1, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );

      await nftAsMinter.write.mintCertificate([
        student1.account.address,
        "Amina Benali",
        "2023-INF-042",
        "Licence Informatique",
        "2026-06-15",
        "Mention Bien",
        "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/1.json",
      ]);

      assert.equal(await nft.read.getTotalCertificates(), 1n);
      assert.equal(
        (await nft.read.ownerOf([1n])).toLowerCase(),
        student1.account.address.toLowerCase()
      );
      assert.equal(
        await nft.read.tokenURI([1n]),
        "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/1.json"
      );

      const cert = await nft.read.getCertificate([1n]);
      assert.equal(cert.studentName, "Amina Benali");
      assert.equal(cert.studentId, "2023-INF-042");
      assert.equal(cert.revoked, false);
    });

    it("Rejette l'émission si l'appelant n'a pas MINTER_ROLE", async () => {
      const { nft, hacker, student1, net } = await deployFixture();
      const nftAsHacker = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: hacker } }
      );

      await assert.rejects(async () => {
        await nftAsHacker.write.mintCertificate([
          student1.account.address,
          "Pirate",
          "HACK-001",
          "Diplôme Falsifié",
          "2026-01-01",
          "Fraude",
          "ipfs://fake/uri",
        ]);
      });
    });

    it("Rejette une adresse destinataire nulle (address(0))", async () => {
      const { nft, minter, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );

      await assert.rejects(async () => {
        await nftAsMinter.write.mintCertificate([
          "0x0000000000000000000000000000000000000000",
          "Student Zero",
          "ZERO-001",
          "Test",
          "2026-01-01",
          "Passable",
          "ipfs://test",
        ]);
      });
    });

    it("Rejette un nom, CNE ou diplôme vide", async () => {
      const { nft, minter, student1, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );

      // Nom vide
      await assert.rejects(async () => {
        await nftAsMinter.write.mintCertificate([
          student1.account.address,
          "",
          "CNE-001",
          "Diplôme",
          "2026-01-01",
          "Bien",
          "ipfs://test",
        ]);
      });

      // CNE vide
      await assert.rejects(async () => {
        await nftAsMinter.write.mintCertificate([
          student1.account.address,
          "Nom",
          "",
          "Diplôme",
          "2026-01-01",
          "Bien",
          "ipfs://test",
        ]);
      });
    });
  });

  describe("3. Sécurité Anti-Doublon (Unicité du CNE)", () => {
    it("Empêche strictement de minter deux fois le même studentId", async () => {
      const { nft, minter, student1, student2, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );

      // Première émission réussie
      await nftAsMinter.write.mintCertificate([
        student1.account.address,
        "Karim El Amrani",
        "2026-IDIA-001",
        "Master IDIA",
        "2026-11-20",
        "Très Bien",
        "ipfs://cert/1",
      ]);

      // Deuxième émission avec le MÊME CNE (vers un autre wallet) -> Doit REVERTER
      await assert.rejects(async () => {
        await nftAsMinter.write.mintCertificate([
          student2.account.address,
          "Autre Nom",
          "2026-IDIA-001", // MÊME CNE
          "Autre Diplôme",
          "2026-11-20",
          "Bien",
          "ipfs://cert/2",
        ]);
      });
    });
  });

  describe("4. Émission Groupée Atomique (batchMintCertificates)", () => {
    it("Émet un lot complet en une seule transaction", async () => {
      const { nft, minter, student1, student2, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );

      const recipients = [student1.account.address, student2.account.address];
      const names = ["Youssef Berrada", "Fatima Mansouri"];
      const ids = ["2026-IDIA-002", "2026-IDIA-003"];
      const diplomas = ["Master IDIA", "Master IDIA"];
      const dates = ["2026-11-20", "2026-11-20"];
      const grades = ["Bien", "Très Bien"];
      const uris = ["ipfs://batch/1", "ipfs://batch/2"];

      await nftAsMinter.write.batchMintCertificates([
        recipients,
        names,
        ids,
        diplomas,
        dates,
        grades,
        uris,
      ]);

      assert.equal(await nft.read.getTotalCertificates(), 2n);
      assert.equal(
        (await nft.read.ownerOf([1n])).toLowerCase(),
        student1.account.address.toLowerCase()
      );
      assert.equal(
        (await nft.read.ownerOf([2n])).toLowerCase(),
        student2.account.address.toLowerCase()
      );
    });

    it("Rejette le batch si les tailles des tableaux sont asymétriques", async () => {
      const { nft, minter, student1, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );

      await assert.rejects(async () => {
        await nftAsMinter.write.batchMintCertificates([
          [student1.account.address],
          ["Nom 1", "Nom 2"], // Incohérence de taille
          ["ID-1"],
          ["Diplôme"],
          ["Date"],
          ["Grade"],
          ["URI"],
        ]);
      });
    });
  });

  describe("5. Révocation de Certificat (REVOKER_ROLE)", () => {
    it("Un compte avec REVOKER_ROLE peut révoquer avec motif officiel", async () => {
      const { nft, minter, revoker, student1, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );
      const nftAsRevoker = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: revoker } }
      );

      await nftAsMinter.write.mintCertificate([
        student1.account.address,
        "Test Student",
        "REVOKE-01",
        "Licence",
        "2026-01-01",
        "Passable",
        "ipfs://test",
      ]);

      assert.equal(await nft.read.isCertificateValid([1n]), true);

      // Révocation officielle
      await nftAsRevoker.write.revokeCertificate([1n, "Fraude sur notes académiques"]);

      assert.equal(await nft.read.isCertificateValid([1n]), false);
      const cert = await nft.read.getCertificate([1n]);
      assert.equal(cert.revoked, true);
      assert.equal(cert.revocationReason, "Fraude sur notes académiques");
    });

    it("Rejette la révocation si l'appelant n'a pas REVOKER_ROLE", async () => {
      const { nft, minter, hacker, student1, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );
      const nftAsHacker = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: hacker } }
      );

      await nftAsMinter.write.mintCertificate([
        student1.account.address,
        "Test Student",
        "REVOKE-02",
        "Licence",
        "2026-01-01",
        "Passable",
        "ipfs://test",
      ]);

      await assert.rejects(async () => {
        await nftAsHacker.write.revokeCertificate([1n, "Attaque pirate"]);
      });
    });

    it("Rejette la révocation d'un certificat déjà révoqué ou inexistant", async () => {
      const { nft, minter, revoker, student1, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );
      const nftAsRevoker = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: revoker } }
      );

      // Inexistant
      await assert.rejects(async () => {
        await nftAsRevoker.write.revokeCertificate([999n, "Inexistant"]);
      });

      // Émission puis double révocation
      await nftAsMinter.write.mintCertificate([
        student1.account.address,
        "Student",
        "REVOKE-03",
        "Master",
        "2026-01-01",
        "Bien",
        "ipfs://test",
      ]);

      await nftAsRevoker.write.revokeCertificate([1n, "Motif 1"]);
      await assert.rejects(async () => {
        await nftAsRevoker.write.revokeCertificate([1n, "Déjà révoqué"]);
      });
    });
  });

  describe("6. Consultation Publique et Indexation (View)", () => {
    it("Permet la recherche par CNE via getCertificateByStudentId", async () => {
      const { nft, minter, student1, net } = await deployFixture();
      const nftAsMinter = await net.viem.getContractAt(
        "AcademicCertificateNFT",
        nft.address,
        { client: { wallet: minter } }
      );

      await nftAsMinter.write.mintCertificate([
        student1.account.address,
        "Houssam El Hajioui",
        "2026-IDIA-007",
        "Master IDIA",
        "2026-11-20",
        "Très Bien",
        "ipfs://cert/007",
      ]);

      const [tokenId, cert] = await nft.read.getCertificateByStudentId(["2026-IDIA-007"]);
      assert.equal(tokenId, 1n);
      assert.equal(cert.studentName, "Houssam El Hajioui");
      assert.equal(cert.diplomaTitle, "Master IDIA");
    });
  });
});
