import { expect } from "chai";
import { ethers } from "hardhat";
import { AASRegistry, AASZKVerifier } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AASRegistry", function () {
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
    // (the actual EAS calls will revert, but we test our contract logic)
    // In integration tests, we'd fork Sepolia
    mockEAS = orchestrator.address; // placeholder — will be replaced with mock
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
      // Try to register with someone else's agentId
      const wrongAgentId = ethers.keccak256(
        ethers.solidityPacked(["address"], [other.address])
      );

      await expect(
        registry.connect(agent).registerAgent(wrongAgentId)
      ).to.be.revertedWith("agentId mismatch");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to set schema UIDs", async function () {
      const capUID = ethers.id("capability");
      const endUID = ethers.id("endorsement");
      const taskUID = ethers.id("task");

      await expect(registry.setSchemaUIDs(capUID, endUID, taskUID))
        .to.emit(registry, "SchemaUIDsUpdated")
        .withArgs(capUID, endUID, taskUID);

      expect(await registry.capabilitySchemaUID()).to.equal(capUID);
      expect(await registry.endorsementSchemaUID()).to.equal(endUID);
      expect(await registry.taskCompletionSchemaUID()).to.equal(taskUID);
    });

    it("should reject non-owner setting schema UIDs", async function () {
      await expect(
        registry
          .connect(other)
          .setSchemaUIDs(ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash)
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
      // UltraHonk public inputs: [taskThreshold, rateThresholdBps] as bytes32
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(100), 32),  // taskThreshold = 100
        ethers.zeroPadValue(ethers.toBeHex(9500), 32),  // rateThresholdBps = 9500
      ];

      // Non-empty mock proof bytes (would be real UltraHonk proof in production)
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
        ethers.zeroPadValue(ethers.toBeHex(10001), 32),  // > 10000
      ];

      await expect(
        zkVerifier.verifyCapabilityProof("0x1234", publicInputs)
      ).to.be.revertedWithCustomError(zkVerifier, "InvalidPublicInputs");
    });

    it("should reject zero task threshold", async function () {
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(0), 32),  // zero
        ethers.zeroPadValue(ethers.toBeHex(9500), 32),
      ];

      await expect(
        zkVerifier.verifyCapabilityProof("0x1234", publicInputs)
      ).to.be.revertedWithCustomError(zkVerifier, "InvalidPublicInputs");
    });

    it("should reject insufficient public inputs", async function () {
      const publicInputs = [
        ethers.zeroPadValue(ethers.toBeHex(100), 32),
        // missing rateThresholdBps
      ];

      await expect(
        zkVerifier.verifyCapabilityProof("0x1234", publicInputs)
      ).to.be.revertedWithCustomError(zkVerifier, "InvalidPublicInputs");
    });
  });

  describe("HonkVerifier Integration", function () {
    it("should allow owner to set HonkVerifier address", async function () {
      // Use a random address as placeholder for the auto-generated verifier
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
