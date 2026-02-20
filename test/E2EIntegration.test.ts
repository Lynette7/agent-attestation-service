/**
 * AAS Day 4 — End-to-End Integration Test
 *
 * Runs the entire AAS flow on a local Hardhat network:
 *   1. Deploy contracts (AASRegistry + AASZKVerifier)
 *   2. Set schema UIDs
 *   3. Register an agent
 *   4. Fetch performance data from mock API (Confidential HTTP sim)
 *   5. Check tier eligibility
 *   6. Generate ZK proof (mock in dev mode)
 *   7. Create STANDARD attestation on-chain
 *   8. Create VERIFIED attestation on-chain
 *   9. Verify attestations with tier filtering
 *   10. Revoke an attestation
 *   11. Verify revocation is reflected
 *
 * Run: npx hardhat test test/E2EIntegration.test.ts
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Day 4 — End-to-End Integration", function () {
  this.timeout(120_000);

  // Contracts
  let registry: any;
  let zkVerifier: any;
  let eas: any;
  let schemaRegistry: any;

  // Signers
  let deployer: HardhatEthersSigner;
  let agentWallet: HardhatEthersSigner;
  let otherWallet: HardhatEthersSigner;

  // Agent identity
  let agentId: string;

  // Schema UIDs (mocked — we use a minimal EAS mock)
  const MOCK_STANDARD_SCHEMA = ethers.keccak256(ethers.toUtf8Bytes("standard"));
  const MOCK_VERIFIED_SCHEMA = ethers.keccak256(ethers.toUtf8Bytes("verified"));
  const MOCK_ENDORSEMENT_SCHEMA = ethers.keccak256(ethers.toUtf8Bytes("endorsement"));
  const MOCK_TASK_SCHEMA = ethers.keccak256(ethers.toUtf8Bytes("task"));

  // Tier constants
  const TIER_STANDARD = 1;
  const TIER_VERIFIED = 2;

  before(async function () {
    [deployer, agentWallet, otherWallet] = await ethers.getSigners();
    agentId = ethers.keccak256(
      ethers.solidityPacked(["address"], [agentWallet.address])
    );

    console.log("\n  ═══════════════════════════════════════════");
    console.log("  Day 4 — End-to-End Integration Test");
    console.log("  ═══════════════════════════════════════════");
    console.log(`  Deployer:     ${deployer.address}`);
    console.log(`  Agent wallet: ${agentWallet.address}`);
    console.log(`  Agent ID:     ${agentId.slice(0, 18)}...`);
  });

  // ─── Phase 1: Deploy & Configure ────────────────────────────────

  describe("Phase 1: Deploy & Configure", () => {
    it("should deploy AASZKVerifier", async () => {
      const AASZKVerifier = await ethers.getContractFactory("AASZKVerifier");
      zkVerifier = await AASZKVerifier.deploy();
      await zkVerifier.waitForDeployment();
      expect(await zkVerifier.getAddress()).to.be.properAddress;
      console.log(`    AASZKVerifier: ${await zkVerifier.getAddress()}`);
    });

    it("should deploy AASRegistry with EAS mock", async () => {
      // Deploy a minimal EAS mock for local testing
      const EASMock = await ethers.getContractFactory("EASMock");
      eas = await EASMock.deploy();
      await eas.waitForDeployment();

      // Deploy a minimal SchemaRegistry mock
      const SchemaRegistryMock = await ethers.getContractFactory("SchemaRegistryMock");
      schemaRegistry = await SchemaRegistryMock.deploy();
      await schemaRegistry.waitForDeployment();

      // Deploy AASRegistry
      const AASRegistry = await ethers.getContractFactory("AASRegistry");
      registry = await AASRegistry.deploy(
        await eas.getAddress(),
        await schemaRegistry.getAddress(),
        await zkVerifier.getAddress(),
        deployer.address // CRE orchestrator = deployer for test
      );
      await registry.waitForDeployment();
      expect(await registry.getAddress()).to.be.properAddress;
      console.log(`    AASRegistry:  ${await registry.getAddress()}`);
    });

    it("should set schema UIDs", async () => {
      await registry.setSchemaUIDs(
        MOCK_STANDARD_SCHEMA,
        MOCK_VERIFIED_SCHEMA,
        MOCK_ENDORSEMENT_SCHEMA,
        MOCK_TASK_SCHEMA
      );

      expect(await registry.standardTierSchemaUID()).to.equal(MOCK_STANDARD_SCHEMA);
      expect(await registry.verifiedTierSchemaUID()).to.equal(MOCK_VERIFIED_SCHEMA);
      console.log(`    Schema UIDs set ✓`);
    });
  });

  // ─── Phase 2: Agent Registration ────────────────────────────────

  describe("Phase 2: Agent Registration", () => {
    it("should register agent from their wallet", async () => {
      const tx = await registry.connect(agentWallet).registerAgent(agentId);
      await tx.wait();

      expect(await registry.isRegisteredAgent(agentId)).to.be.true;
      expect(await registry.agentWallet(agentId)).to.equal(agentWallet.address);
      console.log(`    Agent registered ✓`);
    });

    it("should reject duplicate registration", async () => {
      await expect(
        registry.connect(agentWallet).registerAgent(agentId)
      ).to.be.revertedWithCustomError(registry, "AgentAlreadyRegistered");
    });

    it("should reject registration from wrong wallet", async () => {
      const wrongAgentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [otherWallet.address])
      );
      await expect(
        registry.connect(agentWallet).registerAgent(wrongAgentId)
      ).to.be.reverted;
    });
  });

  // ─── Phase 3: Performance Data & Eligibility ───────────────────

  describe("Phase 3: Performance Fetch & Eligibility", () => {
    // Simulated performance data (in production, fetched via CRE Confidential HTTP)
    const perfData = {
      taskCount: 150,
      successCount: 143,
      failureCount: 7,
      avgResponseTimeMs: 1200,
      lastTaskTimestamp: Math.floor(Date.now() / 1000),
    };

    it("should check STANDARD tier eligibility (PASS)", () => {
      const rateBps = Math.floor(
        (perfData.successCount / perfData.taskCount) * 10000
      );
      expect(perfData.taskCount).to.be.gte(10);
      expect(rateBps).to.be.gte(7000);
      console.log(
        `    STANDARD: tasks=${perfData.taskCount}>=10 ✓, rate=${rateBps}>=7000 ✓`
      );
    });

    it("should check VERIFIED tier eligibility (PASS)", () => {
      const rateBps = Math.floor(
        (perfData.successCount / perfData.taskCount) * 10000
      );
      expect(perfData.taskCount).to.be.gte(100);
      expect(rateBps).to.be.gte(9500);
      console.log(
        `    VERIFIED: tasks=${perfData.taskCount}>=100 ✓, rate=${rateBps}>=9500 ✓`
      );
    });

    it("should reject STANDARD tier for under-performing agent", () => {
      const weakPerf = { taskCount: 5, successCount: 2 };
      const rateBps = Math.floor(
        (weakPerf.successCount / weakPerf.taskCount) * 10000
      );
      expect(weakPerf.taskCount < 10 || rateBps < 7000).to.be.true;
      console.log(
        `    Weak agent: tasks=${weakPerf.taskCount}<10 ✗, rate=${rateBps}<7000 ✗`
      );
    });
  });

  // ─── Phase 4: STANDARD Attestation ─────────────────────────────

  let standardAttestationUID: string;

  describe("Phase 4: STANDARD Attestation (on-chain)", () => {
    it("should create a STANDARD attestation with mock proof", async () => {
      const mockProof = ethers.hexlify(ethers.randomBytes(128));
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(10), 32),   // taskThreshold
        ethers.zeroPadValue(ethers.toBeHex(7000), 32),  // rateThresholdBps
        ethers.zeroPadValue(ethers.toBeHex(0), 32),     // dataCommitment (mock)
      ];

      const tx = await registry.createCapabilityAttestation(
        agentId,
        10,    // taskThreshold
        7000,  // rateThresholdBps
        mockProof,
        publicInputs,
        TIER_STANDARD
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      // Get attestation UID from events
      const uids = await registry.getAttestations(agentId);
      expect(uids.length).to.be.gte(1);
      standardAttestationUID = uids[0];

      // Verify metadata
      const meta = await registry.getAttestationMeta(standardAttestationUID);
      expect(Number(meta.tier)).to.equal(TIER_STANDARD);
      expect(Number(meta.expiresAt)).to.equal(0); // STANDARD never expires
      expect(meta.revoked).to.be.false;

      console.log(`    STANDARD attestation ✓: ${standardAttestationUID.slice(0, 18)}...`);
      console.log(`    Tier: STANDARD, Expires: never`);
    });

    it("should report STANDARD attestation as valid", async () => {
      const valid = await registry.isAttestationValid(standardAttestationUID);
      expect(valid).to.be.true;
    });
  });

  // ─── Phase 5: VERIFIED Attestation ─────────────────────────────

  let verifiedAttestationUID: string;

  describe("Phase 5: VERIFIED Attestation (on-chain)", () => {
    it("should create a VERIFIED attestation with mock proof", async () => {
      const mockProof = ethers.hexlify(ethers.randomBytes(128));
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(100), 32),  // taskThreshold
        ethers.zeroPadValue(ethers.toBeHex(9500), 32), // rateThresholdBps
        ethers.zeroPadValue(ethers.toBeHex(0), 32),    // dataCommitment (mock)
      ];

      const tx = await registry.createCapabilityAttestation(
        agentId,
        100,   // taskThreshold
        9500,  // rateThresholdBps
        mockProof,
        publicInputs,
        TIER_VERIFIED
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const uids = await registry.getAttestations(agentId);
      expect(uids.length).to.equal(2); // STANDARD + VERIFIED
      verifiedAttestationUID = uids[1];

      // Verify metadata
      const meta = await registry.getAttestationMeta(verifiedAttestationUID);
      expect(Number(meta.tier)).to.equal(TIER_VERIFIED);
      expect(Number(meta.expiresAt)).to.be.gt(0); // VERIFIED has 90-day expiry
      expect(meta.revoked).to.be.false;

      // Check expiry is ~90 days from now
      const block = await ethers.provider.getBlock("latest");
      const expectedExpiry = block!.timestamp + 90 * 24 * 60 * 60;
      expect(Number(meta.expiresAt)).to.be.closeTo(expectedExpiry, 5);

      console.log(`    VERIFIED attestation ✓: ${verifiedAttestationUID.slice(0, 18)}...`);
      console.log(`    Tier: VERIFIED, Expires: ${new Date(Number(meta.expiresAt) * 1000).toISOString()}`);
    });

    it("should report VERIFIED attestation as valid", async () => {
      const valid = await registry.isAttestationValid(verifiedAttestationUID);
      expect(valid).to.be.true;
    });

    it("should reject invalid tier value", async () => {
      const mockProof = ethers.hexlify(ethers.randomBytes(128));
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(10), 32),
        ethers.zeroPadValue(ethers.toBeHex(7000), 32),
        ethers.zeroPadValue(ethers.toBeHex(0), 32),
      ];

      await expect(
        registry.createCapabilityAttestation(
          agentId, 10, 7000, mockProof, publicInputs, 3 // invalid tier
        )
      ).to.be.revertedWithCustomError(registry, "InvalidTier");
    });
  });

  // ─── Phase 6: Verification (on-chain query) ────────────────────

  describe("Phase 6: On-Chain Verification", () => {
    it("should return all attestations for the agent", async () => {
      const uids = await registry.getAttestations(agentId);
      expect(uids.length).to.equal(2);
      console.log(`    Agent has ${uids.length} attestations ✓`);
    });

    it("should filter by VERIFIED min_tier", async () => {
      const uids = await registry.getAttestations(agentId);

      const verifiedOnly = [];
      for (const uid of uids) {
        const meta = await registry.getAttestationMeta(uid);
        if (Number(meta.tier) >= TIER_VERIFIED && !meta.revoked) {
          verifiedOnly.push(uid);
        }
      }

      expect(verifiedOnly.length).to.equal(1);
      expect(verifiedOnly[0]).to.equal(verifiedAttestationUID);
      console.log(`    VERIFIED-only filter: ${verifiedOnly.length} result ✓`);
    });

    it("should filter by STANDARD min_tier (returns both)", async () => {
      const uids = await registry.getAttestations(agentId);

      const standardPlus = [];
      for (const uid of uids) {
        const meta = await registry.getAttestationMeta(uid);
        if (Number(meta.tier) >= TIER_STANDARD && !meta.revoked) {
          standardPlus.push(uid);
        }
      }

      expect(standardPlus.length).to.equal(2); // STANDARD + VERIFIED
      console.log(`    STANDARD+ filter: ${standardPlus.length} results ✓`);
    });

    it("should report no attestations for unknown agent", async () => {
      const unknownId = ethers.keccak256(ethers.toUtf8Bytes("unknown-agent"));
      const uids = await registry.getAttestations(unknownId);
      expect(uids.length).to.equal(0);
    });
  });

  // ─── Phase 7: Endorsement ──────────────────────────────────────

  describe("Phase 7: Endorsement (on-chain)", () => {
    it("should create an endorsement attestation", async () => {
      const endorserId = ethers.keccak256(
        ethers.solidityPacked(["address"], [otherWallet.address])
      );

      const tx = await registry.createEndorsementAttestation(
        endorserId,
        agentId,
        "code-quality",
        "Impressive code generation capabilities"
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      console.log(`    Endorsement created ✓: ${endorserId.slice(0, 14)}... → ${agentId.slice(0, 14)}...`);
    });
  });

  // ─── Phase 8: Revocation ───────────────────────────────────────

  describe("Phase 8: Revocation", () => {
    it("should reject revocation from non-owner", async () => {
      await expect(
        registry.connect(otherWallet).revokeAttestation(agentId, standardAttestationUID)
      ).to.be.revertedWithCustomError(registry, "OnlyAgentOwner");
    });

    it("should revoke STANDARD attestation from agent wallet", async () => {
      const tx = await registry.connect(agentWallet).revokeAttestation(
        agentId,
        standardAttestationUID
      );
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const meta = await registry.getAttestationMeta(standardAttestationUID);
      expect(meta.revoked).to.be.true;

      const valid = await registry.isAttestationValid(standardAttestationUID);
      expect(valid).to.be.false;

      console.log(`    STANDARD attestation revoked ✓`);
    });

    it("should reject double revocation", async () => {
      await expect(
        registry.connect(agentWallet).revokeAttestation(agentId, standardAttestationUID)
      ).to.be.revertedWithCustomError(registry, "AttestationAlreadyRevoked");
    });

    it("should still report VERIFIED attestation as valid", async () => {
      const valid = await registry.isAttestationValid(verifiedAttestationUID);
      expect(valid).to.be.true;
      console.log(`    VERIFIED attestation still valid ✓`);
    });

    it("should filter out revoked in verification query", async () => {
      const uids = await registry.getAttestations(agentId);

      const active = [];
      for (const uid of uids) {
        const meta = await registry.getAttestationMeta(uid);
        if (!meta.revoked) {
          const valid = await registry.isAttestationValid(uid);
          if (valid) active.push({ uid, tier: Number(meta.tier) });
        }
      }

      expect(active.length).to.equal(1); // Only VERIFIED remains
      expect(active[0].tier).to.equal(TIER_VERIFIED);
      console.log(
        `    Post-revocation: ${active.length} valid attestation (VERIFIED) ✓`
      );
    });
  });

  // ─── Phase 9: Full Flow Summary ────────────────────────────────

  describe("Phase 9: Full Flow Summary", () => {
    it("should provide complete agent reputation snapshot", async () => {
      const isRegistered = await registry.isRegisteredAgent(agentId);
      const wallet = await registry.agentWallet(agentId);
      const uids = await registry.getAttestations(agentId);
      const count = await registry.getAttestationCount(agentId);

      expect(isRegistered).to.be.true;
      expect(wallet).to.equal(agentWallet.address);
      expect(Number(count)).to.equal(2);

      let highestValidTier = 0;
      let validCount = 0;
      for (const uid of uids) {
        const valid = await registry.isAttestationValid(uid);
        if (valid) {
          validCount++;
          const meta = await registry.getAttestationMeta(uid);
          const t = Number(meta.tier);
          if (t > highestValidTier) highestValidTier = t;
        }
      }

      expect(validCount).to.equal(1);
      expect(highestValidTier).to.equal(TIER_VERIFIED);

      console.log(`\n    ════════════════════════════════════`);
      console.log(`    Agent Reputation Snapshot`);
      console.log(`    ════════════════════════════════════`);
      console.log(`    Agent ID:    ${agentId.slice(0, 18)}...`);
      console.log(`    Wallet:      ${wallet}`);
      console.log(`    Registered:  ✓`);
      console.log(`    Total atts:  ${Number(count)}`);
      console.log(`    Valid atts:  ${validCount}`);
      console.log(`    Highest tier: ${highestValidTier === 2 ? "VERIFIED" : "STANDARD"}`);
      console.log(`    ════════════════════════════════════\n`);
    });
  });
});
