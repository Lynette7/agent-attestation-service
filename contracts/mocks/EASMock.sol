// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEAS, AttestationRequest, AttestationRequestData, MultiAttestationRequest, MultiRevocationRequest, RevocationRequest, RevocationRequestData, DelegatedAttestationRequest, DelegatedRevocationRequest, MultiDelegatedAttestationRequest, MultiDelegatedRevocationRequest} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import {Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/Common.sol";
import {ISchemaRegistry} from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";

/**
 * @title EASMock
 * @notice Minimal EAS mock for local/test attestation flow.
 *         Stores attestations in memory and returns deterministic UIDs.
 */
contract EASMock is IEAS {
    uint256 private _nonce;

    struct StoredAttestation {
        bytes32 uid;
        bytes32 schema;
        uint64 time;
        uint64 expirationTime;
        uint64 revocationTime;
        bytes32 refUID;
        address attester;
        address recipient;
        bool revocable;
        bytes data;
    }

    mapping(bytes32 => StoredAttestation) public attestations;

    function attest(AttestationRequest calldata request) external payable returns (bytes32) {
        _nonce++;
        bytes32 uid = keccak256(abi.encodePacked(block.timestamp, msg.sender, _nonce));

        attestations[uid] = StoredAttestation({
            uid: uid,
            schema: request.schema,
            time: uint64(block.timestamp),
            expirationTime: request.data.expirationTime,
            revocationTime: 0,
            refUID: request.data.refUID,
            attester: msg.sender,
            recipient: request.data.recipient,
            revocable: request.data.revocable,
            data: request.data.data
        });

        return uid;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        StoredAttestation storage s = attestations[uid];
        return Attestation({
            uid: s.uid,
            schema: s.schema,
            time: s.time,
            expirationTime: s.expirationTime,
            revocationTime: s.revocationTime,
            refUID: s.refUID,
            attester: s.attester,
            recipient: s.recipient,
            revocable: s.revocable,
            data: s.data
        });
    }

    function isAttestationValid(bytes32 uid) external view returns (bool) {
        return attestations[uid].uid != bytes32(0);
    }

    // ─── Stub implementations for IEAS interface ─────────────────

    function revoke(RevocationRequest calldata) external payable {}
    function multiAttest(MultiAttestationRequest[] calldata) external payable returns (bytes32[] memory) {
        return new bytes32[](0);
    }
    function multiRevoke(MultiRevocationRequest[] calldata) external payable {}
    function attestByDelegation(DelegatedAttestationRequest calldata) external payable returns (bytes32) {
        return bytes32(0);
    }
    function revokeByDelegation(DelegatedRevocationRequest calldata) external payable {}
    function multiAttestByDelegation(MultiDelegatedAttestationRequest[] calldata) external payable returns (bytes32[] memory) {
        return new bytes32[](0);
    }
    function multiRevokeByDelegation(MultiDelegatedRevocationRequest[] calldata) external payable {}
    function timestamp(bytes32) external pure returns (uint64) {
        return 0;
    }
    function revokeOffchain(bytes32) external pure returns (uint64) {
        return 0;
    }
    function multiRevokeOffchain(bytes32[] calldata) external pure returns (uint64) {
        return 0;
    }
    function multiTimestamp(bytes32[] calldata) external pure returns (uint64) {
        return 0;
    }
    function getSchemaRegistry() external view returns (ISchemaRegistry) {
        return ISchemaRegistry(address(0));
    }

    function version() external pure returns (string memory) {
        return "1.0.0-mock";
    }

    // EIP-712 domain separator
    function getRevokeOffchain(address, bytes32) external pure returns (uint64) {
        return 0;
    }
    function getTimestamp(bytes32) external pure returns (uint64) {
        return 0;
    }
    function getRevokeTypeHash() external pure returns (bytes32) {
        return bytes32(0);
    }
    function getAttestTypeHash() external pure returns (bytes32) {
        return bytes32(0);
    }
    function getDomainSeparator() external pure returns (bytes32) {
        return bytes32(0);
    }
    function getNonce(address) external pure returns (uint256) {
        return 0;
    }
    function getName() external pure returns (string memory) {
        return "EASMock";
    }
    function getAttestationCount() external pure returns (uint256) {
        return 0;
    }
}
