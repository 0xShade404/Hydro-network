# DePIN Example: Proof-of-Contribution Rewards

`HydroDePINRewards.sol` — node operators earn HYDRO for verified
physical-resource contribution (uptime, coverage, compute — whatever the
network measures), attested by a trusted `reporter` role. Reuses
`contracts/staking`'s exact reward-accrual mechanism (continuous
reward-per-unit accounting, funded rather than inflationary distribution)
with "reported contribution units" standing in for "staked balance" — the
same proven pattern, a different weighting input. Unlike a stake,
contribution can't be "unstaked" once reported, so there's no
`withdraw()` here — only `claimReward()`.

## The real engineering problem this doesn't solve

`reporter` is a single trusted address in this example. A real DePIN
network verifies physical contribution through some decentralized,
hard-to-forge process — multiple independent verifiers reaching
consensus, challenge-response protocols, ZK proofs of measurements — not
one address anyone has to trust. Building that verification layer is the
actual hard problem a DePIN project solves; this contract only
demonstrates what happens *after* contribution is verified: turning it
into a fair, funded reward claim, using the same solvency-conscious
funding pattern as `contracts/staking`.

## Usage

```bash
npm install                                     # from repo root
npm run test --workspace=examples/depin
npm run node:dev                                 # separate terminal: local devnet
npm run deploy:local --workspace=examples/depin
```

`deploy:local` deploys HydroToken and HydroDePINRewards (the deployer
acts as the reporter for the demo), funds a 500,000 HYDRO pool over 7
days, and reports demo contribution for two nodes.

## Testing

8 tests cover: access control on reporting vs. owner-only functions,
contribution accumulating correctly per node and in total, fair
proportional reward splitting between nodes (by contribution and time,
mirroring `contracts/staking`'s fairness test), correct claim payout,
a replaced reporter losing report access immediately, and leftover
unpaid rewards rolling into a new funding period instead of being lost.
Also manually verified against a live devnet.
