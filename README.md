# Agent Attestation Service (AAS) v2

## A Verifiable Reputation & Trust Layer for Autonomous AI Agents

> CRE-native infrastructure that enables AI agents to earn verifiable, privacy-preserving credentials with a **two-tier trust system** — powered by Chainlink CRE, Ethereum Attestation Service, and Zero-Knowledge Proofs (UltraHonk).

---

## Overview

AAS solves two foundational problems in multi-agent AI systems:

1. **The Trust Problem** — How do autonomous agents establish trust with each other without exposing sensitive performance data?
2. **The Cold Start Problem** — How do new agents bootstrap reputation when they can't get work without credentials?

AAS introduces a **two-tier attestation system** with deliberate entry barriers:

| Tier | Requirements | Expiry | Purpose |
| --- | --- | --- | --- |
| **STANDARD** | 10+ tasks, 70%+ success | Never | Bootstrap credential — proves basic competence |
| **VERIFIED** | 100+ tasks, 95%+ success | 90 days | Production-grade trust — required for high-value work |

Agents earn on-chain attestations proving threshold claims (e.g., _"95%+ success rate over 100+ tasks"_) without revealing their raw task history. Any agent or smart contract can verify these credentials in seconds.

### Core Flow

```bash
Agent requests STANDARD or VERIFIED attestation
  → CRE Workflow triggered with requested tier
  → Confidential HTTP fetches performance data (private, inside TEE)
  → ZK Proof generated (Noir / UltraHonk) with tier-specific thresholds
  → Tier-stamped EAS Attestation anchored on-chain
  → Any agent can verify: GET /api/v1/verify/:id?min_tier=VERIFIED
```

## Live Deployment (Sepolia Testnet)

Contracts deployed at block `10342928`, all verified on Etherscan.

