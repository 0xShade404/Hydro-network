# Hydro Network

> Lightweight Ethereum-aligned ZK Layer 2 for DeFi, RWA and DePIN.

Hydro is designed to provide fast, low-cost and developer-friendly
blockchain infrastructure for the next generation of on-chain economic
applications.

## Vision

Hydro connects:

Ethereum
+
ZK scalability
+
DeFi
+
Real-World Assets
+
DePIN
=
A practical on-chain economy.

## Core Goals

1. Ethereum-compatible developer experience
2. ZK-based scalability
3. Low-cost transactions
4. Fast finality
5. Strong security
6. Developer-first tooling
7. Native support for DeFi, RWA and DePIN
8. Sustainable HYDRO token utility

---

# Technology

### Base Layer

Ethereum

### Execution

EVM-compatible ZK Layer 2

### Proof System

ZK validity proofs

### Smart Contracts

Solidity / EVM

### Data Availability

Ethereum-aligned DA architecture, configurable during implementation

### Infrastructure

- Sequencer
- Prover
- Verifier
- RPC nodes
- Block explorer
- Bridge
- SDK
- Developer tooling

---

# HYDRO Token

Maximum supply:

**371,000,000 HYDRO**

## Proposed Allocation

| Allocation | % | Tokens |
|---|---:|---:|
| Community & Ecosystem | 25% | 92.75M |
| Treasury / DAO | 18% | 66.78M |
| Development & Grants | 15% | 55.65M |
| Staking & Security | 15% | 55.65M |
| Liquidity & Market Infrastructure | 10% | 37.10M |
| Strategic / Investors | 8% | 29.68M |
| Core Team & Founders | 7% | 25.97M |
| Advisors / Partners | 2% | 7.42M |
| **Total** | **100%** | **371M** |

## HYDRO Utility

HYDRO should be used for:

- Network gas
- Staking
- Governance
- Ecosystem incentives
- Developer grants
- DeFi liquidity
- RWA settlement
- DePIN payments
- Network participation

The token should have genuine protocol utility rather than
depending solely on speculative demand.

---

# Ecosystem

## DeFi

Hydro should support:

- DEXs
- Lending
- Stablecoins
- Payments
- Yield markets
- Derivatives
- Cross-chain liquidity

## RWA

Potential applications include:

- Treasuries
- Private credit
- Real estate
- Commodities
- Revenue assets
- Tokenized business assets

## DePIN

Potential infrastructure markets include:

- Compute
- Storage
- Energy
- Connectivity
- Sensors
- Machines
- Mobility

---

# Developer Experience

Hydro should make Ethereum development familiar.

Developers should be able to:

- Deploy Solidity contracts
- Connect using standard EVM RPC
- Use MetaMask-compatible wallets
- Use existing Ethereum tooling
- Build with Hardhat / Foundry
- Query the chain through standard JSON-RPC
- Use the Hydro SDK
- Build ZK-enabled applications

---

# Project Principles

### Simple

Hydro should be understandable and easy to build on.

### Lightweight

Avoid unnecessary protocol complexity.

### Ethereum-aligned

Prioritize compatibility and credible settlement.

### Open

Developer tooling and documentation should be open source where
practical.

### Utility-first

Network growth should create real HYDRO utility.

### Security-first

No shortcuts around cryptography, bridges, token contracts or
network security.

---

# Development Roadmap

## Phase 1 — Foundation

- [ ] Repository setup
- [ ] Architecture specification
- [ ] Token contract
- [ ] Local development network
- [ ] Basic EVM RPC
- [ ] Wallet integration
- [ ] Developer documentation

## Phase 2 — ZK Infrastructure

- [ ] ZK prover
- [ ] Verifier
- [ ] Rollup architecture
- [ ] Sequencer
- [ ] Ethereum settlement
- [ ] Testnet

## Phase 3 — Ecosystem

- [ ] Explorer
- [ ] Bridge
- [ ] SDK
- [ ] DeFi examples
- [ ] RWA framework
- [ ] DePIN framework
- [ ] Developer grants

## Phase 4 — Mainnet

- [ ] Security audits
- [ ] Testnet stress testing
- [ ] Bug bounty
- [ ] Mainnet infrastructure
- [ ] Validator/sequencer decentralization
- [ ] Governance

---

# Status

**Stage:** Early Development — first milestone (local dev network) built

**Network:** Hydro

**Token:** HYDRO

**Maximum Supply:** 371,000,000

