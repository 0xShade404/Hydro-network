# Tokenomics

## Token Overview

HYDRO — the Hydro network token. Implemented as a fixed-supply ERC-20 in
`contracts/token/contracts/HydroToken.sol` (see `contracts/token/README.md`).
There is no mint function, so supply cannot grow past the cap below.

## Supply & Distribution

Maximum supply: **371,000,000 HYDRO**.

Proposed allocation (not yet encoded on-chain — the token contract mints
the full supply to a single initial holder at deployment; splitting it
across these categories is a separate, not-yet-built step):

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

Treat these figures as proposed parameters until formally approved (see
`CLAUDE.md`).

## Vesting Schedule

Not yet defined or implemented.

## Utility

Intended uses: network gas, staking, governance, ecosystem incentives,
developer grants, DeFi liquidity, RWA settlement, DePIN payments, network
participation. Staking is now implemented (below); the rest are not yet —
`HydroToken` itself is still a plain transferable ERC-20 beyond that.

## Staking & Rewards

Implemented: `contracts/staking/contracts/HydroStaking.sol`. Stake HYDRO,
earn HYDRO, no lock-up (withdraw any amount, any time). Rewards accrue
continuously per second staked and are funded by whoever calls
`addRewards` (expected: the treasury, from the "Staking & Security"
allocation above) transferring real HYDRO in — this contract cannot mint,
so staking never inflates supply or dilutes non-stakers. See
`contracts/staking/README.md` for the full design and what it deliberately
doesn't do (no vesting/penalties, not wired to governance yet).

## Governance Rights

Implemented: `contracts/governance/contracts/HydroGovernor.sol`,
token-weighted on-chain governance built on OpenZeppelin's `Governor`
framework. One HYDRO delegated = one vote (checkpointed at proposal
creation, so tokens acquired after a proposal exists don't count for it).
Currently governs `contracts/staking`'s owner-only functions — its
ownership is transferred to a `TimelockController` at deployment, which
also enforces a delay between a passed vote and execution and has no
lingering admin key once set up. See `contracts/governance/README.md` for
the full design and what it deliberately protects against (flash-loan
voting, spam proposals, low-quorum capture, admin backdoors).
