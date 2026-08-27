import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const E18 = 10n ** 18n;
const U = (n: bigint) => n * E18;

describe("HydroRWANote", () => {
  async function deployFixture() {
    const [deployer, alice, bob, outsider] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("HydroToken");
    const hydro = await tokenFactory.deploy(deployer.address);
    await hydro.waitForDeployment();

    const maturity = (await time.latest()) + 30 * 24 * 60 * 60; // 30 days out
    const redemptionRate = ethers.parseUnits("1.05", 18); // 5% yield at maturity

    const noteFactory = await ethers.getContractFactory("HydroRWANote");
    const note = await noteFactory.deploy(
      "Hydro 30-Day Note",
      "HYD30",
      await hydro.getAddress(),
      maturity,
      redemptionRate,
      deployer.address
    );
    await note.waitForDeployment();

    await (await note.setAllowed(alice.address, true)).wait();
    await (await note.setAllowed(bob.address, true)).wait();

    return { hydro, note, deployer, alice, bob, outsider, maturity, redemptionRate };
  }

  it("rejects deployment with a past/current maturity or zero redemption rate", async () => {
    const factory = await ethers.getContractFactory("HydroRWANote");
    const [deployer] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory("HydroToken");
    const hydro = await tokenFactory.deploy(deployer.address);
    await hydro.waitForDeployment();

    await expect(
      factory.deploy("N", "N", await hydro.getAddress(), await time.latest(), U(1n), deployer.address)
    ).to.be.revertedWith("HydroRWANote: maturity must be in the future");

    await expect(
      factory.deploy(
        "N",
        "N",
        await hydro.getAddress(),
        (await time.latest()) + 1000,
        0,
        deployer.address
      )
    ).to.be.revertedWith("HydroRWANote: zero redemption rate");
  });

  it("only the owner can update the allowlist or issue notes", async () => {
    const { note, alice, outsider } = await deployFixture();
    await expect(note.connect(alice).setAllowed(outsider.address, true)).to.be.revertedWithCustomError(
      note,
      "OwnableUnauthorizedAccount"
    );
    await expect(note.connect(alice).issue(alice.address, U(1n))).to.be.revertedWithCustomError(
      note,
      "OwnableUnauthorizedAccount"
    );
  });

  it("only issues notes to allowlisted addresses", async () => {
    const { note, deployer, alice, outsider } = await deployFixture();
    await expect(note.connect(deployer).issue(outsider.address, U(100n))).to.be.revertedWith(
      "HydroRWANote: recipient not allowlisted"
    );
    await expect(note.connect(deployer).issue(alice.address, 0)).to.be.revertedWith(
      "HydroRWANote: zero amount"
    );
  });

  it("lets allowlisted holders transfer to each other but blocks non-allowlisted counterparties", async () => {
    const { note, deployer, alice, bob, outsider } = await deployFixture();
    await (await note.connect(deployer).issue(alice.address, U(100n))).wait();

    await expect(note.connect(alice).transfer(bob.address, U(10n)))
      .to.emit(note, "Transfer")
      .withArgs(alice.address, bob.address, U(10n));

    await expect(note.connect(alice).transfer(outsider.address, U(10n))).to.be.revertedWith(
      "HydroRWANote: not allowlisted"
    );
  });

  it("blocks future transfers after revocation but leaves the existing balance intact", async () => {
    const { note, deployer, alice, bob } = await deployFixture();
    await (await note.connect(deployer).issue(alice.address, U(100n))).wait();
    await (await note.setAllowed(alice.address, false)).wait();

    expect(await note.balanceOf(alice.address)).to.equal(U(100n));
    await expect(note.connect(alice).transfer(bob.address, U(10n))).to.be.revertedWith(
      "HydroRWANote: not allowlisted"
    );
  });

  it("rejects redemption before maturity", async () => {
    const { note, deployer, alice } = await deployFixture();
    await (await note.connect(deployer).issue(alice.address, U(100n))).wait();
    await expect(note.connect(alice).redeem(U(100n))).to.be.revertedWith("HydroRWANote: not yet matured");
  });

  it("pays out amount * redemptionRate after maturity, funded by fundRedemption", async () => {
    const { hydro, note, deployer, alice, maturity, redemptionRate } = await deployFixture();
    await (await note.connect(deployer).issue(alice.address, U(1000n))).wait();

    const payout = (U(1000n) * redemptionRate) / E18;
    await (await hydro.approve(await note.getAddress(), payout)).wait();
    await expect(note.connect(deployer).fundRedemption(payout))
      .to.emit(note, "RedemptionFunded")
      .withArgs(deployer.address, payout);

    await time.increaseTo(maturity);

    const hydroBefore = await hydro.balanceOf(alice.address);
    await expect(note.connect(alice).redeem(U(1000n)))
      .to.emit(note, "Redeemed")
      .withArgs(alice.address, U(1000n), payout);

    expect(await hydro.balanceOf(alice.address)).to.equal(hydroBefore + payout);
    expect(await note.balanceOf(alice.address)).to.equal(0n);
  });

  it("reverts redemption if the pool isn't funded enough to cover the payout", async () => {
    const { note, deployer, alice, maturity } = await deployFixture();
    await (await note.connect(deployer).issue(alice.address, U(1000n))).wait();
    await time.increaseTo(maturity);

    await expect(note.connect(alice).redeem(U(1000n))).to.be.reverted; // no funding at all
  });

  it("still allows a revoked holder to redeem notes they already legitimately hold", async () => {
    const { hydro, note, deployer, alice, maturity, redemptionRate } = await deployFixture();
    await (await note.connect(deployer).issue(alice.address, U(1000n))).wait();

    const payout = (U(1000n) * redemptionRate) / E18;
    await (await hydro.approve(await note.getAddress(), payout)).wait();
    await (await note.fundRedemption(payout)).wait();

    await (await note.setAllowed(alice.address, false)).wait(); // compliance revoked
    await time.increaseTo(maturity);

    await expect(note.connect(alice).redeem(U(1000n))).to.not.be.reverted;
  });
});
