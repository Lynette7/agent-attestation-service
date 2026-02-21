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

## Hackathon

- **Hackathon:** Convergence: A Chainlink Hackathon 2026
- **Primary Track:** CRE & AI Agents
- **Secondary Track:** Privacy / Confidential Compute
- **Submission Deadline:** March 1, 2026

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
| IPFS (web3.storage) | Reputation graph storage (roadmap) |
| viem | ABI encoding/decoding in CRE workflows |
| ethers.js v6 | Contract interaction (API server) |
| Hardhat | Contract development & testing |

## Project Structure

```bash
aas/
├── contracts/               # Solidity smart contracts
│   ├── AASRegistry.sol      # Core registry — two-tier attestations, revocation, reputation graph
│   ├── AASZKVerifier.sol    # UltraHonk ZK proof verifier wrapper
│   ├── interfaces/
│   │   └── IAASZKVerifier.sol
│   └── verifiers/
│       └── HonkVerifier.sol # Auto-generated from Barretenberg (bb)
│   └── mocks/               # EAS + SchemaRegistry mocks for local testing
│       ├── EASMock.sol
│       └── SchemaRegistryMock.sol
├── test/                    # Hardhat test suite (60 tests)
│   ├── AASRegistry.test.ts  # 31 unit tests (two-tier registry + verifier)
│   ├── E2EProof.test.ts     # 4 E2E tests (real UltraHonk proofs on-chain)
│   └── E2EIntegration.test.ts # 25 integration tests (full Day 4 flow)
├── scripts/
│   ├── deploy/deploy.ts       # Dev-mode deployment (no verifier)
│   ├── deploy/deployAndWire.ts # Production deployment (HonkVerifier wired)
│   ├── deploy/deployLocal.ts  # One-step local deployment with EAS mocks
│   ├── eas/registerSchemas.ts  # EAS schema registration (4 schemas, 2 tiers)
│   └── prover/generateProof.ts # CLI proof generation helper
├── cre-workflows/           # CRE SDK workflow projects (@chainlink/cre-sdk)
│   ├── attestation-issuance/   # Workflow A: tier-aware attestation issuance
│   │   ├── main.ts             #   HTTP trigger → ConfidentialHTTPClient → EVMClient.writeReport
│   │   ├── project.yaml        #   CRE project config (RPC, chain settings)
│   │   ├── workflow.yaml       #   Entry point declaration
│   │   ├── config.staging.json #   Contract addresses & chain selector
│   │   └── secrets.yaml        #   Vault DON secret declarations
│   ├── attestation-verification/ # Workflow B: verification with tier + expiry filters
│   │   ├── main.ts             #   HTTP trigger → EVMClient.callContract (reads)
│   │   ├── project.yaml
│   │   ├── workflow.yaml
│   │   └── config.staging.json
│   ├── reputation-graph/       # Workflow C: reputation graph (roadmap)
│   │   ├── main.ts             #   EVM Log trigger → IPFS graph update
│   │   ├── project.yaml
│   │   ├── workflow.yaml
│   │   └── config.staging.json
│   └── legacy/                 # Pre-SDK workflow implementations (reference)
├── circuits/                # Noir ZK circuits
│   └── capability-threshold/
│       ├── Nargo.toml
│       ├── src/main.nr      # Capability threshold proof circuit (both tiers)
│       └── target/          # Compiled artifacts (VK, proof, HonkVerifier.sol)
├── api/                     # REST API + mock services
│   ├── server.ts            # AAS API server (fully wired to blockchain)
│   └── mockPerformanceAPI.ts # Mock agent platform API for Confidential HTTP
├── frontend/                # Next.js 14 dashboard
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   │   ├── page.tsx     # Dashboard home (health, tier overview)
│   │   │   ├── verify/      # Verify Agent (search, filters, verdict)
│   │   │   ├── attest/      # Request Attestation (tier select, pipeline)
│   │   │   └── demo/        # Agent-to-Agent interactive demo
│   │   ├── components/
│   │   │   ├── layout/      # Sidebar, Header (wallet connect)
│   │   │   ├── providers/   # ThirdwebProvider wrapper
│   │   │   └── ui/          # TierBadge, ExpiryCountdown, AttestationCard, etc.
│   │   └── lib/             # API client, constants, utils
│   └── .env.local           # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_THIRDWEB_CLIENT_ID
├── hardhat.config.ts
└── .env.example
```

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
npm test
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

### Deploy (Sepolia)

```bash
# Ensure .env has SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY
npm run deploy:sepolia
npm run register-schemas:sepolia
```

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/v1/register` | Register agent on-chain (body: `{ wallet_address }`) |
| `POST` | `/api/v1/attest` | **E2E attestation**: fetch perf → eligibility → ZK proof → on-chain (body: `{ agent_id, tier }`) |
| `GET` | `/api/v1/verify/:agentId` | **On-chain verification** with tier/expiry/revocation filtering (query: `min_tier`, `max_age_days`, `include_expired`) |
| `GET` | `/api/v1/reputation/:agentId` | Query reputation graph (on-chain attestation summary) |
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

## Sprint Plan

- [x] **Day 1 (Feb 17):** EAS schemas, contract deployment, CRE workflow structure, 23 tests passing
- [x] **Day 2 (Feb 18):** Noir circuit compilation, UltraHonk proof generation, Solidity verifier integration, E2E proof verification (27 tests)
- [x] **Day 3 (Feb 19):** Two-tier system (STANDARD/VERIFIED), expiry management, revocation, tier-aware Workflow A + B, Confidential HTTP mock API, 35 tests passing
- [x] **Day 4 (Feb 20):** End-to-end wiring: API → mock perf API → eligibility → ZK proof → on-chain EAS attestation, on-chain verification/revocation/endorsement, EAS mock contracts, 25 integration tests (60 total)
- [x] **Day 5 (Feb 21):** Next.js 14 frontend — Dashboard, Verify Agent, Request Attestation, Agent-to-Agent Demo pages; Thirdweb wallet connect; dark theme; TierBadge, ExpiryCountdown, AttestationCard components; API client wired to backend; local deploy script (`deployLocal.ts`)
- [x] **Day 6 (Feb 22):** CRE SDK compliance audit — rewrote all three workflows to use official `@chainlink/cre-sdk` (HTTPCapability, ConfidentialHTTPClient, EVMClient, runtime.report(), viem ABI encoding); CRE project structure (project.yaml, workflow.yaml, config.staging.json, secrets.yaml); moved legacy implementations to `cre-workflows/legacy/`
- [ ] **Days 7-9:** Frontend polish, CRE testnet deployment, IPFS reputation graph, end-to-end integration testing
- [ ] **Days 10-12:** Demo video, submission, polish

## License

MIT

---

_Trust, verifiably._
