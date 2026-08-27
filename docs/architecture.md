# Architecture

## System Overview

Hydro is an Ethereum-aligned ZK Layer 2. Only the first milestone — a local
EVM development network plus the basic HYDRO token — is implemented so far;
the sections below note what's built vs. planned.

## Chain Layer (Node & Sequencer)

**Built:** a local development network via Hardhat Network
(`contracts/token/hardhat.config.ts`, run with `npm run node:dev`). It
provides standard EVM execution, JSON-RPC, and auto-mined block production
on a provisional devnet chain id (`90731`, see `chain/config/local.json`).

**Planned:** a real Hydro sequencer and node (`chain/sequencer`,
`chain/node`) with Ethereum settlement and ZK validity proofs — Phase 2 of
`docs/roadmap.md`. The local devnet above is a stand-in for development
until that exists.

## ZK Layer (Circuits, Prover, Verifier)

Not built yet (`zk/circuits`, `zk/prover`, `zk/verifier`). Planned for
Phase 2.

## Smart Contract Layer

**Built:** `contracts/token/contracts/HydroToken.sol` — a fixed-supply
ERC-20 (371,000,000 HYDRO), no mint function. Compiled with the npm `solc`
package rather than Foundry/Hardhat's own downloader — see
`contracts/token/README.md` for why.

**Planned:** staking, governance, and treasury contracts
(`contracts/staking`, `contracts/governance`, `contracts/treasury`).

## SDK & Client Integration

**Built:** `sdk/hydro-sdk` — a TypeScript client (viem-based) exposing a
Hydro chain definition and standard ERC-20 read/write helpers.

## Data Flow

Today: `contracts/token` compiles HydroToken → deploy script or SDK deploys
it to the local devnet started by `chain/node` → `sdk/hydro-sdk` reads and
writes against it over standard JSON-RPC. `tests/integration` exercises this
whole path end-to-end.
