# Agent Attestation Service (AAS)

**A Verifiable Reputation & Trust Layer for Autonomous AI Agents**

> CRE-native infrastructure that enables AI agents to earn verifiable, privacy-preserving credentials — powered by Chainlink CRE, Ethereum Attestation Service, and Zero-Knowledge Proofs.

---

## Overview

AAS solves a foundational problem in multi-agent AI systems: **how do autonomous agents establish trust with each other without exposing sensitive performance data?**

Agents can earn on-chain attestations proving threshold claims (e.g., _"95%+ success rate over 100+ tasks"_) without revealing their raw task history. Any agent or smart contract can verify these credentials in seconds.

### Core Flow

```
Agent completes task → CRE Workflow triggered
  → Confidential HTTP fetches performance data (private)
  → ZK Proof generated (Noir / UltraHonk)
  → EAS Attestation anchored on-chain
  → Any agent can verify trustworthiness
```

## Hackathon

- **Hackathon:** Convergence: A Chainlink Hackathon 2026
- **Primary Track:** CRE & AI Agents
- **Secondary Track:** Privacy / Confidential Compute
- **Submission Deadline:** March 1, 2026

## Tech Stack

| Technology | Role |
|---|---|
| CRE (Chainlink Runtime Environment) | Workflow orchestration backbone |
| Ethereum Attestation Service (EAS) | On-chain attestation registry |
| Noir (Aztec) + Barretenberg | ZK circuit DSL (UltraHonk proofs) |
| Solidity 0.8.24 | Smart contracts (AASRegistry, AASZKVerifier) |
| Sepolia Testnet | Primary deployment target |
| Thirdweb SDK | Frontend Web3 connectivity |
| Next.js 14 | Frontend dashboard |
| IPFS (web3.storage) | Reputation graph storage |
| ethers.js v6 | Contract interaction |
| Hardhat | Contract development & testing |

## Project Structure

```
aas/
├── contracts/               # Solidity smart contracts
│   ├── AASRegistry.sol      # Core registry — agent attestations & reputation graph CID
│   ├── AASZKVerifier.sol    # UltraHonk ZK proof verifier wrapper
│   ├── interfaces/
│   │   └── IAASZKVerifier.sol
│   └── verifiers/
│       └── HonkVerifier.sol # Auto-generated from Barretenberg (bb)
├── test/                    # Hardhat test suite
│   ├── AASRegistry.test.ts  # 23 unit tests
│   └── E2EProof.test.ts     # 4 E2E tests (real UltraHonk proofs on-chain)
├── scripts/
│   ├── deploy/deploy.ts       # Dev-mode deployment (no verifier)
│   ├── deploy/deployAndWire.ts # Production deployment (HonkVerifier wired)
│   ├── eas/registerSchemas.ts  # EAS schema registration
│   └── prover/generateProof.ts # CLI proof generation helper
├── cre-workflows/           # CRE workflow implementations
│   ├── attestation-issuance/workflowA.ts    # Workflow A: issue attestations
│   ├── attestation-verification/workflowB.ts # Workflow B: verify attestations
│   └── reputation-graph/workflowC.ts        # Workflow C: reputation graph (roadmap)
├── circuits/                # Noir ZK circuits
│   └── capability-threshold/
│       ├── Nargo.toml
│       ├── src/main.nr      # Capability threshold proof circuit
│       └── target/          # Compiled artifacts (VK, proof, HonkVerifier.sol)
├── api/                     # REST API server
│   └── server.ts
├── frontend/                # Next.js dashboard (Sprint 2)
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

### Start API Server

```bash
npm run api:dev
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/attest` | Trigger attestation issuance |
| `GET` | `/api/v1/verify/:agentId` | Verify agent attestation |
| `GET` | `/api/v1/reputation/:agentId` | Query reputation graph |
| `POST` | `/api/v1/endorse` | Submit endorsement |
| `GET` | `/api/v1/health` | Health check |

## Smart Contracts

### AASRegistry.sol

Core registry managing:

- Agent registration (wallet → agentId mapping)
- Capability attestation creation via EAS
- Endorsement attestation creation
- Reputation graph CID storage (IPFS)

### AASZKVerifier.sol

UltraHonk proof verifier wrapper with:

- Delegates to auto-generated `HonkVerifier.sol` from Barretenberg
- Development mode fallback (pre-verifier deployment)
- Hot-swappable HonkVerifier address via `setHonkVerifier()`
- Public input validation (3 inputs: taskThreshold, rateThresholdBps, dataCommitment)

## EAS Schemas

| Schema | Fields |
|---|---|
| CapabilityAttestation | `agentId, taskThreshold, rateThresholdBps, zkProof, publicInputs` |
| EndorsementAttestation | `endorserAgentId, endorsedAgentId, endorsementType, context` |
| TaskCompletionAttestation | `agentId, taskId, outcomeHash, success` |

## ZK Circuit

The Noir circuit proves: _"This agent completed ≥ N tasks with ≥ P% success rate"_ — without revealing actual counts.

- **Proof system:** UltraHonk via Barretenberg (bb v0.84.0)
- **Hash function:** Poseidon2 (data commitment), Keccak256 (Fiat-Shamir oracle for EVM)
- **Circuit size:** ~3,042 constraints
- **Proof size:** 14,080 bytes (440 field elements)
- **On-chain verification cost:** ~300K gas
- **Public inputs:** `[taskThreshold, rateThresholdBps, dataCommitment]`

## Sprint Plan

- [x] **Day 1 (Feb 17):** EAS schemas, contract deployment, CRE workflow structure, 23 tests passing
- [x] **Day 2 (Feb 18):** Noir circuit compilation, UltraHonk proof generation, Solidity verifier integration, E2E proof verification (27 tests)
- [ ] **Day 3 (Feb 19):** CRE Workflow A with Confidential HTTP
- [ ] **Day 4 (Feb 20):** End-to-end: trigger → fetch → prove → attest
- [ ] **Days 5-9:** Workflow B, REST API, frontend dashboard, agent-to-agent demo
- [ ] **Days 10-12:** Demo video, submission, polish

## License

MIT

---

_Trust, verifiably._
