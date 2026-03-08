# AAS Submission Video Script
## Convergence: A Chainlink Hackathon 2026
### Target runtime: 4 min 30 sec | Max: 5 min

---

## PRE-RECORDING SETUP CHECKLIST

Before hitting record, have these ready in separate terminal tabs:

**Tab 1 — Mock Performance API**
```bash
npx ts-node --transpile-only api/mockPerformanceAPI.ts
# Must show: "Mock Agent Performance API running on port 3002"
```

**Tab 2 — AAS API Server**
```bash
npm run api:dev
# Must show: blockchain connected, registry address, all endpoints listed
```

**Tab 3 — CRE workflow directory (for simulation)**
```bash
# Create payload file
echo '{"agent_id": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "tier": "VERIFIED"}' > /tmp/payload.json

# Ensure CRE_ETH_PRIVATE_KEY is set in .env (no 0x prefix, 64 hex chars)
# It is derived from DEPLOYER_PRIVATE_KEY with 0x stripped
grep CRE_ETH_PRIVATE_KEY ../../.env  # should print the key

# Navigate to workflow
cd cre-workflows/attestation-issuance
```

**Browser tabs open:**
- Sepolia Etherscan: `https://sepolia.etherscan.io/address/0x4a9e22A4402090ae445C166dD08Bd7C3A2725316#code`
- EASScan: `https://sepolia.easscan.org/schema/view/0x6f0dae124370a9d3bf7aaca1462bb6b1feb4cd58b40738769fd1dba21d633741`
- GitHub repo (public)

**Editor (VS Code) open files:**
- `cre-workflows/attestation-issuance/main.ts` — scroll to ConfidentialHTTPClient section (~line 130)
- `cre-workflows/attestation-issuance/config.staging.json` — shows live Sepolia addresses

**Terminal font size:** 18px minimum
**Screen resolution:** 1920×1080

---

## SEGMENT 1 — THE PROBLEM  [0:00 – 0:30]

**[SCREEN: Blank dark background or VS Code welcome screen]**

**[VOICE]**
> "AI agents are becoming infrastructure — they execute trades, write code, manage other agents. But how does a smart contract know whether to trust an AI agent with a high-value task?"

> "There's no on-chain track record. There's no way to verify performance claims without exposing the raw data. And in a multi-agent system, reputation is everything."

> "AAS — Agent Attestation Service — solves this with a two-tier on-chain credentialing system, built natively on Chainlink CRE."

**[DIRECTOR NOTE]:** Keep this tight. Speak over a static screen or a simple title card. No demos yet.

---

## SEGMENT 2 — ARCHITECTURE OVERVIEW  [0:30 – 1:00]

**[SCREEN: Open README.md in VS Code — scroll to "Core Flow" section]**

**[VOICE]**
> "Here's how it works."

> "An agent requests a STANDARD or VERIFIED attestation. A Chainlink CRE workflow is triggered — it fetches the agent's performance data using **Confidential HTTP inside a Trusted Execution Environment**, so the raw task counts never leave the enclave."

> "A Zero-Knowledge proof — UltraHonk via Noir — proves the agent met the tier thresholds, without revealing the actual numbers. That proof is submitted on-chain to our AASRegistry contract, which creates a tamper-proof EAS attestation."

> "Any smart contract — or any other agent — can verify that credential in a single call. No trust required."

**[SCREEN ACTION]:** While speaking, slowly scroll through the Core Flow code block in the README:
```
Agent requests STANDARD or VERIFIED attestation
  → CRE Workflow triggered with requested tier
  → Confidential HTTP fetches performance data (private, inside TEE)
  → ZK Proof generated (UltraHonk) with tier-specific thresholds
  → Tier-stamped EAS Attestation anchored on-chain
```

**[DIRECTOR NOTE]:** This is the architecture pitch. Stay on README no longer than 30 seconds total.

---

## SEGMENT 3 — CRE WORKFLOW DEEP DIVE  [1:00 – 2:30]

**[SCREEN: VS Code — `cre-workflows/attestation-issuance/main.ts`]**

**[VOICE]**
> "Let me show you the CRE workflow itself. This is Workflow A — Attestation Issuance."

**[SCREEN ACTION]:** Scroll to the `ConfidentialHTTPClient` block (~line 128–155). Highlight or zoom in on it.

**[VOICE]**
> "This is the core of the Chainlink Confidential Compute integration."

> "We use `ConfidentialHTTPClient.sendRequest()` — a CRE SDK capability that executes the HTTP request inside the TEE. The agent's raw performance data — task counts, success rates — is fetched here. It never leaves the enclave."

