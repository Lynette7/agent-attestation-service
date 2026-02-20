// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISchemaRegistry, SchemaRecord} from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";

/**
 * @title SchemaRegistryMock
 * @notice Minimal SchemaRegistry mock for local testing.
 */
contract SchemaRegistryMock is ISchemaRegistry {
    mapping(bytes32 => SchemaRecord) private _schemas;

    function register(
        string calldata schema,
        ISchemaResolver resolver,
        bool revocable
    ) external returns (bytes32) {
        bytes32 uid = keccak256(abi.encodePacked(schema, resolver, revocable));
        _schemas[uid] = SchemaRecord({
            uid: uid,
            resolver: resolver,
            revocable: revocable,
            schema: schema
        });
        return uid;
    }

    function getSchema(bytes32 uid) external view returns (SchemaRecord memory) {
        return _schemas[uid];
    }

    function version() external pure returns (string memory) {
        return "1.0.0-mock";
    }
}
