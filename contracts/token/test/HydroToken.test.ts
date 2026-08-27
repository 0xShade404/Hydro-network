import { expect } from "chai";
import { ethers } from "hardhat";

describe("HydroToken", () => {
  const MAX_SUPPLY = 371_000_000n * 10n ** 18n;

  async function deployFixture() {
    const [deployer, treasury, alice, bob] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("HydroToken");
    const token = await factory.deploy(treasury.address);
    await token.waitForDeployment();
    return { token, deployer, treasury, alice, bob };
  }

  it("sets name, symbol and decimals", async () => {
    const { token } = await deployFixture();
    expect(await token.name()).to.equal("Hydro");
    expect(await token.symbol()).to.equal("HYDRO");
    expect(await token.decimals()).to.equal(18);
  });

  it("mints the full max supply to the initial holder at deployment", async () => {
    const { token, treasury } = await deployFixture();
    expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    expect(await token.balanceOf(treasury.address)).to.equal(MAX_SUPPLY);
  });

  it("exposes MAX_SUPPLY as a constant matching total supply", async () => {
    const { token } = await deployFixture();
    expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
  });

  it("rejects deployment with a zero-address initial holder", async () => {
    const factory = await ethers.getContractFactory("HydroToken");
    await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWith(
      "HydroToken: zero initial holder"
    );
  });

  it("has no public mint function beyond construction", async () => {
    const { token } = await deployFixture();
    const hasMint = token.interface.fragments.some(
      (f: { type: string; name?: string }) => f.type === "function" && f.name === "mint"
    );
    expect(hasMint).to.equal(false);
  });

  it("transfers tokens between accounts and updates balances", async () => {
    const { token, treasury, alice } = await deployFixture();
    const amount = 1_000n * 10n ** 18n;

    await expect(token.connect(treasury).transfer(alice.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(treasury.address, alice.address, amount);

    expect(await token.balanceOf(alice.address)).to.equal(amount);
    expect(await token.balanceOf(treasury.address)).to.equal(MAX_SUPPLY - amount);
  });

  it("reverts when transferring more than the sender's balance", async () => {
    const { token, alice, bob } = await deployFixture();
    await expect(
      token.connect(alice).transfer(bob.address, 1n)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("supports approve/transferFrom allowances", async () => {
    const { token, treasury, alice, bob } = await deployFixture();
    const amount = 500n * 10n ** 18n;

    await token.connect(treasury).approve(alice.address, amount);
    expect(await token.allowance(treasury.address, alice.address)).to.equal(amount);

    await token.connect(alice).transferFrom(treasury.address, bob.address, amount);
    expect(await token.balanceOf(bob.address)).to.equal(amount);
    expect(await token.allowance(treasury.address, alice.address)).to.equal(0n);
  });
});