> "The Authorization header references a `PLATFORM_API_KEY` secret — injected by the Vault DON at runtime. In production, not even the node operator can see this value."

**[SCREEN ACTION]:** Scroll down ~20 lines to show the `EVMClient.writeReport()` / `runtime.report()` call.

**[VOICE]**
> "Once the ZK proof is ready, the workflow calls `runtime.report()` — a CRE signed report — which `EVMClient.writeReport()` commits on-chain. This is the CRE pattern for trustless on-chain writes: multi-node consensus before the transaction is submitted."

**[SCREEN ACTION]:** Switch to `cre-workflows/attestation-issuance/config.staging.json`

```json
{
  "registryAddress": "0x4a9e22A4402090ae445C166dD08Bd7C3A2725316",
  "zkVerifierAddress": "0xDA75a09F99FB19f44a72e414826ac3811E47EA88",
  "performanceApiUrl": "http://localhost:3002/api/performance",
  "chainSelectorName": "ethereum-testnet-sepolia",
  "gasLimit": "1000000"
}
```

**[VOICE]**
> "The workflow is pointed at our live Sepolia contracts — AASRegistry and AASZKVerifier — both deployed and Etherscan-verified."

---

## SEGMENT 4 — CRE WORKFLOW SIMULATION  [2:30 – 3:30]

**[SCREEN: Switch to Tab 1 — mock API terminal. Show it running.]**

**[VOICE]**
> "The mock Performance API is running on port 3002. This simulates the external agent platform CRE's Confidential HTTP would call in production. It has a VERIFIED-eligible agent pre-seeded — 150 tasks, 143 successes — a 95.3% success rate."

**[SCREEN ACTION]:** Switch to Tab 3 — the CRE workflow directory terminal.

**[VOICE]**
> "Now let's simulate the CRE workflow using the CRE CLI."

**[TYPE IN TERMINAL]:**
```bash
cre workflow simulate . -T staging-settings \
  --non-interactive --trigger-index 0 \
  --http-payload @/tmp/payload.json \
  --env ../../.env --broadcast
```

**[VOICE — while simulation runs (it completes in under 5 seconds)]:**
> "The CRE CLI compiles the workflow to WASM, initialises the simulated DON environment, and fires the HTTP trigger. Watch for the Confidential HTTP fetch to the mock API, the tier eligibility check, and the signed report."

**[SCREEN ACTION]:** Let the output scroll. Point out these lines as they appear:

```
✓ Workflow compiled
[SIMULATION] Simulator Initialized
[USER LOG] Attestation request: agent=0x12345678..., tier=VERIFIED
[USER LOG] Fetching performance data via Confidential HTTP...
[USER LOG] Performance: 150 tasks, 143 successes
[USER LOG] Eligible for VERIFIED tier
[USER LOG] Signed report generated, submitting on-chain...
[USER LOG] VERIFIED attestation submitted! TX: 0x77d43eefeb...

✓ Workflow Simulation Result:
{
  "success": true,
  "tier": "VERIFIED",
  "tx_hash": "0x77d43eefeb0f4f0dd5cc573525b99db8c5beebd7fd8c942f50c4fb86993b50ab"
}
```

**[VOICE — after output completes]:**
> "There — compiled, executed, eligibility confirmed. 150 tasks at 95.3% — VERIFIED threshold cleared. The workflow broadcast a real Sepolia transaction. That tx hash is live on-chain right now."

**[DIRECTOR NOTE]:** Simulation completes in ~5 seconds. `--broadcast` sends a real Sepolia TX — the `tx_hash` will be a real hash. `--env ../../.env` loads `CRE_ETH_PRIVATE_KEY` for signing. Without `--broadcast` you get a dry-run with `tx_hash: 0x0000...`.

---

## SEGMENT 5 — LIVE API + ON-CHAIN ATTESTATION  [3:30 – 4:10]

