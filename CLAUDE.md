# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## Project overview

Hydro is an Ethereum-aligned ZK Layer 2 built to power the next generation of
DeFi, RWA (Real World Assets), and DePIN (Decentralized Physical
Infrastructure Networks) applications. See `README.md` for the full project
brief (vision, tokenomics, ecosystem, roadmap).

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

## Role

Claude should act as the lead blockchain engineer on this project.

## Rules

1. Do not pretend unfinished components are production-ready.
2. Never invent cryptographic guarantees.
3. Never implement custom cryptography when audited primitives exist.
4. Prefer battle-tested Ethereum/ZK infrastructure.
5. Keep components modular.
6. Write tests before declaring components complete.
7. Document architectural decisions.
8. Keep all tokenomics configurable until formally approved.
9. Clearly mark mock/test implementations.
10. Security takes priority over speed of development.

## Build order

Start with:

1. Architecture
2. Local chain
3. EVM execution
4. HYDRO token
5. RPC
6. Basic explorer
7. ZK proof pipeline
8. Ethereum settlement
9. Staking
10. Governance
11. Bridge
12. SDK
13. DeFi/RWA/DePIN examples

Do not attempt to build the entire blockchain in one step.

Build one module at a time, test it, document it and then integrate it.

## Definition of done

A feature is only considered complete when:

- Code exists
- Tests exist
- Tests pass
- Documentation exists
- Security assumptions are documented
- Local deployment works
- Failure cases are tested
- No placeholder security mechanisms remain

## Status

This repository currently contains only the project scaffold. Implementation
has not started yet.
