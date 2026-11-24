const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UrbanIssueRegistry", function () {
  let registry;
  let owner, citizen, techTeam, hacker;

  beforeEach(async function () {
    [owner, citizen, techTeam, hacker] = await ethers.getSigners();
    const UrbanIssueRegistry = await ethers.getContractFactory("UrbanIssueRegistry");
    registry = await UrbanIssueRegistry.deploy();
    await registry.waitForDeployment();
  });

  describe("Issue Creation & Consultation", function () {
    it("should create a new urban issue successfully and emit IssueCreated event", async function () {
      const issueId = "CITY-2026-001";
      const tx = await registry.connect(citizen).createIssue(
        issueId,
        "StreetLight",
        "Avenue Mohammed V",
        "Streetlight not working",
        "2026-11-19",
        2, // Priority.High
        "Citizen01",
        ""
      );

      await expect(tx)
        .to.emit(registry, "IssueCreated")
        .withArgs(
          issueId,
          "StreetLight",
          "Avenue Mohammed V",
          2,
          "Citizen01",
          citizen.address,
          (timestamp) => typeof timestamp === "bigint" && timestamp > 0n
        );

      const issue = await registry.getIssue(issueId);
      expect(issue.issueId).to.equal(issueId);
      expect(issue.issueType).to.equal("StreetLight");
      expect(issue.status).to.equal(0); // Reported
      expect(issue.priority).to.equal(2); // High
      expect(issue.reporterAddress).to.equal(citizen.address);

      const count = await registry.getIssueCount();
      expect(count).to.equal(1n);

      const allIds = await registry.getAllIssueIds();
      expect(allIds).to.deep.equal([issueId]);
    });

    it("should start as Assigned when a team is given at creation", async function () {
      await registry.connect(citizen).createIssue(
        "CITY-2026-PRE",
        "Water",
        "Rue Hassan II",
        "Leak",
        "2026-11-20",
        1,
        "Citizen09",
        "UrbanTeam05"
      );
      const issue = await registry.getIssue("CITY-2026-PRE");
      expect(issue.status).to.equal(1); // Assigned
    });

    it("should prevent duplicate issue IDs", async function () {
      await registry.createIssue(
        "CITY-001",
        "RoadPothole",
        "Main St",
        "Big pothole",
        "2026-11-20",
        1,
        "Citizen",
        ""
      );

      await expect(
        registry.createIssue(
          "CITY-001",
          "RoadPothole",
          "Main St",
          "Another one",
          "2026-11-20",
          1,
          "Citizen",
          ""
        )
      ).to.be.revertedWith("Issue ID already exists");
    });

    it("should revert if querying a non-existent issue", async function () {
      await expect(
        registry.getIssue("NON-EXISTENT-ID")
      ).to.be.revertedWith("Issue does not exist");

      await expect(
        registry.getIssueHistory("NON-EXISTENT-ID")
      ).to.be.revertedWith("Issue does not exist");
    });
  });

  describe("Access Control & Security (onlyAdmin)", function () {
    const issueId = "CITY-SEC-01";

    beforeEach(async function () {
      await registry.connect(citizen).createIssue(
        issueId,
        "Waste",
        "Place de France",
        "Illegal trash dumping",
        "2026-11-21",
        1,
        "CitizenEco",
        ""
      );
    });

    it("should REJECT non-admin attempting to assign an issue", async function () {
      await expect(
        registry.connect(hacker).assignIssue(issueId, "RogueTeam")
      ).to.be.revertedWith("Only municipality admin can perform this action");
    });

    it("should REJECT non-admin attempting to update issue status", async function () {
      // First assign properly via owner
      await registry.connect(owner).assignIssue(issueId, "UrbanTeam01");

      await expect(
        registry.connect(hacker).updateStatus(issueId, 2, "Hacked closure")
      ).to.be.revertedWith("Only municipality admin can perform this action");
    });

    it("should ALLOW municipality admin to assign team and update status", async function () {
      await expect(
        registry.connect(owner).assignIssue(issueId, "UrbanTeam01")
      ).to.emit(registry, "IssueAssigned");

      const issue = await registry.getIssue(issueId);
      expect(issue.assignedTo).to.equal("UrbanTeam01");
      expect(issue.status).to.equal(1); // Assigned
    });
  });

  describe("Workflow Lifecycle & Traceability", function () {
    const issueId = "CITY-2026-WF";

    beforeEach(async function () {
      await registry.connect(citizen).createIssue(
        issueId,
        "TrafficSignal",
        "Boulevard Zerktouni",
        "Traffic lights blinking red",
        "2026-11-20",
        2,
        "Citizen03",
        ""
      );
    });

    it("should enforce sequential status transition (no arbitrary skips)", async function () {
      // Current status: Reported (0)
      // Attempting to jump directly to InProgress (2) or Closed (4) without Assigned (1)
      await expect(
        registry.connect(owner).updateStatus(issueId, 2, "Skipping assigned")
      ).to.be.revertedWith("Invalid status transition: must follow sequential lifecycle");

      await expect(
        registry.connect(owner).updateStatus(issueId, 4, "Immediate closure")
      ).to.be.revertedWith("Invalid status transition: must follow sequential lifecycle");
    });

    it("should transition smoothly through full lifecycle and maintain complete history", async function () {
      // 1. Assign (Reported -> Assigned)
      await registry.connect(owner).assignIssue(issueId, "UrbanTeam02");
      let issue = await registry.getIssue(issueId);
      expect(issue.status).to.equal(1); // Assigned

      // 2. InProgress (1 -> 2)
      await registry.connect(owner).updateStatus(issueId, 2, "Team dispatched to the scene");
      issue = await registry.getIssue(issueId);
      expect(issue.status).to.equal(2);

      // 3. Resolved (2 -> 3)
      await registry.connect(owner).updateStatus(issueId, 3, "Traffic light repaired and verified");
      issue = await registry.getIssue(issueId);
      expect(issue.status).to.equal(3);

      // 4. Closed (3 -> 4)
      await registry.connect(owner).updateStatus(issueId, 4, "Case reviewed and closed");
      issue = await registry.getIssue(issueId);
      expect(issue.status).to.equal(4);

      // Check full audit trail
      const history = await registry.getIssueHistory(issueId);
      expect(history.length).to.equal(5); // Creation + Assign + 3 status updates
      expect(history[0].comment).to.equal("Issue reported by citizen");
      expect(history[0].updater).to.equal(citizen.address);
      expect(history[1].comment).to.equal("Assigned to team: UrbanTeam02");
      expect(history[1].updater).to.equal(owner.address);
      expect(history[2].comment).to.equal("Team dispatched to the scene");
      expect(history[2].status).to.equal(2);
      expect(history[3].comment).to.equal("Traffic light repaired and verified");
      expect(history[3].status).to.equal(3);
      expect(history[4].comment).to.equal("Case reviewed and closed");
      expect(history[4].status).to.equal(4);
    });

    it("should emit StatusUpdated and reject assigning a closed issue", async function () {
      await registry.connect(owner).assignIssue(issueId, "UrbanTeam01");

      await expect(registry.connect(owner).updateStatus(issueId, 2, "On site"))
        .to.emit(registry, "StatusUpdated");

      await registry.connect(owner).updateStatus(issueId, 3, "Fixed");
      await registry.connect(owner).updateStatus(issueId, 4, "Closed");

      await expect(registry.connect(owner).assignIssue(issueId, "LateTeam"))
        .to.be.revertedWith("Issue is already closed");
    });
  });

  after(function () {
    // Permet une fermeture propre sous Node.js v26 (évite le warning libuv uv_async)
    setTimeout(() => process.exit(0), 100);
  });
});