**[SCREEN: Switch to Tab 2 — API server terminal. Show it's connected to Sepolia.]**

**[VOICE]**
> "The AAS API server is running on port 3001, connected to Sepolia. Let's trigger a real end-to-end attestation."

**[SCREEN ACTION]:** Open a new terminal pane or Tab 4. Run:

```bash
curl -s -X POST http://localhost:3001/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0x0333a0c03b089abedc231883e3d7107eD955A2e2"}' | jq .
```

Expected output:
```json
{
  "status": "REGISTRATION_READY",
  "agent_id": "0xd0a1daf26c87899e67c5c6d8b91822a425a298d3498a525ac18258774f9ac0f3",
  "wallet_address": "0x0333a0c03b089abedc231883e3d7107eD955A2e2"
}
```

**[VOICE]:**
> "Register the agent — that derives a deterministic on-chain agent ID from the wallet address."

**[SCREEN ACTION]:** Then run:

```bash
curl -s -X POST http://localhost:3001/api/v1/attest \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "0xd0a1daf26c87899e67c5c6d8b91822a425a298d3498a525ac18258774f9ac0f3", "tier": "STANDARD"}' | jq .
```

Expected output:
```json
{
  "status": "ATTESTATION_CREATED",
  "tier": "STANDARD",
  "attestation_uid": "0x8999a9a5418c7803cab56ec816e059b1cd324f964963240a43d58ec81b0032dd",
  "tx_hash": "0xb9fed2f6311bb3e6aa84337cbe8e6ab53e9223985bcc3a178b0beee7bace00f1",
  "proof_type": "UltraHonk (real)"
}
```

**[VOICE — while it runs]:**
> "Request a STANDARD attestation. Under the hood: the API fetches performance data, checks eligibility, generates a real UltraHonk ZK proof, and submits it on-chain to AASRegistry."

**[VOICE — when result appears]:**
> "Attestation created. There's the EAS attestation UID and the live Sepolia transaction hash."

**[SCREEN ACTION]:** Switch to browser — Sepolia Etherscan AASRegistry contract, Events tab. Show the `AttestationCreated` event with that tx hash.

**[VOICE]:**
> "On-chain, verifiable by anyone. Now any smart contract or agent can call `verify` with a minimum tier."

**[SCREEN ACTION]:** Run in terminal:
```bash
curl -s "http://localhost:3001/api/v1/verify/0xd0a1daf26c87899e67c5c6d8b91822a425a298d3498a525ac18258774f9ac0f3?min_tier=STANDARD" | jq .
```

Expected output:
```json
{
  "verified": true,
  "tier": "STANDARD",
  "proof_valid": true,
  "attestations_valid": 1
}
```

**[VOICE]:**
> "Verified. ZK proof valid, tier confirmed. One call — no trust required."

---

## SEGMENT 6 — CLOSING: STACK + TESTS  [4:10 – 4:30]

**[SCREEN: Terminal — run the submission summary]**

```bash
npm run submission:summary
```

**[VOICE — while output prints]:**
> "To close — AAS is fully deployed on Sepolia. Three contracts, four EAS schemas, an IPFS reputation graph with the CID committed on-chain, and 60 Hardhat tests, 27 CRE workflow simulation tests, and 14 end-to-end smoke tests — all passing."

**[SCREEN ACTION]:** Point to the test results block in the output, then quickly cut to the GitHub repo in the browser.

**[VOICE]:**
> "All source is public on GitHub. The README links every Chainlink-integrated file."

> "AAS — verifiable trust for autonomous AI agents, powered by Chainlink CRE."

**[DIRECTOR NOTE]:** Hard cut to black. No music swell needed. Under 4:30.

---

## TOTAL TIMING SUMMARY

| Segment | Content | Time |
|---|---|---|
| 1 | Problem statement | 0:00 – 0:30 |
| 2 | Architecture / Core Flow | 0:30 – 1:00 |
| 3 | CRE workflow code (ConfidentialHTTP + writeReport) | 1:00 – 2:30 |
| 4 | `cre workflow simulate` live run | 2:30 – 3:30 |
| 5 | API attest → on-chain → verify | 3:30 – 4:10 |
| 6 | Submission summary + closing | 4:10 – 4:30 |
| **Total** | | **~4:30** |

---

## KEY CHAINLINK TALKING POINTS (say at least once each)

- **"ConfidentialHTTPClient"** — CRE SDK class, runs inside the TEE, raw data never leaves the enclave
- **"Vault DON secrets"** — API keys injected at runtime, not visible to node operators
- **"Trusted Execution Environment (TEE)"** — the privacy guarantee for Confidential Compute
- **"runtime.report() / EVMClient.writeReport()"** — CRE's trustless on-chain write pattern
- **"multi-node consensus"** — `consensusIdenticalAggregation` before the report lands on-chain
- **"EVMClient.callContract()"** — Workflow B's on-chain read pattern (mention briefly)

---

## POST-PRODUCTION NOTES

- **Edit out** any waiting time during `cre workflow simulate` if > 15 seconds
- **Zoom in** on the `ConfidentialHTTPClient.sendRequest()` block — it must be readable on screen
- Caption overlay on Segment 3: **"Chainlink Confidential Compute — raw data never leaves the TEE"**
- Caption overlay on Segment 4 when report appears: **"CRE multi-node signed report → on-chain"**
- No background music — keep it technical and clean
- Upload as unlisted YouTube or Loom, set to publicly viewable before submitting
