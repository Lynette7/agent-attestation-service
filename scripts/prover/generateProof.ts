import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * AAS Proof Generator
 *
 * Generates UltraHonk proofs for the capability-threshold circuit
 * by shelling out to `nargo execute` and `bb prove`.
 *
 * Prerequisites:
 *   - `nargo` v1.0.0-beta.6+ on PATH
 *   - `bb` v0.84.0+ on PATH (typically at ~/.bb/bb)
 *   - Circuit compiled: `nargo compile` already run
 */

// ─── Paths ───────────────────────────────────────────────────────
const CIRCUIT_DIR = path.resolve(__dirname, "../../circuits/capability-threshold");
const TARGET_DIR = path.join(CIRCUIT_DIR, "target");
const ARTIFACT = path.join(TARGET_DIR, "capability_threshold.json");
const VK_PATH = path.join(TARGET_DIR, "vk");

export interface ProofInput {
  /** Number of tasks completed (private witness) */
  taskCount: number;
  /** Number of successful tasks (private witness) */
  successCount: number;
  /** Salt / preimage for data commitment — 4 field elements (private witness) */
  dataCommitmentPreimage: [bigint, bigint, bigint, bigint];
  /** Minimum task count threshold (public input) */
  thresholdTasks: number;
  /** Minimum success rate in bps, e.g. 9500 = 95% (public input) */
  thresholdRateBps: number;
  /** Poseidon2 hash of dataCommitmentPreimage (public input) */
  dataCommitment: bigint;
}

