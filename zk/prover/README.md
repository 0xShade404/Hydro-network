# Prover

Generates Groth16 proofs for `zk/circuits/src/transferValidity.zok`, using
the proving key produced by `zk/circuits`' local (non-ceremony) setup — see
`zk/circuits/README.md` for what that means and its limits.

```ts
import { generateTransferProof, formatProofForContract } from "@hydro/zk-prover";

const proof = await generateTransferProof({
  senderBalanceBefore: 100n,
  amount: 30n,
  senderBalanceAfter: 70n,
  recipientBalanceBefore: 10n,
  recipientBalanceAfter: 40n,
});

const { proof: solidityProof, input } = formatProofForContract(proof);
// verifier.verifyTx(solidityProof, input) — see zk/verifier
```

`generateTransferProof` throws instead of returning a proof when the
inputs don't satisfy the circuit (insufficient balance, or value isn't
conserved) — there is no valid witness in that case, so nothing to prove.

## Usage

```bash
npm install                     # from repo root
npm run compile:zk              # builds zk/circuits/build, needed below
npm run generate-example --workspace=zk/prover   # prints an example proof + calldata
npm run test:zk-prover
```
