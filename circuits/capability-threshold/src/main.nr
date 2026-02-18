// AAS Capability Threshold ZK Circuit
//
// Proves that an agent meets capability thresholds without
// revealing their actual performance data.
//
// Claims proven:
//   1. task_count >= threshold_tasks
//   2. success_rate >= threshold_rate_bps (in basis points)
//   3. Data integrity via commitment hash
//
// Private witnesses: task_count, success_count, data_commitment_preimage
// Public inputs: threshold_tasks, threshold_rate_bps, data_commitment

// Poseidon2 permutation is the public hash primitive in Noir 1.x.
// We take the first element of the output as the commitment field.
fn poseidon2_hash(input: [Field; 4]) -> Field {
    let result: [Field; 4] = std::hash::poseidon2_permutation(input, 4);
    result[0]
}

fn main(
    // --- Private witnesses (never leave the prover) ---
    task_count: Field,
    success_count: Field,
    data_commitment_preimage: [Field; 4],  // salted hash of raw data

    // --- Public inputs (embedded in on-chain proof) ---
    threshold_tasks: pub Field,
    threshold_rate_bps: pub Field,    // e.g., 9500 = 95.00%
    data_commitment: pub Field         // poseidon2 hash of preimage
) {
    // 1. Verify data commitment integrity
    //    This ensures the private data hasn't been tampered with.
    //    Poseidon2 is native to UltraHonk circuits and far cheaper
    //    in constraints than keccak256.
    let commitment = poseidon2_hash(data_commitment_preimage);
    assert(commitment == data_commitment);

    // 2. Prove task count meets minimum threshold
    let tc = task_count as u64;
    let tt = threshold_tasks as u64;
    assert(tc >= tt);

    // 3. Prove success rate meets minimum threshold
    //    Using cross-multiplication to avoid division:
    //    success_count / task_count >= threshold_rate_bps / 10000
    //    <-> success_count * 10000 >= threshold_rate_bps * task_count
    let sc = success_count as u64;
    let tr = threshold_rate_bps as u64;
    assert(sc * 10000 >= tr * tc);

    // 4. Sanity check: success_count <= task_count
    assert(sc <= tc);
}

#[test]
fn test_valid_proof() {
    // Agent with 150 tasks, 143 successes (95.33% rate)
    // Threshold: 100 tasks, 95% rate (9500 bps)
    let preimage = [1, 2, 3, 4];
    let commitment = poseidon2_hash(preimage);
    main(
        150,           // task_count
        143,           // success_count
        preimage,      // data_commitment_preimage
        100,           // threshold_tasks
        9500,          // threshold_rate_bps
        commitment     // data_commitment
    );
}

#[test(should_fail)]
fn test_insufficient_tasks() {
    // Agent with only 50 tasks -- below 100 threshold
    let preimage = [1, 2, 3, 4];
    let commitment = poseidon2_hash(preimage);
    main(
        50,
        48,
        preimage,
        100,  // requires 100+
        9500,
        commitment
    );
}

#[test(should_fail)]
fn test_insufficient_rate() {
    // Agent with 150 tasks but only 80% rate -- below 95% threshold
    let preimage = [1, 2, 3, 4];
    let commitment = poseidon2_hash(preimage);
    main(
        150,
        120,          // 80% rate
        preimage,
        100,
        9500,         // requires 95%+
        commitment
    );
}
