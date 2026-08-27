import { expect } from "chai";
import { ethers } from "hardhat";
import { formatProofForContract, generateTransferProof } from "@hydro/zk-prover";

const E18 = 10n ** 18n;
const HYDRO = (n: bigint) => n * E18;

describe("HydroSettlement", () => {
  async function deployFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("HydroToken");
    const token = await tokenFactory.deploy(deployer.address);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    const verifierFactory = await ethers.getContractFactory("Verifier");
    const verifier = await verifierFactory.deploy();
    await verifier.waitForDeployment();

    const settlementFactory = await ethers.getContractFactory("HydroSettlement");
    const settlement = await settlementFactory.deploy(await verifier.getAddress(), tokenAddress);
    await settlement.waitForDeployment();
    const settlementAddress = await settlement.getAddress();

    // Realistic, whole-HYDRO amounts — the point of this contract now
    // being wired to a real 18-decimal token, not the old toy-sized
    // "100"/"10" raw-integer balances a uint64 ledger was stuck with.
    const aliceAmount = HYDRO(1_000_000n);
    const bobAmount = HYDRO(10_000n);

    await (await token.transfer(alice.address, aliceAmount)).wait();
    await (await token.transfer(bob.address, bobAmount)).wait();
    await (await token.connect(alice).approve(settlementAddress, aliceAmount)).wait();
    await (await token.connect(bob).approve(settlementAddress, bobAmount)).wait();
    await (await settlement.connect(alice).deposit(aliceAmount)).wait();
    await (await settlement.connect(bob).deposit(bobAmount)).wait();

    return { token, settlement, deployer, alice, bob, aliceAmount, bobAmount };
  }

  describe("deposit / withdraw (the bridge half)", () => {
    it("locks real HYDRO and credits the ledger 1:1", async () => {
      const { token, settlement, alice, aliceAmount } = await deployFixture();
      expect(await settlement.balances(alice.address)).to.equal(aliceAmount);
      expect(await token.balanceOf(await settlement.getAddress())).to.equal(
        await settlement.tokenBalance()
      );
    });

    it("keeps the contract's real token balance backing every ledger balance", async () => {
      const { token, settlement, aliceAmount, bobAmount } = await deployFixture();
      const totalLedger = aliceAmount + bobAmount;
      expect(await settlement.tokenBalance()).to.be.greaterThanOrEqual(totalLedger);
      expect(await token.balanceOf(await settlement.getAddress())).to.equal(await settlement.tokenBalance());
    });

    it("emits Deposited with the depositor and amount", async () => {
      const { token, settlement, deployer } = await deployFixture();
      const amount = HYDRO(500n);
      await (await token.approve(await settlement.getAddress(), amount)).wait();
      await expect(settlement.connect(deployer).deposit(amount))
        .to.emit(settlement, "Deposited")
        .withArgs(deployer.address, amount);
    });

    it("releases real HYDRO and debits the ledger on withdraw", async () => {
      const { token, settlement, alice, aliceAmount } = await deployFixture();
      const withdrawAmount = HYDRO(200_000n);
      const before = await token.balanceOf(alice.address);

      await expect(settlement.connect(alice).withdraw(withdrawAmount))
        .to.emit(settlement, "Withdrawn")
        .withArgs(alice.address, withdrawAmount);

      expect(await token.balanceOf(alice.address)).to.equal(before + withdrawAmount);
      expect(await settlement.balances(alice.address)).to.equal(aliceAmount - withdrawAmount);
    });

    it("rejects depositing or withdrawing zero", async () => {
      const { settlement, alice } = await deployFixture();
      await expect(settlement.connect(alice).deposit(0)).to.be.revertedWith("HydroSettlement: zero amount");
      await expect(settlement.connect(alice).withdraw(0)).to.be.revertedWith("HydroSettlement: zero amount");
    });

    it("rejects withdrawing more than the caller's ledger balance", async () => {
      const { settlement, bob, aliceAmount } = await deployFixture();
      await expect(settlement.connect(bob).withdraw(aliceAmount)).to.be.revertedWith(
        "HydroSettlement: insufficient ledger balance"
      );
    });

    it("rejects depositing without a sufficient prior approval", async () => {
      const { settlement, deployer } = await deployFixture();
      await expect(settlement.connect(deployer).deposit(HYDRO(1n))).to.be.reverted;
    });
  });

  describe("submitTransfer", () => {
    it("applies a transfer backed by a valid proof and emits TransferSettled", async () => {
      const { settlement, alice, bob, aliceAmount, bobAmount } = await deployFixture();
      const amount = HYDRO(300_000n);
      const senderAfter = aliceAmount - amount;
      const recipientAfter = bobAmount + amount;

      const proof = await generateTransferProof({
        senderBalanceBefore: aliceAmount,
        amount,
        senderBalanceAfter: senderAfter,
        recipientBalanceBefore: bobAmount,
        recipientBalanceAfter: recipientAfter,
      });
      const { proof: solidityProof } = formatProofForContract(proof);

      await expect(settlement.submitTransfer(alice.address, bob.address, senderAfter, recipientAfter, solidityProof))
        .to.emit(settlement, "TransferSettled")
        .withArgs(alice.address, bob.address, senderAfter, recipientAfter);

      expect(await settlement.balances(alice.address)).to.equal(senderAfter);
      expect(await settlement.balances(bob.address)).to.equal(recipientAfter);
    });

    it("rejects a proof whose claimed starting balances don't match on-chain state", async () => {
      const { settlement, alice, bob, aliceAmount, bobAmount } = await deployFixture();
      const wrongBefore = aliceAmount + HYDRO(1n); // she doesn't actually have this much
      const amount = HYDRO(30n);

      const proof = await generateTransferProof({
        senderBalanceBefore: wrongBefore,
        amount,
        senderBalanceAfter: wrongBefore - amount,
        recipientBalanceBefore: bobAmount,
        recipientBalanceAfter: bobAmount + amount,
      });
      const { proof: solidityProof } = formatProofForContract(proof);

      await expect(
        settlement.submitTransfer(alice.address, bob.address, wrongBefore - amount, bobAmount + amount, solidityProof)
      ).to.be.revertedWith("HydroSettlement: invalid proof");

      expect(await settlement.balances(alice.address)).to.equal(aliceAmount);
      expect(await settlement.balances(bob.address)).to.equal(bobAmount);
    });

    it("rejects a caller claiming different resulting balances than the proof actually covers", async () => {
      const { settlement, alice, bob, aliceAmount, bobAmount } = await deployFixture();
      const amount = HYDRO(30n);

      const proof = await generateTransferProof({
        senderBalanceBefore: aliceAmount,
        amount,
        senderBalanceAfter: aliceAmount - amount,
        recipientBalanceBefore: bobAmount,
        recipientBalanceAfter: bobAmount + amount,
      });
      const { proof: solidityProof } = formatProofForContract(proof);

      await expect(
        settlement.submitTransfer(alice.address, bob.address, aliceAmount - amount, HYDRO(999_999_999n), solidityProof)
      ).to.be.revertedWith("HydroSettlement: invalid proof");
    });

    it("prevents replaying the same proof after the ledger has moved on", async () => {
      const { settlement, alice, bob, aliceAmount, bobAmount } = await deployFixture();
      const amount = HYDRO(30n);
      const senderAfter = aliceAmount - amount;
      const recipientAfter = bobAmount + amount;

      const proof = await generateTransferProof({
        senderBalanceBefore: aliceAmount,
        amount,
        senderBalanceAfter: senderAfter,
        recipientBalanceBefore: bobAmount,
        recipientBalanceAfter: recipientAfter,
      });
      const { proof: solidityProof } = formatProofForContract(proof);

      await (
        await settlement.submitTransfer(alice.address, bob.address, senderAfter, recipientAfter, solidityProof)
      ).wait();

      await expect(
        settlement.submitTransfer(alice.address, bob.address, senderAfter, recipientAfter, solidityProof)
      ).to.be.revertedWith("HydroSettlement: invalid proof");
    });

    it("lets a recipient withdraw real HYDRO they only ever received via a settled transfer", async () => {
      const { token, settlement, alice, bob, aliceAmount, bobAmount } = await deployFixture();
      const amount = HYDRO(50_000n);
      const senderAfter = aliceAmount - amount;
      const recipientAfter = bobAmount + amount;

      const proof = await generateTransferProof({
        senderBalanceBefore: aliceAmount,
        amount,
        senderBalanceAfter: senderAfter,
        recipientBalanceBefore: bobAmount,
        recipientBalanceAfter: recipientAfter,
      });
      const { proof: solidityProof } = formatProofForContract(proof);
      await (
        await settlement.submitTransfer(alice.address, bob.address, senderAfter, recipientAfter, solidityProof)
      ).wait();

      const bobTokenBalanceBefore = await token.balanceOf(bob.address);
      await (await settlement.connect(bob).withdraw(recipientAfter)).wait();
      expect(await token.balanceOf(bob.address)).to.equal(bobTokenBalanceBefore + recipientAfter);
      expect(await settlement.balances(bob.address)).to.equal(0n);
    });
  });
});
