import { expect } from "chai";
import { ethers } from "hardhat";
import { formatProofForContract, generateTransferProof } from "@hydro/zk-prover";

describe("HydroSettlement", () => {
  async function deployFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();

    const verifierFactory = await ethers.getContractFactory("Verifier");
    const verifier = await verifierFactory.deploy();
    await verifier.waitForDeployment();

    const settlementFactory = await ethers.getContractFactory("HydroSettlement");
    const settlement = await settlementFactory.deploy(await verifier.getAddress());
    await settlement.waitForDeployment();

    await (await settlement.fund(alice.address, 100)).wait();
    await (await settlement.fund(bob.address, 10)).wait();

    return { settlement, deployer, alice, bob };
  }

  it("only the owner can fund accounts", async () => {
    const { settlement, alice } = await deployFixture();
    await expect(
      settlement.connect(alice).fund(alice.address, 1_000_000)
    ).to.be.revertedWith("HydroSettlement: not owner");
  });

  it("applies a transfer backed by a valid proof and emits TransferSettled", async () => {
    const { settlement, alice, bob } = await deployFixture();

    const proof = await generateTransferProof({
      senderBalanceBefore: 100n,
      amount: 30n,
      senderBalanceAfter: 70n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });
    const { proof: solidityProof } = formatProofForContract(proof);

    await expect(settlement.submitTransfer(alice.address, bob.address, 70, 40, solidityProof))
      .to.emit(settlement, "TransferSettled")
      .withArgs(alice.address, bob.address, 70, 40);

    expect(await settlement.balances(alice.address)).to.equal(70);
    expect(await settlement.balances(bob.address)).to.equal(40);
  });

  it("rejects a proof whose claimed starting balances don't match on-chain state", async () => {
    const { settlement, alice, bob } = await deployFixture();

    // Proof claims alice started with 999, but she's only funded with 100.
    const proof = await generateTransferProof({
      senderBalanceBefore: 999n,
      amount: 30n,
      senderBalanceAfter: 969n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });
    const { proof: solidityProof } = formatProofForContract(proof);

    await expect(
      settlement.submitTransfer(alice.address, bob.address, 969, 40, solidityProof)
    ).to.be.revertedWith("HydroSettlement: invalid proof");

    // State is unchanged.
    expect(await settlement.balances(alice.address)).to.equal(100);
    expect(await settlement.balances(bob.address)).to.equal(10);
  });

  it("rejects a caller claiming different resulting balances than the proof actually covers", async () => {
    const { settlement, alice, bob } = await deployFixture();

    const proof = await generateTransferProof({
      senderBalanceBefore: 100n,
      amount: 30n,
      senderBalanceAfter: 70n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });
    const { proof: solidityProof } = formatProofForContract(proof);

    // Same valid proof, but the caller claims a different (more generous)
    // outcome than what was actually proved.
    await expect(
      settlement.submitTransfer(alice.address, bob.address, 70, 1_000_000, solidityProof)
    ).to.be.revertedWith("HydroSettlement: invalid proof");
  });

  it("prevents replaying the same proof after the ledger has moved on", async () => {
    const { settlement, alice, bob } = await deployFixture();

    const proof = await generateTransferProof({
      senderBalanceBefore: 100n,
      amount: 30n,
      senderBalanceAfter: 70n,
      recipientBalanceBefore: 10n,
      recipientBalanceAfter: 40n,
    });
    const { proof: solidityProof } = formatProofForContract(proof);

    await (await settlement.submitTransfer(alice.address, bob.address, 70, 40, solidityProof)).wait();

    // Replaying the exact same proof now fails: alice's on-chain balance
    // has moved to 70, so "senderBalanceBefore: 100" is no longer true.
    await expect(
      settlement.submitTransfer(alice.address, bob.address, 70, 40, solidityProof)
    ).to.be.revertedWith("HydroSettlement: invalid proof");
  });
});
