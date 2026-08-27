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
time, not a batched rollup — `chain/sequencer` still doesn't exist. See
`chain/settlement/README.md`.

`HydroSettlement` and the circuit were later revised again, this time for
correctness: the ledger and circuit used `uint64`/ZoKrates `u64`, which
overflows at ~18 whole HYDRO once real 18-decimal amounts are involved —
fine for toy test balances, unusable for anything a real holder would
have. The circuit now uses ZoKrates' native `field` type (comfortably
larger than the entire 371M-HYDRO supply); the contract uses `uint256`.
At the same time, `HydroSettlement` gained real `deposit`/`withdraw`
functions that lock/release actual HYDRO 1:1 against the ledger — the
bridge primitive `apps/bridge` is built on — and the old owner-only
`fund()` faucet was removed, since it let the owner credit ledger balance
that was never backed by real locked HYDRO, an insolvency gap once a real
`withdraw()` existed. 12 settlement tests now cover deposit/withdraw
(locking real tokens, insufficient-balance/approval rejection) alongside
the original proof-checking tests, all using realistic 18-decimal
amounts. `apps/bridge` is a UI on top: connect a local-devnet account
(pasting a private key — no real wallet-extension support yet, see
`apps/bridge/README.md` for why) and deposit/withdraw HYDRO between
wallet and ledger. `@hydro/sdk` gained `depositToSettlement`,
`withdrawFromSettlement`, `getSettlementBalance` for this. Manually
verified end-to-end in a real browser against a live devnet: real
deposit and withdraw transactions moved the exact expected amounts.

A first treasury contract is also built: `contracts/treasury`'s
`HydroTreasury.sol` — a governance-gated vault for HYDRO (or any ERC-20)
and ETH. Deliberately minimal: every disbursement is a single
owner-authorized transfer carrying a human-readable reason in its event,
not a budgeting or vesting system. 9 tests cover access control, correct
disbursement, insufficient-balance safety, and the actual
governance-gating pattern (ownership transferred to a `TimelockController`,
disbursement only reachable via schedule → wait → execute). Verified
against a live devnet too. See `contracts/treasury/README.md`. This
completes the `contracts/` set (token, staking, governance, treasury).

A first staking contract is also built: `contracts/staking`'s
`HydroStaking.sol` — stake HYDRO, earn HYDRO, no lock-up, continuous
per-second reward accrual (the standard Synthetix StakingRewards pattern,
not a novel mechanism). Built with the holder's interests as the explicit
design driver, not the protocol's: rewards can only come from HYDRO an
owner actually transfers in via `addRewards` (the token has no mint
function, so staking can never inflate supply or dilute non-stakers), and
`addRewards` refuses to promise a reward rate the contract can't actually
cover on top of everyone's staked principal — a holder's stake can never
be eaten into to pay someone else's rewards. 10 tests cover reward
fairness between multiple stakers (proportional to stake size and time,
not gameable by timing since there's no snapshot/epoch), rewards
surviving a withdrawal unclaimed, and leftover rewards rolling into a new
funding period instead of being lost. Verified against a live devnet too.
See `contracts/staking/README.md`.

A first governance contract is also built: `contracts/governance`'s
`HydroGovernor.sol` — token-weighted on-chain governance built almost
entirely from OpenZeppelin's audited `Governor` + `TimelockController`
framework rather than custom voting logic, currently governing
`contracts/staking`'s owner-only functions (its ownership is transferred
to the timelock at deployment). Built with an investor's downside
explicitly in mind: voting power is checkpointed via `HydroToken`'s new
`ERC20Votes` (tokens acquired or delegated after a proposal's snapshot
don't count for it — no flash-loan governance), a timelock delay sits
between a passed vote and execution (time to react before anything
happens), a proposal threshold keeps out spam, a quorum requirement keeps
a low-turnout minority from deciding outcomes, and the deployer's timelock
admin role is renounced once setup finishes (no lingering backdoor). 7
tests cover the full propose/vote/queue/execute flow, threshold and
quorum rejection, the snapshot protection specifically, and the timelock
delay actually blocking early execution. Verified against a live devnet
too. `HydroToken` gained `ERC20Votes` + `ERC20Permit` for this — both
purely additive, existing balances/transfers unaffected. See
`contracts/governance/README.md`.

Notes on environment-specific workarounds:
- Contracts are compiled with the npm `solc` package instead of
  Foundry/Hardhat's own downloader, because this environment's network
  policy blocks `binaries.soliditylang.org`. See `contracts/token/README.md`.
- ZoKrates (`zokrates-js`) was chosen for circuits because it ships its
  compiler and prover as a self-contained WASM npm package, needing no
  separate binary download. See `zk/circuits/README.md`.
- `@openzeppelin/contracts` (pinned `^5.0.2`, currently resolving to
  5.6.x) uses the MCOPY opcode in some utilities, so every package's
  `scripts/compile.ts` sets `evmVersion: "cancun"` explicitly.

One example each for DeFi, RWA, and DePIN is also built, each a real,
tested primitive rather than a full product:

- `examples/defi`'s `HydroSwapPair.sol` — a constant-product AMM (Uniswap
  V2's `x*y=k` math and 0.3% fee, not a novel pricing mechanism) for a
  HYDRO/mock-stablecoin pair. 8 tests cover first-deposit LP minting
  (`sqrt(x*y)` with the minimum-liquidity burn), proportional minting on
  later deposits, swap correctness, the constant product `k` strictly
  increasing after a swap (proof the fee is retained), slippage
  protection, and withdrawal returning current (fee-inclusive) balances.
- `examples/rwa`'s `HydroRWANote.sol` — a permissioned note token: only
  issuer-allowlisted addresses can hold/transfer it, and it redeems for a
  fixed payout in a real asset (HYDRO) at a fixed maturity, funded rather
  than promised (an underfunded maturity fails closed, never pays out
  something the contract doesn't hold). 9 tests include the detail most
  likely to get wrong: a holder whose compliance status is later revoked
  can still redeem notes they already legitimately held — revocation
  blocks future transfers, it isn't confiscation.
- `examples/depin`'s `HydroDePINRewards.sol` — reuses
  `contracts/staking`'s exact funded, non-inflationary reward-accrual
  mechanism, with reporter-attested contribution units standing in for
  staked balance. 8 tests mirror staking's fairness coverage. Documented
  explicitly: the single trusted `reporter` role is the one thing a real
  DePIN network can't simplify away — this only demonstrates what happens
  *after* contribution is verified.

All three were verified against a live devnet too.

Everything past that (a real batch state-transition circuit, a sequencer,
a real two-chain L1↔L2 bridge, a dashboard app) is not yet built — follow
the build order above, one module at a time.
