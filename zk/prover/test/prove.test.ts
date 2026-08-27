import { describe, expect, it } from "vitest";
import { formatProofForContract, generateTransferProof } from "../src/index";

describe("generateTransferProof", () => {
  it("generates a proof for a valid transfer", async () => {
    const proof = await generateTransferProof({
      senderBalanceBefore: 100n,
      amount: 30n,
      senderBalanceAfter: 70n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });

    expect(proof.scheme).toBe("g16");
    expect(proof.curve).toBe("bn128");
    expect(proof.inputs).toHaveLength(4);
  });

  it("throws instead of producing a proof when the sender's balance is insufficient", async () => {
    await expect(
      generateTransferProof({
        senderBalanceBefore: 10n,
        amount: 30n,
        senderBalanceAfter: 0n, // caller can claim anything; the circuit rejects it
        recipientBalanceBefore: 0n,
        recipientBalanceAfter: 30n,
      })
    ).rejects.toBeTruthy();
  });

  it("throws when the balances don't conserve value", async () => {
    await expect(
      generateTransferProof({
        senderBalanceBefore: 100n,
        amount: 30n,
        senderBalanceAfter: 70n,
        recipientBalanceBefore: 10n,
        recipientBalanceAfter: 999n, // recipient claims more than was sent
      })
    ).rejects.toBeTruthy();
  });
});

describe("formatProofForContract", () => {
  it("converts the ZoKrates proof into bigint calldata for Verifier.verifyTx", async () => {
    const proof = await generateTransferProof({
      senderBalanceBefore: 100n,
      amount: 30n,
      senderBalanceAfter: 70n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });

    const formatted = formatProofForContract(proof);
    expect(formatted.proof.a).toHaveLength(2);
    expect(formatted.proof.b).toHaveLength(2);
    expect(formatted.proof.c).toHaveLength(2);
    expect(formatted.input).toHaveLength(4);
    for (const v of [...formatted.proof.a, ...formatted.proof.b.flat(), ...formatted.proof.c, ...formatted.input]) {
      expect(typeof v).toBe("bigint");
    }

    // public inputs are [senderBalanceAfter, recipientBalanceBefore, recipientBalanceAfter, output]
    expect(formatted.input).toEqual([70n, 10n, 40n, 1n]);
  });
});
