# Hydro — Claude Development Instructions

You are the lead engineering agent for Hydro Network.

Hydro is a lightweight Ethereum-aligned ZK Layer 2 focused on:

- DeFi
- Real-World Assets
- DePIN
- Developer infrastructure

See `README.md` for the full project brief (vision, tokenomics, ecosystem,
roadmap).

## Repository layout

- `docs/` — protocol documentation (lite paper, tokenomics, architecture,
  roadmap, security).
- `contracts/` — on-chain smart contracts (token, staking, governance,
  treasury).
- `chain/` — L2 node, sequencer, and network configuration.
- `zk/` — zero-knowledge circuits, prover, and verifier.
- `sdk/hydro-sdk/` — client SDK for integrating with Hydro.
- `apps/` — end-user applications (explorer, bridge, dashboard).
- `examples/` — reference implementations for DeFi, RWA, and DePIN use cases.
- `scripts/` — developer and operational scripts.
- `tests/` — cross-package and integration tests.
- `.github/workflows/` — CI/CD pipelines.

## Engineering Priorities

1. Security
2. Correctness
3. Ethereum compatibility
4. Simplicity
5. Performance
6. Developer experience

## Never

- Invent security properties
- Claim mainnet readiness without testing
- Use unaudited custom cryptography unnecessarily
- Hard-code final tokenomics without approval
- Treat mocks as production implementations
- Skip tests to move faster

## Architecture

Prefer established components and standards wherever possible.

Target stack:

- Ethereum settlement
- EVM execution
- ZK validity proofs
- Solidity smart contracts
- Foundry for contract development
- TypeScript for SDK/tooling
- Rust/Go where appropriate for infrastructure
- Standard JSON-RPC
- Standard Ethereum wallet compatibility

## Development Process

For every major feature:

1. Explain the architecture.
2. Create an implementation plan.
3. Implement the smallest working version.
4. Write unit tests.
5. Write integration tests.
6. Run the test suite.
7. Document the implementation.
8. Identify security assumptions.
9. Only then mark the feature complete.

## Token

HYDRO maximum supply:

371,000,000

Current proposed allocation:

Community & Ecosystem: 25%
Treasury / DAO: 18%
Development & Grants: 15%
Staking & Security: 15%
Liquidity & Market Infrastructure: 10%
Strategic / Investors: 8%
Core Team & Founders: 7%
Advisors / Partners: 2%

Treat these figures as proposed parameters until formally approved.

## Product Direction

Hydro should become infrastructure that developers can use without
needing to understand the complexity of the underlying ZK system.

The user experience should feel familiar to Ethereum developers.

## First Milestone

Build a reproducible local Hydro development network with:

- EVM execution
- JSON-RPC
- block production
- wallet connectivity
- basic HYDRO token contract
- deployment scripts
- automated tests
- clear documentation

Do not begin with mainnet infrastructure.

Build the foundation first.

## Status

First milestone (local Hydro dev network) is built: EVM execution + JSON-RPC
+ block production via Hardhat Network (`chain/node`), the HydroToken
ERC-20 (`contracts/token`), a deploy script, the Hydro SDK
(`sdk/hydro-sdk`), a basic block explorer (`apps/explorer`), and unit +
integration tests (`npm run test:all`). The explorer was manually verified
against a live devnet in a real browser (Playwright), not just unit-tested.

A first ZK proof pipeline is also built: `zk/circuits` (one ZoKrates
circuit — a single transfer's validity, not a full batch/state-transition
circuit), `zk/prover` (real Groth16 proof generation), `zk/verifier` (the
generated Solidity verifier, tested with real on-chain pairing checks —
accepts valid proofs, rejects tampered/mismatched ones). Its Groth16 setup
is local and non-ceremony — fine for the pipeline demo, never for real
value. See `zk/circuits/README.md` for the full scope and security notes.

A first Ethereum settlement contract is also built: `chain/settlement`'s
`HydroSettlement.sol` maintains an on-chain balances ledger that only
updates when a valid `zk/circuits` proof is submitted, checked against the
contract's own stored "before" balances (not trusted blindly) — tested for
valid transfers applying correctly, mismatched-state proofs being
rejected, callers not being able to claim a different outcome than what
was proved, and proof replay being blocked once the ledger has moved on.
Verified against a live devnet, not just the in-process test network. This
required revising `transferValidity.zok` to make the sender's starting
balance a public input (previously private) — a settlement contract can't
check a value it was never shown; see `zk/circuits/README.md`'s "Why
balances are public" for the reasoning. It's one proven transfer at a
time, not a batched rollup — `chain/sequencer` still doesn't exist, and
there's still no real bridge moving actual HYDRO between L1 and this
ledger. See `chain/settlement/README.md`.

Notes on environment-specific workarounds:
- Contracts are compiled with the npm `solc` package instead of
  Foundry/Hardhat's own downloader, because this environment's network
  policy blocks `binaries.soliditylang.org`. See `contracts/token/README.md`.
- ZoKrates (`zokrates-js`) was chosen for circuits because it ships its
  compiler and prover as a self-contained WASM npm package, needing no
  separate binary download. See `zk/circuits/README.md`.

Everything past that (staking, governance, treasury, a real batch
state-transition circuit, a sequencer, a real L1↔L2 bridge, dashboard,
DeFi/RWA/DePIN examples) is not yet built — follow the build order above,
one module at a time.
