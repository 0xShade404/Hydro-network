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

**Also built:** a first settlement contract, `chain/settlement`'s
`HydroSettlement.sol` — an on-chain balances ledger that only updates when
a valid `zk/circuits` proof is submitted, checked against the contract's
own stored "before" balances rather than trusted blindly (so a proof
can't be replayed once the ledger has moved on, and a caller can't claim
an outcome the proof doesn't actually cover). It applies one proven
transfer at a time; there is no sequencer yet to batch transactions into
it. See `chain/settlement/README.md`.

**Planned:** a real Hydro sequencer (`chain/sequencer`) and node
(`chain/node`) that batch transactions and post a real
batch/state-transition proof, rather than applying one proven transfer at
a time — Phase 2 of `docs/roadmap.md`. The local devnet above is a
stand-in for development until that exists.

## ZK Layer (Circuits, Prover, Verifier)

**Built:** a first, minimal pipeline demonstrating circuit → prover →
on-chain verifier, using [ZoKrates](https://zokrates.github.io/):

- `zk/circuits/src/transferValidity.zok` — proves a single balance
  transfer is valid (sufficient balance, value conserved) without
  revealing the transferred amount. Balances are public inputs (needed so
  `chain/settlement` can check them against its own ledger) — see
  `zk/circuits/README.md`'s "Why balances are public".
- `zk/prover` — generates real Groth16 proofs against that circuit.
- `zk/verifier` — the generated Solidity verifier, deployed and checked
  on-chain via Ethereum's `ecAdd`/`ecMul`/`ecPairing` precompiles; tests
  cover accepting valid proofs and rejecting tampered/mismatched ones.

This is one building-block circuit, not a full batch/state-transition
circuit that proves an entire block of transactions against a Merkle
state root — that's still planned. The Groth16 setup used is local and
non-ceremony (see `zk/circuits/README.md`): fine for developing the
pipeline, not for securing real value — a production deployment needs an
actual trusted-setup ceremony first.

**Planned:** a batch/state-transition circuit proving a whole block against
a Merkle state root (rather than one transfer at a time), state root
posting, and a real prover service — Phase 2 of `docs/roadmap.md`.

## Smart Contract Layer

**Built:**
- `contracts/token/contracts/HydroToken.sol` — a fixed-supply ERC-20
  (371,000,000 HYDRO), no mint function. Also `ERC20Votes` + `ERC20Permit`
  (added for governance; purely additive). Compiled with the npm `solc`
  package rather than Foundry/Hardhat's own downloader — see
  `contracts/token/README.md` for why.
- `contracts/staking/contracts/HydroStaking.sol` — stake HYDRO, earn
  HYDRO, no lock-up, continuous per-second reward accrual, funded only by
  real transferred-in HYDRO (never minted). See `contracts/staking/README.md`
  for the holder-focused design rationale and the solvency guard that
  keeps staked principal from ever being used to pay rewards.
- `contracts/governance/contracts/HydroGovernor.sol` — token-weighted
  on-chain governance (OpenZeppelin `Governor` + `TimelockController`),
  currently governing `HydroStaking`'s owner-only functions. Checkpointed
  voting (no flash-loan governance), a timelock delay between a passed
  vote and execution, and no admin backdoor once deployment finishes. See
  `contracts/governance/README.md`.

**Planned:** treasury contracts (`contracts/treasury`).

## SDK & Client Integration

**Built:** `sdk/hydro-sdk` — a TypeScript client (viem-based) exposing a
Hydro chain definition and standard ERC-20 read/write helpers.

## Data Flow

**Token path:** `contracts/token` compiles HydroToken → deploy script or
SDK deploys it to the local devnet started by `chain/node` →
`sdk/hydro-sdk` reads and writes against it over standard JSON-RPC.
`tests/integration` exercises this whole path end-to-end.

**Settlement path:** `zk/circuits` compiles the circuit and generates the
`zk/verifier` Solidity verifier → `chain/settlement` deploys
`HydroSettlement` pointing at that verifier and seeds demo balances →
`zk/prover` generates a proof for a transfer against the settlement
contract's current on-chain balances → `HydroSettlement.submitTransfer`
checks that proof against its own stored state before applying it.
`chain/settlement/test` exercises this end-to-end, including the
proof-vs-state-mismatch and replay-rejection cases; it was also manually
verified against a live devnet (not just Hardhat's in-process test
network) while building it.
