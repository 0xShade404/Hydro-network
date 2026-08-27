# RWA Example: Permissioned, Maturity-Redeemable Note

`HydroRWANote.sol` — a tokenized real-world-asset note (think a short-term
note or invoice), illustrating the two mechanics that distinguish an RWA
token from a plain ERC-20:

- **Compliance allowlist.** Only issuer-approved addresses can hold or
  receive notes. Revoking an address blocks its *future* transfers but
  does not affect notes it already holds — it can still redeem at
  maturity; removing compliance status isn't confiscation.
- **Funded, fixed-term redemption, not a promise.** At or after
  `maturityTimestamp`, a holder burns notes for a fixed payout
  (`redemptionRate`, set once at deployment, never changeable) in
  `redemptionAsset`. That payout can only come from what the issuer (or
  anyone) actually transfers in via `fundRedemption` — an under-funded
  maturity fails closed rather than paying out something the contract
  doesn't have. Same non-inflationary, solvency-first pattern as
  `contracts/staking`'s `addRewards`.

## What this is NOT

Illustrative, not a real security or compliance system: no real KYC/AML
integration, no legal wrapper, no oracle-verified off-chain asset
backing — this contract has no way to know whether the off-chain asset it
represents actually exists or is worth what it claims. `issue`/
`setAllowed`/`fundRedemption` are all a single owner key in this example;
a real deployment should put that behind something like
`contracts/governance` or a multisig, not a single EOA.

## Usage

```bash
npm install                                   # from repo root
npm run test --workspace=examples/rwa
npm run node:dev                               # separate terminal: local devnet
npm run deploy:local --workspace=examples/rwa
```

`deploy:local` deploys a 30-day note (5% redemption yield, payable in
HYDRO), allowlists and issues 10,000 HYD30 to the deployer, and funds the
redemption pool.

## Testing

9 tests cover: constructor validation (past maturity, zero rate),
access control on `setAllowed`/`issue`, issuance restricted to allowlisted
recipients, transfers blocked between non-allowlisted counterparties,
revocation blocking future transfers without touching existing balance,
redemption rejected before maturity, correct payout math after maturity,
an underfunded pool failing closed, and — the detail most likely to be
gotten wrong — a *revoked* holder still being able to redeem notes issued
before revocation. Also manually verified against a live devnet.
