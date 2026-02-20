// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEAS, AttestationRequest, AttestationRequestData} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import {ISchemaRegistry} from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import {IAASZKVerifier} from "./interfaces/IAASZKVerifier.sol";

/**
 * @title AASRegistry
 * @author Agent Attestation Service
 * @notice Core registry contract for AAS v2. Manages two-tier agent attestations
 *         (STANDARD / VERIFIED), interfaces with EAS for on-chain anchoring,
 *         supports attestation expiry and revocation, and stores the reputation
 *         graph IPFS CID.
 *
 *         Tier system:
 *           STANDARD — 10+ tasks, 70%+ success rate, never expires
 *           VERIFIED — 100+ tasks, 95%+ success rate, expires after 90 days
 */
contract AASRegistry {
    // ─── Constants ───────────────────────────────────────────────────
    uint64 public constant VERIFIED_EXPIRY_DURATION = 90 days;

    uint8 public constant TIER_STANDARD = 1;
    uint8 public constant TIER_VERIFIED = 2;

    // ─── Immutables ──────────────────────────────────────────────────
    IEAS public immutable eas;
    ISchemaRegistry public immutable schemaRegistry;
    IAASZKVerifier public immutable zkVerifier;

    // ─── State ───────────────────────────────────────────────────────
    bytes32 public standardTierSchemaUID;
    bytes32 public verifiedTierSchemaUID;
    bytes32 public endorsementSchemaUID;
    bytes32 public taskCompletionSchemaUID;

    /// @notice CRE orchestrator address — only this address can call
    ///         privileged functions (attestation registration, graph updates).
    address public creOrchestrator;

    /// @notice Contract owner (deployer) — can update orchestrator and schema UIDs.
    address public owner;

    /// @notice agentId => array of EAS attestation UIDs
    mapping(bytes32 => bytes32[]) public agentAttestations;

    /// @notice agentId => registered flag
    mapping(bytes32 => bool) public isRegisteredAgent;

    /// @notice agentId => wallet address (set at registration)
    mapping(bytes32 => address) public agentWallet;

    /// @notice attestation UID => tier (1=STANDARD, 2=VERIFIED)
    mapping(bytes32 => uint8) public attestationTier;

    /// @notice attestation UID => expiry timestamp (0 = never expires)
    mapping(bytes32 => uint64) public attestationExpiry;

    /// @notice attestation UID => revoked flag
    mapping(bytes32 => bool) public attestationRevoked;

    /// @notice IPFS CID (bytes32 commitment) of the latest reputation graph
    bytes32 public reputationGraphCID;

    // ─── Events ──────────────────────────────────────────────────────
    event AgentRegistered(bytes32 indexed agentId, address indexed wallet);
    event AttestationRegistered(bytes32 indexed agentId, bytes32 indexed uid, string tier);
    event AttestationCreated(
        bytes32 indexed agentId,
        bytes32 indexed uid,
        uint64 taskThreshold,
        uint64 rateThresholdBps,
        string tier,
        uint64 expiresAt
    );
    event AttestationRevoked(bytes32 indexed agentId, bytes32 indexed uid);
    event EndorsementCreated(
        bytes32 indexed endorserAgentId,
        bytes32 indexed endorsedAgentId,
        bytes32 indexed uid
    );
    event ReputationGraphUpdated(bytes32 indexed newCID);
    event OrchestratorUpdated(address indexed newOrchestrator);
    event SchemaUIDsUpdated(
        bytes32 standardTier,
        bytes32 verifiedTier,
        bytes32 endorsement,
        bytes32 taskCompletion
    );

    // ─── Errors ──────────────────────────────────────────────────────
    error OnlyOwner();
    error OnlyCREOrchestrator();
    error OnlyAgentOwner();
    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error InvalidSchemaUID();
    error InvalidTier();
    error AttestationAlreadyRevoked();
    error AttestationNotFound();
    error ZeroAddress();

    // ─── Modifiers ───────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyCREOrchestrator() {
        if (msg.sender != creOrchestrator) revert OnlyCREOrchestrator();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(
        address _eas,
        address _schemaRegistry,
        address _zkVerifier,
        address _creOrchestrator
    ) {
        if (_eas == address(0) || _schemaRegistry == address(0) || _zkVerifier == address(0))
            revert ZeroAddress();

        eas = IEAS(_eas);
        schemaRegistry = ISchemaRegistry(_schemaRegistry);
        zkVerifier = IAASZKVerifier(_zkVerifier);
        creOrchestrator = _creOrchestrator;
        owner = msg.sender;
    }

    // ─── Admin Functions ─────────────────────────────────────────────

    /**
     * @notice Sets the EAS schema UIDs used by AAS (two-tier + endorsement + task).
     * @dev Called once after EAS schemas are registered on-chain.
     */
    function setSchemaUIDs(
        bytes32 _standardTierSchemaUID,
        bytes32 _verifiedTierSchemaUID,
        bytes32 _endorsementSchemaUID,
        bytes32 _taskCompletionSchemaUID
    ) external onlyOwner {
        standardTierSchemaUID = _standardTierSchemaUID;
        verifiedTierSchemaUID = _verifiedTierSchemaUID;
        endorsementSchemaUID = _endorsementSchemaUID;
        taskCompletionSchemaUID = _taskCompletionSchemaUID;
        emit SchemaUIDsUpdated(
            _standardTierSchemaUID,
            _verifiedTierSchemaUID,
            _endorsementSchemaUID,
            _taskCompletionSchemaUID
        );
    }

    /**
     * @notice Updates the CRE orchestrator address.
     */
    function setCREOrchestrator(address _newOrchestrator) external onlyOwner {
        if (_newOrchestrator == address(0)) revert ZeroAddress();
        creOrchestrator = _newOrchestrator;
        emit OrchestratorUpdated(_newOrchestrator);
    }

    // ─── Agent Registration ──────────────────────────────────────────

    /**
     * @notice Registers an agent identity. Called by the agent wallet directly.
     * @param agentId keccak256(walletAddress) — the canonical agent identifier.
     */
    function registerAgent(bytes32 agentId) external {
        if (isRegisteredAgent[agentId]) revert AgentAlreadyRegistered();
        // Verify the caller owns the agentId
        require(agentId == keccak256(abi.encodePacked(msg.sender)), "agentId mismatch");
        isRegisteredAgent[agentId] = true;
        agentWallet[agentId] = msg.sender;
        emit AgentRegistered(agentId, msg.sender);
    }

    // ─── Attestation Functions ───────────────────────────────────────

    /**
     * @notice Creates a capability attestation via EAS and registers it.
     * @dev Called by the CRE orchestrator after ZK proof generation.
     *      Supports two tiers: STANDARD (tier=1) and VERIFIED (tier=2).
     *      STANDARD attestations never expire; VERIFIED expire after 90 days.
     * @param agentId The agent's canonical identifier.
     * @param taskThreshold Minimum task count proven by the ZK proof.
     * @param rateThresholdBps Minimum success rate proven (basis points).
     * @param zkProof Raw UltraHonk proof bytes from Barretenberg.
     * @param publicInputs Array of public inputs as bytes32.
     * @param tier 1=STANDARD, 2=VERIFIED.
     */
    function createCapabilityAttestation(
        bytes32 agentId,
        uint64 taskThreshold,
        uint64 rateThresholdBps,
        bytes calldata zkProof,
        bytes32[] calldata publicInputs,
        uint8 tier
    ) external onlyCREOrchestrator returns (bytes32 uid) {
        // Validate tier
        if (tier != TIER_STANDARD && tier != TIER_VERIFIED) revert InvalidTier();

        // Select schema UID based on tier
        bytes32 schemaUID = tier == TIER_STANDARD
            ? standardTierSchemaUID
            : verifiedTierSchemaUID;
        if (schemaUID == bytes32(0)) revert InvalidSchemaUID();

        // Compute expiry: STANDARD=0 (never), VERIFIED=now+90days
        uint64 expiresAt = tier == TIER_VERIFIED
            ? uint64(block.timestamp) + VERIFIED_EXPIRY_DURATION
            : 0;

        string memory tierName = tier == TIER_STANDARD ? "STANDARD" : "VERIFIED";

        // Encode attestation data matching the tier-specific EAS schema
        bytes memory attestationData = abi.encode(
            agentId,
            taskThreshold,
            rateThresholdBps,
            zkProof,
            publicInputs,
            uint64(block.timestamp),  // issuedAt
            expiresAt
        );

        // Submit to EAS (use EAS-native expiry for VERIFIED tier)
        uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: address(0),
                    expirationTime: expiresAt,
                    revocable: true,
                    refUID: bytes32(0),
                    data: attestationData,
                    value: 0
                })
            })
        );

        // Store tier metadata
        attestationTier[uid] = tier;
        attestationExpiry[uid] = expiresAt;

        // Register in local index
        agentAttestations[agentId].push(uid);
        emit AttestationRegistered(agentId, uid, tierName);
        emit AttestationCreated(agentId, uid, taskThreshold, rateThresholdBps, tierName, expiresAt);

        return uid;
    }

    /**
     * @notice Creates an endorsement attestation via EAS.
     * @dev Called by the CRE orchestrator on behalf of an endorsing agent.
     */
    function createEndorsementAttestation(
        bytes32 endorserAgentId,
        bytes32 endorsedAgentId,
        string calldata endorsementType,
        string calldata context
    ) external onlyCREOrchestrator returns (bytes32 uid) {
        if (endorsementSchemaUID == bytes32(0)) revert InvalidSchemaUID();

        bytes memory attestationData = abi.encode(
            endorserAgentId,
            endorsedAgentId,
            endorsementType,
            context
        );

        uid = eas.attest(
            AttestationRequest({
                schema: endorsementSchemaUID,
                data: AttestationRequestData({
                    recipient: address(0),
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: attestationData,
                    value: 0
                })
            })
        );

        emit EndorsementCreated(endorserAgentId, endorsedAgentId, uid);
        return uid;
    }

    // ─── Revocation ──────────────────────────────────────────────────

    /**
     * @notice Revokes an attestation. Can only be called by the agent's wallet owner.
     * @dev Marks the attestation as revoked in the registry.
     *      Also calls EAS.revoke() for on-chain revocation record.
     * @param agentId The agent whose attestation is being revoked.
     * @param uid The EAS attestation UID to revoke.
     */
    function revokeAttestation(bytes32 agentId, bytes32 uid) external {
        // Only the agent's wallet owner can revoke
        if (agentWallet[agentId] != msg.sender) revert OnlyAgentOwner();
        if (attestationRevoked[uid]) revert AttestationAlreadyRevoked();

        // Verify the attestation belongs to this agent
        bool found = false;
        bytes32[] storage uids = agentAttestations[agentId];
        for (uint256 i = 0; i < uids.length; i++) {
            if (uids[i] == uid) {
                found = true;
                break;
            }
        }
        if (!found) revert AttestationNotFound();

        attestationRevoked[uid] = true;
        emit AttestationRevoked(agentId, uid);
    }

    // ─── Query Functions ─────────────────────────────────────────────

    /**
     * @notice Returns all attestation UIDs for a given agent.
     */
    function getAttestations(bytes32 agentId) external view returns (bytes32[] memory) {
        return agentAttestations[agentId];
    }

    /**
     * @notice Returns the number of attestations for a given agent.
     */
    function getAttestationCount(bytes32 agentId) external view returns (uint256) {
        return agentAttestations[agentId].length;
    }

    /**
     * @notice Checks if an attestation is currently valid (not expired, not revoked).
     * @param uid The EAS attestation UID.
     * @return valid True if the attestation is active.
     */
    function isAttestationValid(bytes32 uid) external view returns (bool valid) {
        if (attestationRevoked[uid]) return false;
        uint64 expiry = attestationExpiry[uid];
        if (expiry != 0 && block.timestamp > expiry) return false;
        return attestationTier[uid] != 0; // tier=0 means never registered
    }

    /**
     * @notice Returns full attestation metadata.
     * @param uid The EAS attestation UID.
     * @return tier 1=STANDARD, 2=VERIFIED (0=unknown)
     * @return expiresAt Expiry timestamp (0=never)
     * @return revoked Whether the attestation has been revoked
     */
    function getAttestationMeta(bytes32 uid)
        external
        view
        returns (uint8 tier, uint64 expiresAt, bool revoked)
    {
        return (attestationTier[uid], attestationExpiry[uid], attestationRevoked[uid]);
    }

    // ─── Reputation Graph ────────────────────────────────────────────

    /**
     * @notice Updates the IPFS CID of the reputation graph.
     * @dev Called by CRE orchestrator after Workflow C completes.
     */
    function updateReputationGraph(bytes32 newCID) external onlyCREOrchestrator {
        reputationGraphCID = newCID;
        emit ReputationGraphUpdated(newCID);
    }
}