**Primary Focus:** DeFi + RWA + DePIN

**Settlement:** Ethereum

**Scaling:** ZK

## What's built

- **Local dev network** — EVM execution, JSON-RPC, block production
  (`chain/node`, `chain/config`). Run it with `npm run node:dev`.
- **HYDRO token contract** — fixed-supply ERC-20, 371,000,000 max supply,
  no mint function (`contracts/token`).
- **Deployment script** — `npm run deploy:local`.
- **Hydro SDK** — TypeScript client for reading/writing against the network
  (`sdk/hydro-sdk`).
- **Explorer** — a basic block explorer (latest blocks, block/tx detail,
  address + HYDRO balance lookup), reading the chain live via the SDK
  (`apps/explorer`). Run it with `npm run explorer:dev`.
- **ZK proof pipeline** — a first, minimal circuit
  (`zk/circuits/src/transferValidity.zok`, proving a single balance
  transfer is valid without revealing the amount), a prover
  (`zk/prover`) that generates real Groth16 proofs, and a generated
  Solidity verifier (`zk/verifier`) that checks them on-chain via
  Ethereum's pairing precompiles. This is one building-block circuit, not
  a full rollup batch/state-transition proof — see `zk/circuits/README.md`
  for exact scope, and its security note: the setup used is a local,
  non-ceremony Groth16 setup, fine for demonstrating the pipeline but not
  for securing real value.
- **Settlement contract** — `chain/settlement`'s `HydroSettlement.sol`, an
  on-chain ledger that only updates via `submitTransfer` (a valid
  `zk/circuits` proof, checked against the contract's own stored
  balances, not trusted blindly) or `deposit`/`withdraw` (which lock/
  release real HYDRO 1:1 — every ledger balance is backed by HYDRO the
  contract actually holds). One proven transfer at a time, not a batched
  rollup — see `chain/settlement/README.md` for exactly what it is and
  isn't.
- **Bridge** — `apps/bridge`: a UI for `HydroSettlement`'s deposit/
  withdraw primitive. There's one chain here standing in for both L1 and
  L2, so this isn't a real cross-chain bridge yet — see
  `apps/bridge/README.md`. Run it with `npm run bridge:dev`.
- **Staking** — `contracts/staking`'s `HydroStaking.sol`: stake HYDRO,
  earn HYDRO, no lock-up, continuous per-second rewards, funded only by
  real transferred-in HYDRO (the contract can't mint, so staking never
  dilutes non-stakers). See `contracts/staking/README.md`.
- **Governance** — `contracts/governance`'s `HydroGovernor.sol`:
  token-weighted on-chain governance (OpenZeppelin `Governor` +
  `TimelockController`), currently governing `HydroStaking`'s owner-only
  functions. Checkpointed voting power (no flash-loan governance), a
  timelock delay between a passed vote and execution, and no admin
  backdoor once deployment finishes. `HydroToken` gained `ERC20Votes` +
  `ERC20Permit` to support this. See `contracts/governance/README.md`.
- **Treasury** — `contracts/treasury`'s `HydroTreasury.sol`: a
  governance-gated vault for HYDRO/ETH, every disbursement a single
  owner-authorized transfer with an on-chain event. See
  `contracts/treasury/README.md`.
- **Tests** — 90 tests total (`npm run test:all`): contract unit tests,
  SDK unit tests, explorer + bridge component tests, an end-to-end
  integration test covering network + contract + SDK, ZK prover/verifier
  tests (real on-chain pairing checks), settlement tests (valid
  transfers/deposits/withdrawals applied, mismatched/replayed proofs
  rejected, ledger balances always backed by real locked HYDRO), staking
  tests (reward fairness, no forfeiting rewards on withdrawal, leftover-
  reward rollover), governance tests (full propose/vote/queue/execute
  flow, proposal threshold, quorum, snapshot-based anti-flash-loan
  protection, timelock delay enforcement), and treasury tests (access
  control, correct disbursement, governance-gating).

Everything else in this README (a real cross-chain bridge, DeFi/RWA/DePIN
examples, a full rollup state-transition circuit, a sequencer) is design/
roadmap, not yet implemented.
See `CLAUDE.md` for the build order and `docs/architecture.md` for a
build-by-build breakdown.

---

## Disclaimer

This repository describes an evolving technical and economic design.
Token allocations, mechanisms, network architecture and deployment
parameters may change following technical, economic, security and
regulatory review.
