# Settlement

`contracts/HydroSettlement.sol` — a minimal L1 settlement contract: an
on-chain ledger (`balances`) that only changes via `submitTransfer` (which
requires a valid `zk/circuits` `TransferValidity` proof) or `deposit`/
`withdraw` (which lock/release real HYDRO 1:1 against the ledger — the
bridge primitive `apps/bridge` is built on). This is the core pattern a
real rollup settlement contract uses — "accept a state transition only
with a valid proof," with every ledger balance actually backed by locked
funds — wired up end to end for the first time in this repo.

## Solvency: every ledger balance is real, locked HYDRO

An earlier version of this contract had an owner-only `fund()` faucet for
seeding demo balances, explicitly documented as not touching real HYDRO.
That was fine as a standalone demo, but it doesn't compose safely with a
real `withdraw()`: a `fund()`-created balance was never backed by
anything, so releasing real HYDRO against it would either revert or —
worse, if other balances happened to cover it — silently drain HYDRO that
real depositors had actually locked. `fund()` is gone; `deposit()` is the
only way to create a ledger balance now, and it always locks the matching
HYDRO first. `tokenBalance()` (the contract's real HYDRO balance) should
never fall below the sum of all ledger balances — `deposit` only credits
what it locks, `withdraw` only releases what it debits, and
`submitTransfer` only moves value between existing balances, never
creates or destroys it.

## What this is NOT

- **Not a batch/rollup settlement contract.** It applies one proven
  transfer at a time against its own balances mapping, not a whole block
  of transactions proven at once against a Merkle state root. That's a
  much bigger circuit and contract, still unbuilt.
- **Not connected to a sequencer.** `chain/sequencer` doesn't exist yet —
  nothing batches or orders transactions into this contract.
- **Not a real cross-chain bridge.** `deposit`/`withdraw` are the bridge
  *primitive* (lock real value, credit/debit a ledger 1:1) — but there's
  only one chain here, standing in for both L1 and L2. A real bridge also
  needs a second, actually-separate chain, L1 finality proofs for
  withdrawals, and typically a challenge period — none of that exists
  yet. See `apps/bridge/README.md`.
- **Not secure for real value.** The verifying key baked into the
  deployed `Verifier` comes from `zk/circuits`' local, non-ceremony
  Groth16 setup. See `zk/circuits/README.md`.

## How it checks proofs against real state

`submitTransfer(sender, recipient, senderBalanceAfter, recipientBalanceAfter, proof)`
reads `sender` and `recipient`'s *current* balances from its own storage,
builds the public-input array the circuit expects
(`[senderBefore, senderAfter, recipientBefore, recipientAfter, output]`)
from those on-chain values plus the caller's claimed new balances, and
only applies the update if `Verifier.verifyTx` accepts it. A proof can't
be replayed once the ledger has moved on (its "before" balance no longer
matches), and a caller can't submit a valid proof alongside a different
claimed outcome — see `test/HydroSettlement.test.ts` for both.

This is also why `zk/circuits/src/transferValidity.zok` makes all four
balances public inputs instead of keeping the sender's starting balance
private: a settlement contract can't check a value it was never shown.
See `zk/circuits/README.md`'s "Why balances are public".

## Usage

```bash
npm install                                   # from repo root
npm run compile:zk                             # generates the Verifier this depends on
npm run test --workspace=chain/settlement
npm run node:dev                                # separate terminal: local devnet
npm run deploy:local --workspace=chain/settlement
```
