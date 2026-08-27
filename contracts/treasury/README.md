# Treasury Contracts

`HydroTreasury.sol` — a governance-gated vault for HYDRO (or any ERC-20)
and ETH. Intended owner is the same `TimelockController` that owns
`contracts/staking` (see `contracts/governance`), so treasury outflows
require a passed governance proposal, exactly like staking parameter
changes.

Deliberately minimal: this is a gated vault, not a budgeting or vesting
system. Every disbursement is a single owner-authorized transfer carrying
a human-readable `reason` in its event, so outflows are auditable by
anyone watching the chain — it doesn't track grant schedules, categories,
or streaming/vesting state. That's a natural extension once there's a
concrete need for it, not built preemptively here.

## Usage

```bash
npm install                                    # from repo root
npm run test --workspace=contracts/treasury
npm run node:dev                                # separate terminal: local devnet
npm run deploy:local --workspace=contracts/treasury
```

`deploy:local` deploys a standalone treasury owned by the deployer and
seeds it with demo HYDRO and ETH, for quick manual poking. A real
deployment should own it with a `TimelockController` from the start (or
`transferOwnership` immediately after deploying, the way
`contracts/governance/scripts/deploy.ts` does for `HydroStaking`) — see
the `becomes governance-gated once ownership moves to a timelock` test
for the exact pattern (schedule → wait → execute via the timelock,
disbursement unreachable any other way).
