# Circuits

`src/transferValidity.zok` — a [ZoKrates](https://zokrates.github.io/)
circuit proving that a single balance transfer is valid (sender has enough
balance, and value is conserved: `senderAfter = senderBefore - amount`,
`recipientAfter = recipientBefore + amount`) without revealing the
sender's starting balance or the transferred amount.

## Why ZoKrates

The project's target stack doesn't name a circuit DSL. ZoKrates was chosen
because `zokrates-js` ships its compiler and Groth16 prover/verifier as a
self-contained WASM npm package — no separate native binary to fetch, which
matters in this environment (see `contracts/token/README.md` for the same
issue with Foundry/solc). It targets the bn128 curve, matching Ethereum's
`ecAdd`/`ecMul`/`ecPairing` precompiles, so proofs verify on any EVM chain
with a plain Solidity verifier contract — no custom precompiles or L1
changes needed.

## Scope

This is one building-block circuit (a single transfer step), not a full
batch/state-transition circuit that folds an entire block of transactions
into one proof against a Merkle state root — that's real future work, not
implemented here. Treat this as proof that the circuit → prover → on-chain
verifier pipeline works end to end, not as "the Hydro rollup's validity
proof."

## Security: this uses an insecure, non-ceremony setup

`npm run compile` calls ZoKrates' local `setup()`, which runs entirely on
this machine with no multi-party trusted-setup ceremony. Whoever runs it
holds the "toxic waste" and could forge proofs for this circuit. This is
normal and fine for development, but the resulting keys
(`build/proving.key`, `build/verifying.key.json`, and the verifier
contract deployed from them) must never be trusted with real value. A real
deployment needs an actual ceremony (e.g. Powers of Tau + circuit-specific
phase 2), run once, after which the keys are treated as fixed.

## Usage

```bash
npm install                              # from repo root
npm run compile:zk
```

Writes circuit artifacts to `build/` (gitignored — regenerate any time)
and the generated Solidity verifier to
`../verifier/contracts/TransferValidityVerifier.sol`.
