// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAASZKVerifier} from "./interfaces/IAASZKVerifier.sol";

/**
 * @title IHonkVerifier
 * @notice Interface matching the auto-generated Barretenberg HonkVerifier.
 *         After compiling the Noir circuit and running `bb write_solidity_verifier`,
 *         the resulting HonkVerifier.sol exposes this signature.
 */
interface IHonkVerifier {
    function verify(bytes calldata _proof, bytes32[] calldata _publicInputs)
        external
        view
        returns (bool);
}

/**
 * @title AASZKVerifier
 * @author Agent Attestation Service
 * @notice UltraHonk verifier wrapper for the AAS capability-threshold ZK proof.
 *
 *         Design:
 *         ┌────────────────────┐       ┌──────────────────────────┐
 *         │  AASZKVerifier     │──────▶│ HonkVerifier (auto-gen)  │
 *         │  (this contract)   │       │ from `bb write_solidity` │
 *         └────────────────────┘       └──────────────────────────┘
 *
 *         Noir circuits compiled with Barretenberg's UltraHonk backend
 *         produce proof bytes verified by an auto-generated HonkVerifier.sol.
 *
 *         This contract wraps that auto-generated verifier with AAS-specific
 *         validation logic (public-input sanity checks, dev-mode fallback).
 *
 *         Day 1: Deployed with devMode = true (no real HonkVerifier yet).
 *         Day 2: After `nargo compile && bb write_solidity_verifier`, deploy
 *                the HonkVerifier and call `setHonkVerifier(address)`.
 */
contract AASZKVerifier is IAASZKVerifier {
    // ─── State ───────────────────────────────────────────────────────

    /// @notice Address of the auto-generated HonkVerifier contract.
    ///         Set to address(0) until the Noir circuit is compiled.
    IHonkVerifier public honkVerifier;

    /// @notice Contract owner — can update the HonkVerifier address.
    address public owner;

    /// @notice When true the real HonkVerifier has been wired up.
    bool public vkInitialized;

    // ─── Events ──────────────────────────────────────────────────────
    event HonkVerifierUpdated(address indexed newVerifier);
    event ProofVerified(bytes32[] publicInputs, bool valid);

    // ─── Errors ──────────────────────────────────────────────────────
    error OnlyOwner();
    error InvalidProof();
    error InvalidPublicInputs();
    error VerifierNotSet();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        vkInitialized = false;
    }

    // ─── Admin ───────────────────────────────────────────────────────

    /**
     * @notice Points this wrapper at the auto-generated HonkVerifier.
     * @dev    Called once after Noir circuit compilation:
     *           1. `nargo compile`
     *           2. `bb write_solidity_verifier`
     *           3. Deploy the resulting HonkVerifier.sol
     *           4. Call this function with the deployed address
     */
    function setHonkVerifier(address _honkVerifier) external onlyOwner {
        if (_honkVerifier == address(0)) revert InvalidPublicInputs();
        honkVerifier = IHonkVerifier(_honkVerifier);
        vkInitialized = true;
        emit HonkVerifierUpdated(_honkVerifier);
    }

    // ─── Verification ────────────────────────────────────────────────

    /**
     * @notice Verifies a capability-threshold UltraHonk proof.
     * @param proof         Raw proof bytes from Barretenberg's UltraHonk backend.
     * @param publicInputs  Array of public inputs as bytes32:
     *                        [0] = bytes32(taskThreshold)
     *                        [1] = bytes32(rateThresholdBps)
     * @return valid True if the proof is valid for the given public inputs.
     */
    function verifyCapabilityProof(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view override returns (bool valid) {
        // AAS expects exactly 2 public inputs: taskThreshold, rateThresholdBps
        if (publicInputs.length < 2) revert InvalidPublicInputs();

        uint256 taskThreshold = uint256(publicInputs[0]);
        uint256 rateThresholdBps = uint256(publicInputs[1]);

        // Sanity-check public inputs
        if (taskThreshold == 0) revert InvalidPublicInputs();
        if (rateThresholdBps > 10000) revert InvalidPublicInputs();

        // ── Dev-mode fallback (Day 1 — no HonkVerifier deployed yet) ──
        if (!vkInitialized) {
            return _devModeVerify(proof);
        }

        // ── Production: delegate to the auto-generated HonkVerifier ──
        return honkVerifier.verify(proof, publicInputs);
    }

    // ─── Internal ────────────────────────────────────────────────────

    /**
     * @dev Development-mode verification stub.
     *      Checks that the proof bytes are non-empty (structural validity only).
     *      NOT SECURE — only used before the real HonkVerifier is deployed.
     */
    function _devModeVerify(bytes calldata proof) internal pure returns (bool) {
        // Reject empty / trivially short proofs
        return proof.length > 0;
    }
}
