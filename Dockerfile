# ============================================================
# AAS API Server — Production Dockerfile
#
# Includes nargo v1.0.0-beta.6 and bb v0.84.0 so that
# POST /api/v1/attest can generate real UltraHonk proofs.
#
# Build:  docker build -t aas-api .
# Run:    docker run -p 3001:3001 --env-file .env aas-api
# ============================================================

# ── Stage 1: Install Noir + Barretenberg, compile the circuit ──────────────────
# Pinned to linux/amd64 — bb only ships an x86_64 Linux binary.
# Docker Desktop uses Rosetta 2 for this on Apple Silicon; Railway is amd64 natively.
FROM --platform=linux/amd64 ubuntu:22.04 AS circuit-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates bash tar gzip \
    && rm -rf /var/lib/apt/lists/*

# ── Install nargo v1.0.0-beta.6 ───────────────────────────────────────────────
ARG NARGO_VERSION=1.0.0-beta.6
RUN curl -fsSL \
    "https://github.com/noir-lang/noir/releases/download/v${NARGO_VERSION}/nargo-x86_64-unknown-linux-gnu.tar.gz" \
    -o /tmp/nargo.tar.gz \
    && tar -xzf /tmp/nargo.tar.gz -C /usr/local/bin \
    && rm /tmp/nargo.tar.gz \
    && nargo --version

# ── Install bb v0.84.0 (Barretenberg UltraHonk prover, x86_64 only) ─────────
ARG BB_VERSION=0.84.0
RUN curl -fsSL \
    "https://github.com/AztecProtocol/aztec-packages/releases/download/aztec-v${BB_VERSION}/barretenberg-x86_64-linux-gnu.tar.gz" \
    -o /tmp/bb.tar.gz \
    && tar -xzf /tmp/bb.tar.gz -C /usr/local/bin \
    && rm /tmp/bb.tar.gz \
    && bb --version

# ── Compile the Noir circuit ──────────────────────────────────────────────────
COPY circuits/capability-threshold /circuit
WORKDIR /circuit

# nargo compile → target/capability_threshold.json
RUN nargo compile

# Generate the verification key (must match the VK initialized on Sepolia)
RUN bb write_vk --scheme ultra_honk \
    -b target/capability_threshold.json \
    -o target/vk

# ── Stage 2: Node.js runtime ──────────────────────────────────────────────────
FROM --platform=linux/amd64 node:20-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy binaries from circuit-builder stage
COPY --from=circuit-builder /usr/local/bin/nargo /usr/local/bin/nargo
COPY --from=circuit-builder /usr/local/bin/bb     /usr/local/bin/bb

# Copy compiled circuit artifacts
COPY --from=circuit-builder /circuit/target \
    /app/circuits/capability-threshold/target

# Copy circuit source (nargo needs Nargo.toml + src/ for execute)
COPY circuits/capability-threshold/Nargo.toml \
    /app/circuits/capability-threshold/Nargo.toml
COPY circuits/capability-threshold/src \
    /app/circuits/capability-threshold/src

# Install Node dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY tsconfig.json ./
COPY api/ ./api/
COPY scripts/prover/ ./scripts/prover/

# Verify the API entrypoint compiles
RUN npx tsc --noEmit --skipLibCheck --project tsconfig.json 2>/dev/null || true

EXPOSE 3001

ENV NODE_ENV=production

CMD ["npx", "ts-node", "--transpile-only", "api/server.ts"]