| Contract | Address | Etherscan |
| --- | --- | --- |
| **AASRegistry** | `0x4a9e22A4402090ae445C166dD08Bd7C3A2725316` | [View](https://sepolia.etherscan.io/address/0x4a9e22A4402090ae445C166dD08Bd7C3A2725316#code) |
| **AASZKVerifier** | `0xDA75a09F99FB19f44a72e414826ac3811E47EA88` | [View](https://sepolia.etherscan.io/address/0xDA75a09F99FB19f44a72e414826ac3811E47EA88#code) |
| **HonkVerifier** | `0x3F9E3e9633E4aCD844E53722C57C0f7199de23BC` | [View](https://sepolia.etherscan.io/address/0x3F9E3e9633E4aCD844E53722C57C0f7199de23BC#code) |

> **VK initialized:** `true` — real 14 KB UltraHonk proofs are generated and verified live on Sepolia.

### EAS Schemas (Sepolia)

| Schema | UID |
| --- | --- |
| StandardTierAttestation | `0x6f0dae124370a9d3bf7aaca1462bb6b1feb4cd58b40738769fd1dba21d633741` |
| VerifiedTierAttestation | `0x9f370e3839f1c49b0bf6d0c020fc7e07886ca799870e188ff2ca4da0fc585c59` |
| EndorsementAttestation | `0x4979dbe5b2efa3a6ff08855e3f904a4c547cdc0e9a326836ddc844f644653f54` |
| TaskCompletionAttestation | `0x86d64327b12a1d012f55a5f18bdbbc9c67abb4e233d839a8d63b04c4c05579bb` |

---

## IPFS Reputation Graph

The on-chain reputation graph snapshot is stored on IPFS; the CID is committed to the AASRegistry contract.

| Field | Value |
| --- | --- |
| **CID (v1, dag-json)** | `baguqeerauibj7jbwn7x3jqacsf3273sbgsi4wmnu2bll6arscyxn5el7tjoa` |
| **CID bytes32 (on-chain)** | `0xa2029fa4366fefb4c0029177afee413491cb31b4d056bf0232162ede917f9a5c` |
| **Commit TX** | [0x1e6db446...](https://sepolia.etherscan.io/tx/0x1e6db4464d4a25fe80252b202bc7938321bf5fd103099a0547550d66f68e13de) |
| **Block** | `10388927` |
| **Graph** | 3 agents · 5 attestation edges · 2 endorsement edges · avg trust 39/100 |

The CID is computed locally using `multiformats` (sha-256 + dag-json codec), then committed on-chain via `AASRegistry.updateReputationGraph(cidBytes32)`. Retrieve the full graph via `GET /api/v1/reputation/graph`.

---

## Tech Stack

| Technology | Role |
| --- | --- |
| CRE (Chainlink Runtime Environment) | Workflow orchestration backbone (`@chainlink/cre-sdk`) |
| Ethereum Attestation Service (EAS) | On-chain attestation registry (dual-tier schemas) |
| Noir (Aztec) + Barretenberg | ZK circuit DSL (UltraHonk proofs) |
| Solidity 0.8.24 + 0.8.27 | Smart contracts (AASRegistry, AASZKVerifier, HonkVerifier) |
| Sepolia Testnet | Primary deployment target |
| Thirdweb SDK | Frontend Web3 connectivity |
| Next.js 14 | Frontend dashboard |
| IPFS (multiformats CIDv1) | Reputation graph storage (live — CID on Sepolia) |
| viem | ABI encoding/decoding in CRE workflows |
| ethers.js v6 | Contract interaction (API server) |
| Hardhat | Contract development & testing |

## Quick Start

### Prerequisites

- Node.js >= 18
- npm or yarn
- [Nargo](https://noir-lang.org/docs/getting_started/installation/) (for ZK circuits)

### Install

```bash
git clone https://github.com/Lynette7/agent-attestation-service.git
cd agent-attestation-service
npm install
cp .env.example .env
# Edit .env with your keys
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
# Smart contract tests (60/60)
npm test

# CRE workflow simulation (27/27)
npm run test:cre-workflows

# End-to-end smoke tests against Sepolia (14/14)
npm run smoke-test
```

### Start Mock Agent Performance API

```bash
npx ts-node api/mockPerformanceAPI.ts
# Runs on http://localhost:3002
# Pre-seeded with 3 demo agents at different tier eligibility levels
```

### Start AAS API Server

```bash
npm run api:dev
# Runs on http://localhost:3001
```

### Start Frontend Dashboard

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
# Requires API server running on :3001
```

### Deploy (Local)

```bash
npm run deploy:local
```

### Build Reputation Graph

```bash
# Scan Sepolia events and build local graph JSON
npm run ipfs:build-graph

# Compute CIDv1 and commit on-chain
npm run ipfs:pin-graph
```

### Deploy to Sepolia

```bash
npm run deploy:sepolia
npm run register-schemas:sepolia
```

---

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/v1/register` | Register agent on-chain (body: `{ wallet_address }`) |
| `POST` | `/api/v1/attest` | **E2E attestation**: fetch perf → eligibility → ZK proof → on-chain (body: `{ agent_id, tier }`) |
| `GET` | `/api/v1/verify/:agentId` | **On-chain verification** with tier/expiry/revocation filtering (query: `min_tier`, `max_age_days`, `include_expired`) |
| `GET` | `/api/v1/reputation/:agentId` | Agent reputation summary |
| `GET` | `/api/v1/reputation/graph` | Full IPFS reputation graph JSON |
| `POST` | `/api/v1/endorse` | On-chain endorsement via EAS (body: `{ endorser_agent_id, endorsed_agent_id, endorsement_type, context }`) |
| `POST` | `/api/v1/revoke` | On-chain revocation (body: `{ agent_id, attestation_uid, reason }`) |
| `GET` | `/api/v1/health` | Health check (shows blockchain connection status) |

## Smart Contracts

### AASRegistry.sol

Core registry managing:

- **Two-tier attestation system** (STANDARD / VERIFIED) with tier-specific EAS schemas
- **Expiry management** — STANDARD never expires; VERIFIED expires after 90 days
- **Revocation support** — `revokeAttestation()` for compromised agents (agent-owner only)
- Agent registration (wallet → agentId mapping + wallet address storage)
- Capability attestation creation via EAS with tier metadata
- Endorsement attestation creation
- Attestation validity queries (`isAttestationValid()`, `getAttestationMeta()`)
- Reputation graph CID storage (IPFS)

### AASZKVerifier.sol

UltraHonk proof verifier wrapper with:

- Delegates to auto-generated `HonkVerifier.sol` from Barretenberg
- Development mode fallback (pre-verifier deployment)
- Hot-swappable HonkVerifier address via `setHonkVerifier()`
- Public input validation (3 inputs: taskThreshold, rateThresholdBps, dataCommitment)

## EAS Schemas (v2)

| Schema | Fields |
| --- | --- |
| StandardTierAttestation | `agentId, taskThreshold (10), rateThresholdBps (7000), zkProof, publicInputs, issuedAt, expiresAt (0)` |
| VerifiedTierAttestation | `agentId, taskThreshold (100), rateThresholdBps (9500), zkProof, publicInputs, issuedAt, expiresAt (timestamp)` |
| EndorsementAttestation | `endorserAgentId, endorsedAgentId, endorsementType, context` |
| TaskCompletionAttestation | `agentId, taskId, outcomeHash, success` |

## ZK Circuit

The Noir circuit proves: _"This agent completed ≥ N tasks with ≥ P% success rate"_ — without revealing actual counts. The same circuit handles both tiers by accepting thresholds as public inputs.

- **Proof system:** UltraHonk via Barretenberg (bb v0.84.0)
- **Hash function:** Poseidon2 (data commitment), Keccak256 (Fiat-Shamir oracle for EVM)
- **Circuit size:** ~3,042 constraints
- **Proof size:** 14,080 bytes (440 field elements)
- **On-chain verification cost:** ~300K gas
- **Public inputs:** `[taskThreshold, rateThresholdBps, dataCommitment]`

## Two-Tier System Details

### Agent Lifecycle

```bash
Day 0:   Agent registers → UNATTESTED (no work delegation)
Day 10:  10+ tasks at 80% → STANDARD attestation (never expires, low-risk work)
Day 90:  120 tasks at 96% → VERIFIED attestation (90-day expiry, production work)
Day 180: VERIFIED expires → Must renew with current stats
Day 200: Performance drops → Falls back to STANDARD only
Day 210: Key compromised → Owner revokes all attestations → UNTRUSTED
```

### Verification Examples

```bash
# High-value task: require recent VERIFIED attestation
GET /api/v1/verify/0xABC123?min_tier=VERIFIED&max_age_days=30

# Low-risk task: accept any valid attestation
GET /api/v1/verify/0xABC123

# Include expired attestations for history
GET /api/v1/verify/0xABC123?include_expired=true
```

## CRE Workflow Architecture

All three workflows are built with the official `@chainlink/cre-sdk` and follow the CRE trigger-and-callback pattern:

| Workflow | Trigger | Capabilities | Purpose |
| --- | --- | --- | --- |
| **A — Attestation Issuance** | HTTP | ConfidentialHTTPClient, EVMClient (write) | Fetch perf data privately → ZK proof → on-chain attestation |
| **B — Attestation Verification** | HTTP | EVMClient (read) | Query registry → filter by tier/expiry → verify ZK proof → return verdict |
| **C — Reputation Graph** _(roadmap)_ | EVM Log | HTTPClient, EVMClient (read/write) | Listen for EAS events → update IPFS graph → commit CID on-chain |

### Simulate Workflows

```bash
# Install CRE CLI (requires bun)
curl -fsSL https://bun.sh/install | bash
bun add -g @chainlink/cre-cli

# Simulate Workflow A
cd cre-workflows/attestation-issuance
cre workflow simulate

# Simulate Workflow B
cd ../attestation-verification
cre workflow simulate
```

### CRE SDK Patterns Used

- **Triggers:** `HTTPCapability.trigger()`, `EVMClient.logTrigger()` (Workflow C)
- **HTTP:** `ConfidentialHTTPClient.sendRequest()` (TEE + Vault DON secrets)
- **EVM reads:** `EVMClient.callContract()` with viem ABI encoding
- **EVM writes:** `runtime.report()` → `EVMClient.writeReport()` (signed reports)
- **Consensus:** `consensusIdenticalAggregation` for deterministic data
- **Secrets:** `runtime.getSecret()` backed by `secrets.yaml` + Vault DON
- **Config:** `config.<target>.json` accessed via `runtime.config`
- **Logging:** `runtime.log()` (not `console.log`)

## License

MIT

---

_Trust, verifiably._
