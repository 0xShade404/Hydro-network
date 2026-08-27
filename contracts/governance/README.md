# Governance Contracts

`HydroGovernor.sol` — token-weighted on-chain governance, built almost
entirely from OpenZeppelin's audited `Governor` framework (the same
pattern behind Compound, Uniswap, and most major DAOs) rather than custom
voting logic. It currently governs `contracts/staking`'s owner-only
functions (`addRewards`, `setRewardsDuration`) — HydroStaking's ownership
is transferred to the `TimelockController` at deployment, so those
functions are only reachable through a passed proposal from then on.

## Built with an investor's downside in mind

- **No flash-loan governance.** `HydroToken` is now `ERC20Votes`
  (checkpointed): a proposal's voting power is fixed at its snapshot
  block, not read live. Tokens acquired — or delegated — after that
  snapshot don't count for that vote. See
  `contracts/token/contracts/HydroToken.sol` and the
  "checkpoints historical voting power" / "does not count voting power
  delegated after a proposal's snapshot" tests.
- **A timelock, always.** Even a proposal that passes cannot execute
  immediately — `TimelockController` enforces a minimum delay
  (`scripts/deploy.ts` uses 2 days) between a successful vote and
  execution. That's a window to notice and react to something malicious
  before it takes effect, not just before it's proposed.
- **No admin backdoor after setup.** `scripts/deploy.ts` renounces the
  deployer's `DEFAULT_ADMIN_ROLE` on the timelock once roles are wired up.
  From that point, the timelock — and therefore `HydroStaking` — can only
  be controlled by a passed governance proposal, not by whoever deployed
  it.
- **Proposal threshold + quorum**, the two standard defenses against the
  two opposite failure modes: a threshold (1,000,000 HYDRO in
  `scripts/deploy.ts`, ~0.27% of supply) keeps spam/griefing proposals
  out; a 4% quorum keeps a small, unrepresentative minority from deciding
  outcomes that affect every holder.

## What this is NOT

- Not multi-asset or delegated-committee governance — one token, one
  voting weight (`getVotes`), the standard plutocratic model these
  parameters assume.
- Not yet wired to anything beyond `contracts/staking`. Extending it to
  govern `contracts/treasury` or protocol parameters elsewhere is just a
  matter of transferring that contract's ownership to the same timelock.
- Not audited. This reuses OpenZeppelin's audited primitives correctly (to
  the best of this review), but the composition itself — this specific
  contract, these specific parameters — has not had independent security
  review. Treat it as a working first version, not a production
  deployment, exactly per `CLAUDE.md`.

## Usage

```bash
npm install                                        # from repo root
npm run test --workspace=contracts/governance
npm run node:dev                                    # separate terminal: local devnet
npm run deploy:local --workspace=contracts/governance
```

`deploy:local` deploys HydroToken, HydroStaking, a TimelockController and
HydroGovernor, wires the roles, transfers HydroStaking's ownership to the
timelock, and renounces the deployer's admin role — the same end state a
real deployment should reach.

Note: `scripts/deploy.ts` uses realistic governance parameters (voting
delay/period sized for ~12s blocks, a 2-day timelock), which take far too
many blocks/real time to exercise interactively on a local devnet. The
test suite (`test/HydroGovernor.test.ts`) uses much smaller values purely
for speed — see the comment at the top of that file.
