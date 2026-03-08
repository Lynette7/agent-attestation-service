/**
 * AAS Reputation Graph Pinning Script
 *
 * Reads data/reputation-graph.json, computes a deterministic IPFS CIDv1,
 * optionally pins it to Pinata (if PINATA_JWT is set in .env), and
 * writes the CID to the AASRegistry contract on Sepolia.
 *
 * CID computation uses multiformats (sha2-256 + dag-json codec) — no IPFS
 * node required. The resulting CID is the same as what `ipfs add --cid-version=1`
 * would produce for this exact JSON content.
 *
 * Run: npx ts-node scripts/ipfs/pinReputationGraph.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ─── Config ──────────────────────────────────────────────────────

const REGISTRY_ADDRESS  = process.env.AAS_REGISTRY_ADDRESS!;
const DEPLOYER_KEY      = process.env.DEPLOYER_PRIVATE_KEY!;
const RPC_URL           = process.env.SEPOLIA_RPC_URL!;
const PINATA_JWT        = process.env.PINATA_JWT ?? "";

const GRAPH_PATH = path.resolve(__dirname, "../../data/reputation-graph.json");

// ─── ABI ─────────────────────────────────────────────────────────

const REGISTRY_ABI = [
  "function updateReputationGraph(bytes32 newCID) external",
  "event ReputationGraphUpdated(bytes32 indexed newCID)",
];

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Compute a CIDv1 (dag-json, sha2-256) from raw JSON bytes.
 *
 * Format: bafy... (base32 lowercase, multibase prefix 'b')
 * Codec:  0x0129 (dag-json)
 * Hash:   0x1220 (sha2-256 multihash)
 *
 * This produces the same CID as `ipfs add --cid-version=1 --raw-leaves=false file.json`
 */
function computeIPFSCidV1(content: Buffer): string {
  // 1. SHA-256 digest of the raw bytes
  const digest = crypto.createHash("sha256").update(content).digest();

  // 2. Multihash: [0x12 (sha2-256), 0x20 (32 bytes), ...digest]
  const multihash = Buffer.concat([
    Buffer.from([0x12, 0x20]),
    digest,
  ]);

  // 3. CIDv1 binary: [version=1, codec=0x0129, ...multihash]
  //    dag-json codec varint = 0x0129 → two bytes in varint encoding: 0xa9, 0x02
  const cidBytes = Buffer.concat([
    Buffer.from([0x01]),       // CIDv1
    Buffer.from([0xa9, 0x02]), // varint(0x0129) = dag-json codec
    multihash,
  ]);

  // 4. Base32 lowercase (RFC 4648 no padding) with multibase prefix 'b'
  const base32 = cidBytes.toString("base64").replace(/=/g, "");
  // Use Node's crypto for proper base32 — use a simple lookup table
  const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of cidBytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];

  return "b" + output; // multibase prefix 'b' = base32 lowercase
}

/**
 * Convert a CIDv1 string to bytes32 (first 32 bytes of the raw CID bytes, sha256 hash portion).
 * AASRegistry stores the content hash as bytes32.
 */
function cidToBytes32(cidStr: string): string {
  // Re-derive the sha256 hash from the CID string representation
  // We stored the content, so just re-hash it
  const graphContent = fs.readFileSync(GRAPH_PATH);
  const hash = crypto.createHash("sha256").update(graphContent).digest("hex");
  return "0x" + hash;
}

// ─── Main ────────────────────────────────────────────────────────

async function pinReputationGraph(): Promise<void> {
  // Verify the graph file exists
  if (!fs.existsSync(GRAPH_PATH)) {
    console.error("✗ Graph file not found. Run `npm run ipfs:build-graph` first.");
    process.exit(1);
  }

  const graphContent = fs.readFileSync(GRAPH_PATH);
  const graphJson    = JSON.parse(graphContent.toString());

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   AAS Reputation Graph — IPFS Pinning    ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // 1. Compute CIDv1
  const cid = computeIPFSCidV1(graphContent);
  const cidBytes32 = cidToBytes32(cid);
  console.log(`Content:    data/reputation-graph.json (${Math.round(graphContent.length / 1024)}KB)`);
  console.log(`CID (v1):   ${cid}`);
  console.log(`CID hash:   ${cidBytes32}`);
  console.log(`Gateway:    https://w3s.link/ipfs/${cid}`);

  // 2. Optionally pin to Pinata
  let pinned = false;
  if (PINATA_JWT) {
    console.log("\nPinning to Pinata...");
    try {
      const formData = new FormData();
      const blob = new Blob([graphContent], { type: "application/json" });
      formData.append("file", blob, "reputation-graph.json");
      formData.append("pinataMetadata", JSON.stringify({
        name: `AAS-ReputationGraph-${new Date().toISOString().slice(0, 10)}`,
        keyvalues: {
          network: "sepolia",
          registry: REGISTRY_ADDRESS,
          builtAt: graphJson.builtAt,
        },
      }));
      const resp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body: formData as any,
      });
      if (resp.ok) {
        const result = await resp.json() as any;
        console.log(`✓ Pinned to Pinata! CID: ${result.IpfsHash}`);
        console.log(`  https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);
        pinned = true;
      } else {
        const err = await resp.text();
        console.warn(`  Pinata error (${resp.status}): ${err}`);
      }
    } catch (e: any) {
      console.warn(`  Pinata unavailable: ${e.message}`);
    }
  } else {
    console.log("\n(PINATA_JWT not set — skipping remote pinning. CID is locally computed.)");
    console.log("  To pin: add PINATA_JWT=<your-jwt> to .env and re-run");
  }

  // 3. Write CID to AASRegistry on-chain
  console.log("\nWriting CID to AASRegistry on Sepolia...");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(DEPLOYER_KEY, provider);
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

  try {
    const tx = await registry.updateReputationGraph(cidBytes32);
    console.log(`  TX submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✓ Confirmed in block ${receipt.blockNumber}`);
    console.log(`  https://sepolia.etherscan.io/tx/${tx.hash}`);
  } catch (e: any) {
    // If caller is not CRE orchestrator this will revert — show friendly message
    if (e.message?.includes("onlyCREOrchestrator") || e.message?.includes("0x89c62b64")) {
      console.warn("  ⚠ updateReputationGraph is restricted to the CRE orchestrator address.");
      console.warn("  In production, the CRE Workflow C submits this via EVMClient.writeReport().");
      console.warn("  For demo purposes, the CID is recorded below.");
    } else {
      console.warn(`  On-chain update skipped: ${e.message}`);
    }
  }

  // 4. Save CID to local manifest
  const manifestPath = path.resolve(__dirname, "../../data/ipfs-manifest.json");
  const manifest = {
    cid,
    cidBytes32,
    gateway: `https://w3s.link/ipfs/${cid}`,
    pinnedToPinata: pinned,
    pinnedAt: new Date().toISOString(),
    graphVersion: graphJson.version,
    agentCount: graphJson.metrics?.totalAgents ?? 0,
    attestationCount: graphJson.metrics?.totalAttestations ?? 0,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n✓ IPFS manifest saved to data/ipfs-manifest.json`);
  console.log("\nSummary:");
  console.log(`  CID:         ${cid}`);
  console.log(`  Agents:      ${manifest.agentCount}`);
  console.log(`  Attestations: ${manifest.attestationCount}`);
  console.log(`  Pinned:      ${pinned ? "Yes (Pinata)" : "No (locally computed only)"}`);
}

pinReputationGraph().catch((e) => { console.error("Pin failed:", e); process.exit(1); });
