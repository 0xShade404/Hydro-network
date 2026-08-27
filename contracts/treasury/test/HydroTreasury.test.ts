import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("HydroTreasury", () => {
  async function deployFixture() {
    const [deployer, recipient, other] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("HydroToken");
    const token = await tokenFactory.deploy(deployer.address);
    await token.waitForDeployment();

    const treasuryFactory = await ethers.getContractFactory("HydroTreasury");
    const treasury = await treasuryFactory.deploy(deployer.address);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();

    const seed = ethers.parseUnits("100000", 18);
    await (await token.transfer(treasuryAddress, seed)).wait();
    await (await deployer.sendTransaction({ to: treasuryAddress, value: ethers.parseEther("5") })).wait();

    return { token, treasury, deployer, recipient, other, seed };
  }

  it("accepts ETH via plain transfer and emits EthReceived", async () => {
    const [deployer] = await ethers.getSigners();
    const treasuryFactory = await ethers.getContractFactory("HydroTreasury");
    const treasury = await treasuryFactory.deploy(deployer.address);
    await treasury.waitForDeployment();

    await expect(deployer.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("1") }))
      .to.emit(treasury, "EthReceived")
      .withArgs(deployer.address, ethers.parseEther("1"));
  });

  it("reports token balances via tokenBalance", async () => {
    const { token, treasury, seed } = await deployFixture();
    expect(await treasury.tokenBalance(await token.getAddress())).to.equal(seed);
  });

  it("lets the owner disburse tokens, emitting the reason", async () => {
    const { token, treasury, deployer, recipient } = await deployFixture();
    const amount = ethers.parseUnits("1000", 18);

    await expect(
      treasury.connect(deployer).disburseToken(await token.getAddress(), recipient.address, amount, "grant #1")
    )
      .to.emit(treasury, "TokenDisbursed")
      .withArgs(await token.getAddress(), recipient.address, amount, "grant #1");

    expect(await token.balanceOf(recipient.address)).to.equal(amount);
  });

  it("lets the owner disburse ETH, emitting the reason", async () => {
    const { treasury, deployer, recipient } = await deployFixture();
    const amount = ethers.parseEther("1");
    const before = await ethers.provider.getBalance(recipient.address);

    await expect(treasury.connect(deployer).disburseEth(recipient.address, amount, "grant #2"))
      .to.emit(treasury, "EthDisbursed")
      .withArgs(recipient.address, amount, "grant #2");

    expect(await ethers.provider.getBalance(recipient.address)).to.equal(before + amount);
  });

  it("rejects disbursement from non-owners", async () => {
    const { token, treasury, other, recipient } = await deployFixture();
    await expect(
      treasury.connect(other).disburseToken(await token.getAddress(), recipient.address, 1, "")
    ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    await expect(
      treasury.connect(other).disburseEth(recipient.address, 1, "")
    ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
  });

  it("rejects zero recipient and zero amount", async () => {
    const { token, treasury, deployer, recipient } = await deployFixture();
    await expect(
      treasury.connect(deployer).disburseToken(await token.getAddress(), ethers.ZeroAddress, 1, "")
    ).to.be.revertedWith("HydroTreasury: zero recipient");
    await expect(
      treasury.connect(deployer).disburseToken(await token.getAddress(), recipient.address, 0, "")
    ).to.be.revertedWith("HydroTreasury: zero amount");
    await expect(
      treasury.connect(deployer).disburseEth(recipient.address, 0, "")
    ).to.be.revertedWith("HydroTreasury: zero amount");
  });

  it("rejects disbursing more ETH than the treasury holds", async () => {
    const { treasury, deployer, recipient } = await deployFixture();
    await expect(
      treasury.connect(deployer).disburseEth(recipient.address, ethers.parseEther("1000"), "")
    ).to.be.revertedWith("HydroTreasury: insufficient ETH balance");
  });

  it("rejects disbursing more tokens than the treasury holds", async () => {
    const { token, treasury, deployer, recipient, seed } = await deployFixture();
    await expect(
      treasury.connect(deployer).disburseToken(await token.getAddress(), recipient.address, seed + 1n, "")
    ).to.be.reverted;
  });

  it("becomes governance-gated once ownership moves to a timelock", async () => {
    const { token, treasury, deployer, recipient } = await deployFixture();
    const treasuryAddress = await treasury.getAddress();

    const timelockFactory = await ethers.getContractFactory("TimelockController");
    const timelock = await timelockFactory.deploy(1, [deployer.address], [deployer.address], deployer.address);
    await timelock.waitForDeployment();
    const timelockAddress = await timelock.getAddress();

    await (await treasury.connect(deployer).transferOwnership(timelockAddress)).wait();
    expect(await treasury.owner()).to.equal(timelockAddress);

    // The original deployer can no longer disburse directly.
    const amount = ethers.parseUnits("500", 18);
    await expect(
      treasury.connect(deployer).disburseToken(await token.getAddress(), recipient.address, amount, "")
    ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");

    // Only via a scheduled + executed timelock operation.
    const calldata = treasury.interface.encodeFunctionData("disburseToken", [
      await token.getAddress(),
      recipient.address,
      amount,
      "governed grant",
    ]);
    const salt = ethers.ZeroHash;
    await (
      await timelock.connect(deployer).schedule(treasuryAddress, 0, calldata, ethers.ZeroHash, salt, 1)
    ).wait();
    await time.increase(2);
    await (await timelock.connect(deployer).execute(treasuryAddress, 0, calldata, ethers.ZeroHash, salt)).wait();

    expect(await token.balanceOf(recipient.address)).to.equal(amount);
  });
});
