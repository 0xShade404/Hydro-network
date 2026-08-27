import { expect } from "chai";
import { ethers } from "hardhat";
import { formatProofForContract, generateTransferProof } from "@hydro/zk-prover";

describe("TransferValidity Verifier (generated Groth16 verifier)", () => {
  async function deployFixture() {
    const factory = await ethers.getContractFactory("Verifier");
    const verifier = await factory.deploy();
    await verifier.waitForDeployment();
    return { verifier };
  }

  it("accepts a real proof of a valid transfer", async () => {
    const { verifier } = await deployFixture();

    const proof = await generateTransferProof({
      senderBalanceBefore: 100n,
      amount: 30n,
      senderBalanceAfter: 70n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });
    const { proof: solidityProof, input } = formatProofForContract(proof);

    const ok = await verifier.verifyTx(solidityProof, input);
    expect(ok).to.equal(true);
  });

  it("rejects the same proof if the public inputs are tampered with", async () => {
    const { verifier } = await deployFixture();

    const proof = await generateTransferProof({
      senderBalanceBefore: 100n,
      amount: 30n,
      senderBalanceAfter: 70n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });
    const { proof: solidityProof, input } = formatProofForContract(proof);

    // input is [senderBalanceBefore, senderBalanceAfter, recipientBalanceBefore, recipientBalanceAfter, output].
    // Claim the recipient started with a different balance than was actually proved.
    const tamperedInput = [...input];
    tamperedInput[2] = tamperedInput[2] + 1_000_000n;

    const ok = await verifier.verifyTx(solidityProof, tamperedInput);
    expect(ok).to.equal(false);
  });

  it("rejects a proof generated for a different transfer applied to different public inputs", async () => {
    const { verifier } = await deployFixture();

    const proofA = await generateTransferProof({
      senderBalanceBefore: 100n,
      amount: 30n,
      senderBalanceAfter: 70n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });
    const { proof: solidityProofA } = formatProofForContract(proofA);

    const proofB = await generateTransferProof({
      senderBalanceBefore: 500n,
      amount: 200n,
      senderBalanceAfter: 300n,
      recipientBalanceBefore: 0n,
      recipientBalanceAfter: 200n,
    });
    const { input: inputB } = formatProofForContract(proofB);

    const ok = await verifier.verifyTx(solidityProofA, inputB);
    expect(ok).to.equal(false);
  });
});