export interface ProofResult {
  /** Raw hex-encoded proof bytes (0x-prefixed) */
  proof: string;
  /** Public inputs as hex bytes32 strings (0x-prefixed, 32-byte padded) */
  publicInputs: string[];
  /** Whether proof generation succeeded */
  success: boolean;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Write a Prover.toml file with the given inputs.
 */
function writeProverToml(input: ProofInput): string {
  const tomlPath = path.join(CIRCUIT_DIR, "Prover.toml");

  const lines = [
    `task_count = "${input.taskCount}"`,
    `success_count = "${input.successCount}"`,
    `data_commitment_preimage = [${input.dataCommitmentPreimage
      .map((v) => `"${v}"`)
      .join(", ")}]`,
    `threshold_tasks = "${input.thresholdTasks}"`,
    `threshold_rate_bps = "${input.thresholdRateBps}"`,
    `data_commitment = "${input.dataCommitment}"`,
  ];

  fs.writeFileSync(tomlPath, lines.join("\n") + "\n");
  return tomlPath;
}

/**
 * Execute the circuit with `nargo execute` to generate the witness.
 */
function executeWitness(): string {
  const witnessPath = path.join(TARGET_DIR, "capability_threshold.gz");

  execSync("nargo execute", {
    cwd: CIRCUIT_DIR,
    stdio: "pipe",
    timeout: 30_000,
  });

  if (!fs.existsSync(witnessPath)) {
    throw new Error(`Witness not generated at ${witnessPath}`);
  }
  return witnessPath;
}

/**
 * Generate an UltraHonk proof using `bb prove`.
 */
function generateProof(witnessPath: string): string {
  const proofPath = path.join(TARGET_DIR, "proof");

  // Find bb binary — check PATH first, then common install location
  let bbBin = "bb";
  try {
    execSync("which bb", { stdio: "pipe" });
  } catch {
    const homeBb = path.join(
      process.env.HOME || "~",
      ".bb",
      "bb"
    );
    if (fs.existsSync(homeBb)) {
      bbBin = homeBb;
    } else {
      throw new Error(
        "bb binary not found. Install with: curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/installation/install | bash"
      );
    }
  }

  // bb prove -o takes a DIRECTORY — it writes "proof" and "public_inputs" files there
  execSync(
    `${bbBin} prove --scheme ultra_honk --oracle_hash keccak -b "${ARTIFACT}" -w "${witnessPath}" -o "${TARGET_DIR}"`,
    {
      cwd: CIRCUIT_DIR,
      stdio: "pipe",
      timeout: 120_000,
    }
  );

  if (!fs.existsSync(proofPath)) {
    throw new Error(`Proof not generated at ${proofPath}`);
  }
  return proofPath;
}

/**
 * Read the raw proof file and return hex-encoded bytes.
 */
function readProofHex(proofPath: string): string {
  const buf = fs.readFileSync(proofPath);
  return "0x" + buf.toString("hex");
}

/**
 * Convert a number/bigint to a 0x-prefixed 32-byte hex string.
 */
function toBytes32(value: number | bigint): string {
  const hex = BigInt(value).toString(16).padStart(64, "0");
  return "0x" + hex;
}

/**
 * Generate an UltraHonk proof for the capability-threshold circuit.
 *
 * @param input  Proof inputs (private witnesses + public inputs)
 * @returns      ProofResult with hex-encoded proof and public inputs
 *
 * @example
 * ```ts
 * const result = await generateCapabilityProof({
 *   taskCount: 150,
 *   successCount: 143,
 *   dataCommitmentPreimage: [1n, 2n, 3n, 4n],
 *   thresholdTasks: 100,
 *   thresholdRateBps: 9500,
 *   dataCommitment: 0x...n,  // poseidon2 hash
 * });
 * ```
 */
export async function generateCapabilityProof(
  input: ProofInput
): Promise<ProofResult> {
  try {
    // Validate inputs
    if (input.taskCount < input.thresholdTasks) {
      return {
        proof: "0x",
        publicInputs: [],
        success: false,
        error: `Task count ${input.taskCount} below threshold ${input.thresholdTasks}`,
      };
    }

    const rateBps = Math.floor(
      (input.successCount / input.taskCount) * 10000
    );
    if (rateBps < input.thresholdRateBps) {
      return {
        proof: "0x",
        publicInputs: [],
        success: false,
        error: `Success rate ${rateBps} bps below threshold ${input.thresholdRateBps} bps`,
      };
    }

    // 1. Write Prover.toml
    writeProverToml(input);

    // 2. Execute witness generation
    executeWitness();

    // 3. Generate UltraHonk proof
    const proofPath = generateProof(
      path.join(TARGET_DIR, "capability_threshold.gz")
    );

    // 4. Read proof bytes
    const proofHex = readProofHex(proofPath);

    // 5. Build public inputs array
    const publicInputs = [
      toBytes32(input.thresholdTasks),
      toBytes32(input.thresholdRateBps),
      toBytes32(input.dataCommitment),
    ];

    return { proof: proofHex, publicInputs, success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      proof: "0x",
      publicInputs: [],
      success: false,
      error: message,
    };
  }
}

/**
 * Verify a proof locally using `bb verify` (useful for testing
 * before submitting on-chain).
 */
export async function verifyProofLocally(): Promise<boolean> {
  try {
    let bbBin = "bb";
    try {
      execSync("which bb", { stdio: "pipe" });
    } catch {
      bbBin = path.join(process.env.HOME || "~", ".bb", "bb");
    }

    const proofPath = path.join(TARGET_DIR, "proof");
    execSync(
      `${bbBin} verify --scheme ultra_honk --oracle_hash keccak -k "${VK_PATH}" -p "${proofPath}"`,
      {
        cwd: CIRCUIT_DIR,
        stdio: "pipe",
        timeout: 60_000,
      }
    );
    return true;
  } catch {
    return false;
  }
}

// ─── CLI usage ───────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    console.log("Generating test proof...");

    // Compute the data commitment using nargo test (preimage = [1,2,3,4])
    // For CLI testing, pass a known commitment value
    // Poseidon2([1,2,3,4]) = 0x224785a48a72c75e2cbb698143e71d5d41bd89a2b9a7185871e39a54ce5785b1
    // Verified via: nargo test test_print_commitment --show-output
    const DATA_COMMITMENT = BigInt(
      "0x224785a48a72c75e2cbb698143e71d5d41bd89a2b9a7185871e39a54ce5785b1"
    );

    const result = await generateCapabilityProof({
      taskCount: 150,
      successCount: 143,
      dataCommitmentPreimage: [1n, 2n, 3n, 4n],
      thresholdTasks: 100,
      thresholdRateBps: 9500,
      dataCommitment: DATA_COMMITMENT,
    });

    if (result.success) {
      console.log("✓ Proof generated successfully!");
      console.log("  Proof length:", (result.proof.length - 2) / 2, "bytes");
      console.log("  Public inputs:", result.publicInputs);

      console.log("\nVerifying locally...");
      const valid = await verifyProofLocally();
      console.log(valid ? "✓ Proof verified!" : "✗ Verification failed");
    } else {
      console.error("✗ Proof generation failed:", result.error);
    }
  })();
}
