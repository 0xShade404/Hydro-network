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
participation. None of these are implemented yet — the current contract is
a plain transferable ERC-20.

## Staking & Rewards

Not yet implemented (`contracts/staking`).

## Governance Rights

Not yet implemented (`contracts/governance`).
