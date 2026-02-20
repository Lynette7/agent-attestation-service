import { expect } from "chai";
import { ethers } from "hardhat";
import { AASRegistry, AASZKVerifier } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AASRegistry (v2 — Two-Tier System)", function () {
  let registry: AASRegistry;
  let zkVerifier: AASZKVerifier;
  let owner: SignerWithAddress;
  let orchestrator: SignerWithAddress;
  let agent: SignerWithAddress;
  let other: SignerWithAddress;

  // Mock EAS — we deploy a minimal mock for local testing
  let mockEAS: string;
  let mockSchemaRegistry: string;

  beforeEach(async function () {
    [owner, orchestrator, agent, other] = await ethers.getSigners();

    // Deploy ZK Verifier
    const ZKVerifier = await ethers.getContractFactory("AASZKVerifier");
    zkVerifier = (await ZKVerifier.deploy()) as unknown as AASZKVerifier;
    await zkVerifier.waitForDeployment();

    // For local tests, use dummy addresses for EAS contracts
    mockEAS = orchestrator.address;
    mockSchemaRegistry = orchestrator.address;

    // Deploy Registry
    const Registry = await ethers.getContractFactory("AASRegistry");
    registry = (await Registry.deploy(
      mockEAS,
      mockSchemaRegistry,
      await zkVerifier.getAddress(),
      orchestrator.address
    )) as unknown as AASRegistry;
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should set the correct CRE orchestrator", async function () {
      expect(await registry.creOrchestrator()).to.equal(orchestrator.address);
    });

    it("should set the correct ZK verifier", async function () {
      expect(await registry.zkVerifier()).to.equal(
        await zkVerifier.getAddress()
      );
    });

    it("should expose tier constants", async function () {
      expect(await registry.TIER_STANDARD()).to.equal(1);
      expect(await registry.TIER_VERIFIED()).to.equal(2);
    });

    it("should expose 90-day expiry duration", async function () {
      expect(await registry.VERIFIED_EXPIRY_DURATION()).to.equal(90 * 24 * 60 * 60);
    });

    it("should revert with zero addresses", async function () {
      const Registry = await ethers.getContractFactory("AASRegistry");
      await expect(
        Registry.deploy(
          ethers.ZeroAddress,
          mockSchemaRegistry,
          await zkVerifier.getAddress(),
          orchestrator.address
        )
      ).to.be.revertedWithCustomError(Registry, "ZeroAddress");
    });
  });

  describe("Agent Registration", function () {
    it("should register an agent with correct agentId", async function () {
      const agentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [agent.address])
      );

      await expect(registry.connect(agent).registerAgent(agentId))
        .to.emit(registry, "AgentRegistered")
        .withArgs(agentId, agent.address);

      expect(await registry.isRegisteredAgent(agentId)).to.be.true;
    });

    it("should store the agent wallet address", async function () {
      const agentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [agent.address])
      );
      await registry.connect(agent).registerAgent(agentId);
      expect(await registry.agentWallet(agentId)).to.equal(agent.address);
    });

    it("should reject duplicate registration", async function () {
      const agentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [agent.address])
      );

      await registry.connect(agent).registerAgent(agentId);

      await expect(
        registry.connect(agent).registerAgent(agentId)
      ).to.be.revertedWithCustomError(registry, "AgentAlreadyRegistered");
    });

    it("should reject mismatched agentId", async function () {
      const wrongAgentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [other.address])
      );

      await expect(
        registry.connect(agent).registerAgent(wrongAgentId)
      ).to.be.revertedWith("agentId mismatch");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to set four schema UIDs", async function () {
      const stdUID = ethers.id("standard");
      const verUID = ethers.id("verified");
      const endUID = ethers.id("endorsement");
      const taskUID = ethers.id("task");

      await expect(registry.setSchemaUIDs(stdUID, verUID, endUID, taskUID))
        .to.emit(registry, "SchemaUIDsUpdated")
        .withArgs(stdUID, verUID, endUID, taskUID);

      expect(await registry.standardTierSchemaUID()).to.equal(stdUID);
      expect(await registry.verifiedTierSchemaUID()).to.equal(verUID);
      expect(await registry.endorsementSchemaUID()).to.equal(endUID);
      expect(await registry.taskCompletionSchemaUID()).to.equal(taskUID);
    });

    it("should reject non-owner setting schema UIDs", async function () {
      await expect(
        registry
          .connect(other)
          .setSchemaUIDs(
            ethers.ZeroHash,
            ethers.ZeroHash,
            ethers.ZeroHash,
            ethers.ZeroHash
          )
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");
    });

    it("should allow owner to update CRE orchestrator", async function () {
      await expect(registry.setCREOrchestrator(other.address))
        .to.emit(registry, "OrchestratorUpdated")
        .withArgs(other.address);

      expect(await registry.creOrchestrator()).to.equal(other.address);
    });

    it("should reject zero address for orchestrator", async function () {
      await expect(
        registry.setCREOrchestrator(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });

  describe("Attestation Metadata", function () {
    it("should return zero tier for unknown attestation UID", async function () {
      const unknownUID = ethers.id("unknown");
      const meta = await registry.getAttestationMeta(unknownUID);
      expect(meta.tier).to.equal(0);
      expect(meta.expiresAt).to.equal(0);
      expect(meta.revoked).to.be.false;
    });

    it("should return false for isAttestationValid with unknown UID", async function () {
      const unknownUID = ethers.id("unknown");
      expect(await registry.isAttestationValid(unknownUID)).to.be.false;
    });
  });

  describe("Revocation", function () {
    it("should reject revocation from non-agent-owner", async function () {
      const agentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [agent.address])
      );

      // Register agent
      await registry.connect(agent).registerAgent(agentId);

      // Try to revoke from wrong address (other is not the agent wallet)
      const fakeUID = ethers.id("fake");
      await expect(
        registry.connect(other).revokeAttestation(agentId, fakeUID)
      ).to.be.revertedWithCustomError(registry, "OnlyAgentOwner");
    });

    it("should reject revocation of non-existent attestation", async function () {
      const agentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [agent.address])
      );

      await registry.connect(agent).registerAgent(agentId);

      const fakeUID = ethers.id("fake");
      await expect(
        registry.connect(agent).revokeAttestation(agentId, fakeUID)
      ).to.be.revertedWithCustomError(registry, "AttestationNotFound");
    });
  });

  describe("Query Functions", function () {
    it("should return empty attestations for new agent", async function () {
      const agentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [agent.address])
      );
      const attestations = await registry.getAttestations(agentId);
      expect(attestations.length).to.equal(0);
    });

    it("should return correct attestation count", async function () {
      const agentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [agent.address])
      );
      expect(await registry.getAttestationCount(agentId)).to.equal(0);
    });
  });
});

