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

Note: contracts are compiled with the npm `solc` package instead of
Foundry/Hardhat's own downloader, because this environment's network policy
blocks `binaries.soliditylang.org`. See `contracts/token/README.md`.

Everything past that (staking, governance, treasury, ZK prover/verifier,
bridge, dashboard, DeFi/RWA/DePIN examples) is not yet built — follow the
build order above, one module at a time.
