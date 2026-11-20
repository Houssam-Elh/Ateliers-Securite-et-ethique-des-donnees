import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { zeroAddress } from "viem";

const cert = (id = "ID-1", name = "Amina Benali") => [
  zeroAddress, name, id, "Licence Informatique", "2026-06-15", "Mention Bien",
];

const batch = (ids, names = ids.map((_, i) => `Etudiant ${i}`)) => [
  ids.map(() => zeroAddress),
  names,
  ids,
  ids.map(() => "Licence Informatique"),
  ids.map(() => "2026-06-15"),
  ids.map(() => "Bien"),
];

describe("CertificateRegistry Tests", async function () {

  async function deployFixture() {
    // Dans Hardhat 3, viem est attaché à la connexion réseau
    const net = await hre.network.connect();
    const [owner, admin, student1, student2, hacker] = await net.viem.getWalletClients();
    const publicClient = await net.viem.getPublicClient();

    // Déployer le contrat CertificateRegistry
    const registry = await net.viem.deployContract("CertificateRegistry", []);

    return { net, registry, owner, admin, student1, student2, hacker, publicClient };
  }

  describe("1. Initialisation et Contrôle d'accès", function () {
    it("Le deployeur doit être défini comme owner et admin", async function () {
      const { registry, owner } = await deployFixture();

      const contractOwner = await registry.read.owner();
      const isOwnerAdmin = await registry.read.isAdmin([owner.account.address]);

      assert.equal(contractOwner.toLowerCase(), owner.account.address.toLowerCase());
      assert.equal(isOwnerAdmin, true);
    });

    it("Le owner peut ajouter un nouvel administrateur", async function () {
      const { registry, admin } = await deployFixture();

      await registry.write.addAdmin([admin.account.address]);
      const isAdmin = await registry.read.isAdmin([admin.account.address]);

      assert.equal(isAdmin, true);
    });

    it("Un compte non-admin ne peut pas ajouter d'administrateur", async function () {
      const { net, registry, hacker, student1 } = await deployFixture();

      const registryAsHacker = await net.viem.getContractAt(
        "CertificateRegistry",
        registry.address,
        { client: { wallet: hacker } }
      );

      await assert.rejects(
        async () => {
          await registryAsHacker.write.addAdmin([student1.account.address]);
        },
        /reserve au proprietaire/
      );
    });
  });

  describe("2. Émission Unitaire (mintCertificate)", function () {
    it("L'administrateur peut émettre un certificat valide", async function () {
      const { registry, student1 } = await deployFixture();

      await registry.write.mintCertificate([
        student1.account.address,
        "Amina Benali",
        "2023-INF-042",
        "Licence Informatique",
        "2026-06-15",
        "Mention Bien"
      ]);

      const total = await registry.read.getTotalCertificates();
      assert.equal(total, 1n);

      const cert = await registry.read.getCertificate([1n]);
      assert.equal(cert.studentName, "Amina Benali");
      assert.equal(cert.studentId, "2023-INF-042");
      assert.equal(cert.diplomaTitle, "Licence Informatique");
      assert.equal(cert.issueDate, "2026-06-15");
      assert.equal(cert.grade, "Mention Bien");
      assert.equal(cert.recipient.toLowerCase(), student1.account.address.toLowerCase());
      assert.equal(cert.revoked, false);
    });

    it("Rejette l'émission si l'émetteur n'est pas autorisé", async function () {
      const { net, registry, hacker, student1 } = await deployFixture();

      const registryAsHacker = await net.viem.getContractAt(
        "CertificateRegistry",
        registry.address,
        { client: { wallet: hacker } }
      );

      await assert.rejects(
        async () => {
          await registryAsHacker.write.mintCertificate([
            student1.account.address,
            "Fake Student",
            "FAKE-001",
            "Doctorat Fictif",
            "2026-06-15",
            "Mention Bien"
          ]);
        },
        /reserve a l'administration/
      );
    });

    it("Rejette les doublons de studentId (Anti-doublon)", async function () {
      const { registry, student1, student2 } = await deployFixture();

      // Première émission réussie
      await registry.write.mintCertificate([
        student1.account.address,
        "Amina Benali",
        "2023-INF-042",
        "Licence Informatique",
        "2026-06-15",
        "Mention Bien"
      ]);

      // Tentative de réémission avec le même studentId
      await assert.rejects(
        async () => {
          await registry.write.mintCertificate([
            student2.account.address,
            "Autre Etudiant",
            "2023-INF-042", // Doublon !
            "Master Informatique",
            "2026-07-01",
            "Mention Tres Bien"
          ]);
        },
        /Un certificat existe deja pour/
      );
    });
  });

  describe("3. Émission Groupée (batchMint - Excel)", function () {
    it("Émet plusieurs certificats en une seule transaction", async function () {
      const { registry, student1, student2 } = await deployFixture();

      const recipients = [student1.account.address, student2.account.address];
      const names = ["Karim El Amrani", "Fatima Zahra Mansouri"];
      const ids = ["2023-INF-043", "2023-INF-044"];
      const diplomas = ["Master IDIA", "Licence Math-Info"];
      const dates = ["2026-07-01", "2026-06-20"];
      const grades = ["Mention Tres Bien", "Mention Assez Bien"];

      await registry.write.batchMint([recipients, names, ids, diplomas, dates, grades]);

      const total = await registry.read.getTotalCertificates();
      assert.equal(total, 2n);

      const cert1 = await registry.read.getCertificate([1n]);
      assert.equal(cert1.studentName, "Karim El Amrani");
      assert.equal(cert1.studentId, "2023-INF-043");

      const cert2 = await registry.read.getCertificate([2n]);
      assert.equal(cert2.studentName, "Fatima Zahra Mansouri");
      assert.equal(cert2.studentId, "2023-INF-044");
    });

    it("Rejette le batch si les tailles de tableaux ne correspondent pas", async function () {
      const { registry, student1 } = await deployFixture();

      await assert.rejects(
        async () => {
          await registry.write.batchMint([
            [student1.account.address],
            ["Etudiant 1", "Etudiant 2"], // 2 noms mais 1 adresse !
            ["ID-1"],
            ["Diplome 1"],
            ["2026-01-01"],
            ["Bien"]
          ]);
        },
        /Taille des tableaux incoherente/
      );
    });
  });

  describe("4. Révocation et Consultation Publique", function () {
    it("Permet à l'admin de révoquer un certificat", async function () {
      const { registry, student1 } = await deployFixture();

      await registry.write.mintCertificate([
        student1.account.address,
        "Amina Benali",
        "2023-INF-042",
        "Licence Informatique",
        "2026-06-15",
        "Mention Bien"
      ]);

      // Révocation
      await registry.write.revoke([1n]);

      const cert = await registry.read.getCertificate([1n]);
      assert.equal(cert.revoked, true);

      const isValid = await registry.read.isCertificateValid([1n]);
      assert.equal(isValid, false);
    });

    it("Permet la recherche par studentId (CNE)", async function () {
      const { registry, student1 } = await deployFixture();

      await registry.write.mintCertificate([
        student1.account.address,
        "Amina Benali",
        "2023-INF-042",
        "Licence Informatique",
        "2026-06-15",
        "Mention Bien"
      ]);

      const [certId, cert] = await registry.read.getCertificateByStudentId(["2023-INF-042"]);
      assert.equal(certId, 1n);
      assert.equal(cert.studentName, "Amina Benali");
    });
  });

  describe("5. Tests complémentaires (events, validations, cas limites)", function () {
    it("emet l'event CertificateMinted avec les bons arguments", async () => {
      const { registry, publicClient } = await deployFixture();
      await registry.write.mintCertificate(cert());
      const events = await publicClient.getContractEvents({
        address: registry.address, abi: registry.abi,
        eventName: "CertificateMinted", fromBlock: 0n,
      });
      assert.equal(events.length, 1);
      assert.equal(events[0].args.certId, 1n);
      assert.equal(events[0].args.studentId, "ID-1");
      assert.equal(events[0].args.studentName, "Amina Benali");
    });

    it("un admin ajoute peut emettre, un admin retire ne peut plus", async () => {
      const { registry, admin } = await deployFixture();
      await registry.write.addAdmin([admin.account.address]);
      await registry.write.mintCertificate(cert("ID-1"), { account: admin.account });
      await registry.write.removeAdmin([admin.account.address]);
      await assert.rejects(
        registry.write.mintCertificate(cert("ID-2"), { account: admin.account }),
        /reserve a l'administration/
      );
    });

    it("rejette les champs obligatoires vides", async () => {
      const { registry } = await deployFixture();
      await assert.rejects(
        registry.write.mintCertificate([zeroAddress, "", "ID-1", "Dip", "2026-06-15", "Bien"]),
        /nom de l'etudiant est requis/
      );
      await assert.rejects(
        registry.write.mintCertificate([zeroAddress, "Nom", "", "Dip", "2026-06-15", "Bien"]),
        /CNE/
      );
      await assert.rejects(
        registry.write.mintCertificate([zeroAddress, "Nom", "ID-1", "", "2026-06-15", "Bien"]),
        /intitule du diplome est requis/
      );
    });

    it("batchMint: refuse un non-admin et un batch vide", async () => {
      const { registry, hacker } = await deployFixture();
      await assert.rejects(
        registry.write.batchMint(batch(["A1"]), { account: hacker.account }),
        /reserve a l'administration/
      );
      await assert.rejects(registry.write.batchMint(batch([])), /Aucun etudiant/);
    });

    it("batchMint: un doublon annule tout le lot (atomicite)", async () => {
      const { registry } = await deployFixture();
      await registry.write.mintCertificate(cert("ID-1"));
      await assert.rejects(registry.write.batchMint(batch(["ID-2", "ID-1"])), /existe deja/);
      assert.equal(await registry.read.getTotalCertificates(), 1n);
    });

    it("batchMint: refuse un doublon a l'interieur du meme lot", async () => {
      const { registry } = await deployFixture();
      await assert.rejects(registry.write.batchMint(batch(["ID-5", "ID-5"])), /existe deja/);
      assert.equal(await registry.read.getTotalCertificates(), 0n);
    });

    it("revoke: refuse un non-admin, un id inexistant et une double revocation", async () => {
      const { registry, hacker } = await deployFixture();
      await registry.write.mintCertificate(cert());
      await assert.rejects(
        registry.write.revoke([1n], { account: hacker.account }),
        /reserve a l'administration/
      );
      await assert.rejects(registry.write.revoke([99n]), /inexistant/);
      await registry.write.revoke([1n]);
      await assert.rejects(registry.write.revoke([1n]), /deja revoque/);
    });

    it("revokeWithReason: revoque et emet CertificateRevoked avec le motif", async () => {
      const { registry, publicClient } = await deployFixture();
      await registry.write.mintCertificate(cert());
      await registry.write.revokeWithReason([1n, "Erreur de saisie"]);
      assert.equal(await registry.read.isCertificateValid([1n]), false);
      const events = await publicClient.getContractEvents({
        address: registry.address, abi: registry.abi,
        eventName: "CertificateRevoked", fromBlock: 0n,
      });
      assert.equal(events.length, 1);
      assert.equal(events[0].args.reason, "Erreur de saisie");
    });

    it("lecture: id inexistant -> getCertificate revert, isCertificateValid false", async () => {
      const { registry } = await deployFixture();
      await assert.rejects(registry.read.getCertificate([99n]), /inexistant/);
      assert.equal(await registry.read.isCertificateValid([99n]), false);
      await assert.rejects(registry.read.getCertificateByStudentId(["NOPE"]), /Aucun certificat/);
    });
  });
});