describe("AASZKVerifier", function () {
  let zkVerifier: AASZKVerifier;
  let owner: SignerWithAddress;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const ZKVerifier = await ethers.getContractFactory("AASZKVerifier");
    zkVerifier = (await ZKVerifier.deploy()) as unknown as AASZKVerifier;
    await zkVerifier.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await zkVerifier.owner()).to.equal(owner.address);
    });

    it("should not have VK initialized", async function () {
      expect(await zkVerifier.vkInitialized()).to.be.false;
    });
  });

  describe("Dev Mode Verification", function () {
    it("should verify a non-empty proof in dev mode", async function () {
      // UltraHonk public inputs: [taskThreshold, rateThresholdBps, dataCommitment]
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(100), 32),
        ethers.zeroPadValue(ethers.toBeHex(9500), 32),
        ethers.keccak256(ethers.toUtf8Bytes("commitment")),
      ];

      const mockProof = ethers.hexlify(ethers.randomBytes(64));

      const result = await zkVerifier.verifyCapabilityProof(
        mockProof,
        publicInputs
      );
      expect(result).to.be.true;
    });

    it("should verify STANDARD tier thresholds in dev mode", async function () {
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(10), 32),   // STANDARD: 10 tasks
        ethers.zeroPadValue(ethers.toBeHex(7000), 32),  // STANDARD: 70%
        ethers.keccak256(ethers.toUtf8Bytes("commitment")),
      ];

      const mockProof = ethers.hexlify(ethers.randomBytes(64));
      const result = await zkVerifier.verifyCapabilityProof(
        mockProof,
        publicInputs
      );
      expect(result).to.be.true;
    });

    it("should reject an empty proof in dev mode", async function () {
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(100), 32),
        ethers.zeroPadValue(ethers.toBeHex(9500), 32),
        ethers.keccak256(ethers.toUtf8Bytes("commitment")),
      ];

      const result = await zkVerifier.verifyCapabilityProof(
        "0x",
        publicInputs
      );
      expect(result).to.be.false;
    });

    it("should reject invalid rate threshold (>10000 bps)", async function () {
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(100), 32),
        ethers.zeroPadValue(ethers.toBeHex(10001), 32),
        ethers.keccak256(ethers.toUtf8Bytes("commitment")),
      ];

      await expect(
        zkVerifier.verifyCapabilityProof("0x1234", publicInputs)
      ).to.be.revertedWithCustomError(zkVerifier, "InvalidPublicInputs");
    });

    it("should reject zero task threshold", async function () {
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(0), 32),
        ethers.zeroPadValue(ethers.toBeHex(9500), 32),
        ethers.keccak256(ethers.toUtf8Bytes("commitment")),
      ];

      await expect(
        zkVerifier.verifyCapabilityProof("0x1234", publicInputs)
      ).to.be.revertedWithCustomError(zkVerifier, "InvalidPublicInputs");
    });

    it("should reject insufficient public inputs", async function () {
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(100), 32),
        ethers.zeroPadValue(ethers.toBeHex(9500), 32),
        // missing dataCommitment — only 2 of 3 inputs
      ];

      await expect(
        zkVerifier.verifyCapabilityProof("0x1234", publicInputs)
      ).to.be.revertedWithCustomError(zkVerifier, "InvalidPublicInputs");
    });
  });

  describe("HonkVerifier Integration", function () {
    it("should allow owner to set HonkVerifier address", async function () {
      const fakeVerifierAddr = ethers.Wallet.createRandom().address;

      await expect(zkVerifier.setHonkVerifier(fakeVerifierAddr))
        .to.emit(zkVerifier, "HonkVerifierUpdated")
        .withArgs(fakeVerifierAddr);

      expect(await zkVerifier.vkInitialized()).to.be.true;
    });

    it("should reject non-owner setting HonkVerifier", async function () {
      const [, nonOwner] = await ethers.getSigners();
      const fakeAddr = ethers.Wallet.createRandom().address;

      await expect(
        zkVerifier.connect(nonOwner).setHonkVerifier(fakeAddr)
      ).to.be.revertedWithCustomError(zkVerifier, "OnlyOwner");
    });

    it("should reject zero address for HonkVerifier", async function () {
      await expect(
        zkVerifier.setHonkVerifier(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(zkVerifier, "InvalidPublicInputs");
    });
  });
});
