// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEAS, AttestationRequest, AttestationRequestData} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import {ISchemaRegistry} from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import {IAASZKVerifier} from "./interfaces/IAASZKVerifier.sol";

/**
 * @title AASRegistry
 * @author Agent Attestation Service
 * @notice Core registry contract for AAS. Manages agent attestations,
 *         interfaces with EAS for on-chain anchoring, and stores the
 *         reputation graph IPFS CID.
 */
contract AASRegistry {
    // ─── Immutables ──────────────────────────────────────────────────
    IEAS public immutable eas;
    ISchemaRegistry public immutable schemaRegistry;
    IAASZKVerifier public immutable zkVerifier;

    // ─── State ───────────────────────────────────────────────────────
    bytes32 public capabilitySchemaUID;
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

    /// @notice IPFS CID (bytes32 commitment) of the latest reputation graph
    bytes32 public reputationGraphCID;

    // ─── Events ──────────────────────────────────────────────────────
    event AgentRegistered(bytes32 indexed agentId, address indexed wallet);
    event AttestationRegistered(bytes32 indexed agentId, bytes32 indexed uid);
    event AttestationCreated(
        bytes32 indexed agentId,
        bytes32 indexed uid,
        uint64 taskThreshold,
        uint64 rateThresholdBps
    );
    event EndorsementCreated(
        bytes32 indexed endorserAgentId,
        bytes32 indexed endorsedAgentId,
        bytes32 indexed uid
    );
    event ReputationGraphUpdated(bytes32 indexed newCID);
    event OrchestratorUpdated(address indexed newOrchestrator);
    event SchemaUIDsUpdated(bytes32 capability, bytes32 endorsement, bytes32 taskCompletion);

    // ─── Errors ──────────────────────────────────────────────────────
    error OnlyOwner();
    error OnlyCREOrchestrator();
    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error InvalidSchemaUID();
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
     * @notice Sets the EAS schema UIDs used by AAS.
     * @dev Called once after EAS schemas are registered on-chain.
     */
    function setSchemaUIDs(
        bytes32 _capabilitySchemaUID,
        bytes32 _endorsementSchemaUID,
        bytes32 _taskCompletionSchemaUID
    ) external onlyOwner {
        capabilitySchemaUID = _capabilitySchemaUID;
        endorsementSchemaUID = _endorsementSchemaUID;
        taskCompletionSchemaUID = _taskCompletionSchemaUID;
        emit SchemaUIDsUpdated(_capabilitySchemaUID, _endorsementSchemaUID, _taskCompletionSchemaUID);
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
        emit AgentRegistered(agentId, msg.sender);
    }

    // ─── Attestation Functions ───────────────────────────────────────

    /**
     * @notice Creates a capability attestation via EAS and registers it.
     * @dev Called by the CRE orchestrator after ZK proof generation.
     *      The proof and publicInputs are UltraHonk artefacts from Barretenberg.
     */
    function createCapabilityAttestation(
        bytes32 agentId,
        uint64 taskThreshold,
        uint64 rateThresholdBps,
        bytes calldata zkProof,
        bytes32[] calldata publicInputs
    ) external onlyCREOrchestrator returns (bytes32 uid) {
        if (capabilitySchemaUID == bytes32(0)) revert InvalidSchemaUID();

        // Encode attestation data matching the EAS schema
        bytes memory attestationData = abi.encode(
            agentId,
            taskThreshold,
            rateThresholdBps,
            zkProof,
            publicInputs
        );

        // Submit to EAS
        uid = eas.attest(
            AttestationRequest({
                schema: capabilitySchemaUID,
                data: AttestationRequestData({
                    recipient: address(0), // No specific recipient
                    expirationTime: 0,     // No expiry for MVP
                    revocable: true,
                    refUID: bytes32(0),
                    data: attestationData,
                    value: 0
                })
            })
        );

        // Register in local index
        agentAttestations[agentId].push(uid);
        emit AttestationRegistered(agentId, uid);
        emit AttestationCreated(agentId, uid, taskThreshold, rateThresholdBps);

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
