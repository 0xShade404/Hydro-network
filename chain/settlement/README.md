# Settlement

`contracts/HydroSettlement.sol` — a minimal L1 settlement contract: an
on-chain ledger (`balances`) that only changes when someone submits a valid
`zk/circuits` `TransferValidity` proof. This is the core pattern a real
rollup settlement contract uses — "accept a state transition only with a
valid proof" — wired up end to end for the first time in this repo.

## What this is NOT

- **Not a batch/rollup settlement contract.** It applies one proven
  transfer at a time against its own balances mapping, not a whole block
  of transactions proven at once against a Merkle state root. That's a
  much bigger circuit and contract, still unbuilt.
- **Not connected to a sequencer.** `chain/sequencer` doesn't exist yet —
  nothing batches or orders transactions into this contract.
- **Not connected to `HydroToken`.** `fund()` is a dev-only owner faucet
  for seeding demo balances; there's no real L1↔L2 bridge moving actual
  HYDRO tokens in or out yet (see `apps/bridge`, also unbuilt).
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
