#!/usr/bin/env ts-node
/**
 * generateSubmissionSummary.ts
 *
 * Prints a complete submission summary for the AAS hackathon entry:
 * live contract addresses, EAS schemas, IPFS graph CID, and test results.
 *
 * Usage: npx ts-node scripts/generateSubmissionSummary.ts
 */

import * as fs from "fs";
import * as path from "path";

// ──────────────────────────────────────────────────
// Live deployment data
// ──────────────────────────────────────────────────
const CONTRACTS = {
  AASRegistry:  "0x4a9e22A4402090ae445C166dD08Bd7C3A2725316",
  AASZKVerifier:"0xDA75a09F99FB19f44a72e414826ac3811E47EA88",
  HonkVerifier: "0x3F9E3e9633E4aCD844E53722C57C0f7199de23BC",
};

const EAS_SCHEMAS = {
  StandardTierAttestation: "0x6f0dae124370a9d3bf7aaca1462bb6b1feb4cd58b40738769fd1dba21d633741",
  VerifiedTierAttestation:  "0x9f370e3839f1c49b0bf6d0c020fc7e07886ca799870e188ff2ca4da0fc585c59",
  EndorsementAttestation:   "0x4979dbe5b2efa3a6ff08855e3f904a4c547cdc0e9a326836ddc844f644653f54",
  TaskCompletion:            "0x86d64327b12a1d012f55a5f18bdbbc9c67abb4e233d839a8d63b04c4c05579bb",
};

const IPFS = {
  cid:      "baguqeerauibj7jbwn7x3jqacsf3273sbgsi4wmnu2bll6arscyxn5el7tjoa",
  cidBytes32: "0xa2029fa4366fefb4c0029177afee413491cb31b4d056bf0232162ede917f9a5c",
  commitTx: "0x1e6db4464d4a25fe80252b202bc7938321bf5fd103099a0547550d66f68e13de",
  block:    "10388927",
};

const TEST_RESULTS = {
  "Hardhat (smart contracts)":     "60/60",
  "CRE workflow simulation":       "27/27",
  "End-to-end smoke (Sepolia)":    "14/14",
};

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
function sep(char = "─", width = 60) {
  return char.repeat(width);
}

function header(title: string) {
  console.log("\n" + sep());
  console.log(`  ${title}`);
  console.log(sep());
}

function etherscanAddr(addr: string) {
  return `https://sepolia.etherscan.io/address/${addr}#code`;
}

function easScanSchema(uid: string) {
  return `https://sepolia.easscan.org/schema/view/${uid}`;
}

// Read optional manifest from data/
function readManifest(): Record<string, unknown> | null {
  const manifestPath = path.join(__dirname, "..", "data", "ipfs-manifest.json");
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  }
  return null;
}

// ──────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────
function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   Agent Attestation Service (AAS) — Submission Summary   ║");
  console.log("║   Convergence: A Chainlink Hackathon 2026                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // ── Contracts ──
  header("DEPLOYED CONTRACTS (Sepolia Testnet)");
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    console.log(`  ${name.padEnd(18)} ${addr}`);
    console.log(`  ${"".padEnd(18)} ${etherscanAddr(addr)}`);
  }

  // ── EAS Schemas ──
  header("EAS SCHEMAS (Sepolia)");
  for (const [name, uid] of Object.entries(EAS_SCHEMAS)) {
    console.log(`  ${name.padEnd(28)} ${uid}`);
    console.log(`  ${"".padEnd(28)} ${easScanSchema(uid)}`);
  }

  // ── IPFS Graph ──
  header("IPFS REPUTATION GRAPH");
  console.log(`  CID (v1):        ${IPFS.cid}`);
  console.log(`  CID bytes32:     ${IPFS.cidBytes32}`);
  console.log(`  Commit TX:       ${IPFS.commitTx}`);
  console.log(`  Block:           ${IPFS.block}`);
  console.log(`  Gateway:         https://ipfs.io/ipfs/${IPFS.cid}`);

  // Read live manifest if available
  const manifest = readManifest();
  if (manifest) {
    console.log(`  Pinned to Pinata: ${manifest.pinnedToPinata ?? false}`);
    console.log(`  Agent count:      ${manifest.agentCount ?? "n/a"}`);
  }

  // ── Test Results ──
  header("TEST RESULTS");
  for (const [suite, result] of Object.entries(TEST_RESULTS)) {
    console.log(`  ${suite.padEnd(36)} ${result}`);
  }

  // ── ZK Proof ──
  header("ZK PROOF (UltraHonk / Noir)");
  console.log("  Circuit:         capability-threshold (Poseidon2 + Keccak256)");
  console.log("  Proof size:      14,080 bytes (440 field elements)");
  console.log("  On-chain cost:   ~300K gas");
  console.log("  VK initialized:  true (AASZKVerifier on Sepolia)");
  console.log("  dataCommitment:  0x224785a48a72c75e2cbb698143e71d5d41bd89a2b9a7185871e39a54ce5785b1");

  // ── API Endpoints ──
  header("API ENDPOINTS (local)");
  const endpoints = [
    ["POST", "/api/v1/register"],
    ["POST", "/api/v1/attest"],
    ["GET",  "/api/v1/verify/:agentId"],
    ["GET",  "/api/v1/reputation/:agentId"],
    ["GET",  "/api/v1/reputation/graph"],
    ["POST", "/api/v1/endorse"],
    ["POST", "/api/v1/revoke"],
    ["GET",  "/api/v1/health"],
  ];
  for (const [method, path_] of endpoints) {
    console.log(`  ${method.padEnd(6)} http://localhost:3001${path_}`);
  }

  // ── Repo ──
  header("REPOSITORY");
  console.log("  https://github.com/Lynette7/agent-attestation-service");
  console.log("  Deadline: March 8, 2026  |  Track: CRE & AI Agents");

  console.log("\n" + sep() + "\n");
}

main();
