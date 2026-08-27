# Staking Contracts

`HydroStaking.sol` — stake HYDRO, earn HYDRO. Designed around the holder,
not the protocol:

- **No lock-up.** Stake or withdraw any amount, any time. Rewards accrue
  continuously per second staked (the standard "Synthetix StakingRewards"
  reward-per-token pattern), so there's no snapshot/epoch to game by
  timing a deposit or withdrawal, and no reason to trap anyone's capital.
- **No inflation.** `HydroToken` has no mint function — this contract
  cannot create HYDRO out of thin air. Rewards only come from HYDRO the
  owner actually transfers in via `addRewards`. Staking here never
  dilutes non-stakers; it's a zero-sum redistribution of whatever the
  reward pool (e.g. tokenomics' "Staking & Security" allocation) is
  funded with.
- **Solvent by construction.** `addRewards` computes the reward rate from
  what was actually deposited and refuses to promise a rate the contract
  doesn't hold enough balance to cover on top of everyone's staked
  principal (`rewardRate * rewardsDuration <= balance - totalStaked`). A
  holder's staked balance can never be eaten into to pay someone else's
  rewards. In practice this check is close to unreachable through honest
  use of the public API (each `addRewards` call transfers in at least
  enough to cover the rate it sets) — it's a structural invariant guard,
  not a normally-triggered error path, which is also why the test suite
  doesn't force it.
- **`exit()`** withdraws everything and claims rewards in one transaction
  instead of two.

## What this is NOT

- Not locked/vested staking — no minimum duration, no early-exit penalty.
  If Hydro wants that later, it's a deliberate product decision to layer
  on, not a default a holder should be surprised by.
- Not multi-token: you stake HYDRO and earn HYDRO, not a separate rewards
  token.
- Not connected to governance (see `contracts/governance`, unbuilt) — no
  voting power from staking yet.

## Usage

```bash
npm install                                    # from repo root
npm run test --workspace=contracts/staking
npm run node:dev                                # separate terminal: local devnet
npm run deploy:local --workspace=contracts/staking
```

`deploy:local` deploys a fresh `HydroToken` and `HydroStaking`, then funds
the pool with a 1,000,000 HYDRO demo reward, distributed over 7 days.
