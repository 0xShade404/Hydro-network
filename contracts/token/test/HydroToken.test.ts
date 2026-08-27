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

  describe("voting power (ERC20Votes, for contracts/governance)", () => {
    it("does not count a holder's balance as votes until they delegate", async () => {
      const { token, treasury } = await deployFixture();
      expect(await token.getVotes(treasury.address)).to.equal(0n);
    });

    it("activates voting power equal to balance once a holder self-delegates", async () => {
      const { token, treasury } = await deployFixture();
      await expect(token.connect(treasury).delegate(treasury.address))
        .to.emit(token, "DelegateVotesChanged")
        .withArgs(treasury.address, 0n, MAX_SUPPLY);
      expect(await token.getVotes(treasury.address)).to.equal(MAX_SUPPLY);
      expect(await token.delegates(treasury.address)).to.equal(treasury.address);
    });

    it("moves voting power when a delegated holder transfers tokens", async () => {
      const { token, treasury, alice } = await deployFixture();
      const amount = 1_000n * 10n ** 18n;

      await token.connect(treasury).delegate(treasury.address);
      await token.connect(alice).delegate(alice.address);
      await token.connect(treasury).transfer(alice.address, amount);

      expect(await token.getVotes(treasury.address)).to.equal(MAX_SUPPLY - amount);
      expect(await token.getVotes(alice.address)).to.equal(amount);
    });

    it("lets a holder delegate their voting power to someone else", async () => {
      const { token, treasury, alice } = await deployFixture();
      await token.connect(treasury).delegate(alice.address);
      expect(await token.getVotes(treasury.address)).to.equal(0n);
      expect(await token.getVotes(alice.address)).to.equal(MAX_SUPPLY);
    });

    it("checkpoints historical voting power via getPastVotes", async () => {
      const { token, treasury, alice } = await deployFixture();
      await token.connect(treasury).delegate(treasury.address);
      const delegateBlock = await ethers.provider.getBlockNumber();

      await token.connect(treasury).transfer(alice.address, 1_000n * 10n ** 18n);
      await ethers.provider.send("evm_mine", []); // ensure a later block exists to query

      expect(await token.getPastVotes(treasury.address, delegateBlock)).to.equal(MAX_SUPPLY);
    });
  });

  it("supports gasless approval via ERC20Permit", async () => {
    const { token, treasury, alice } = await deployFixture();
    const amount = 250n * 10n ** 18n;
    const deadline = ethers.MaxUint256;

    const domain = {
      name: "Hydro",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await token.getAddress(),
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = {
      owner: treasury.address,
      spender: alice.address,
      value: amount,
      nonce: await token.nonces(treasury.address),
      deadline,
    };

    const signature = await treasury.signTypedData(domain, types, value);
    const { v, r, s } = ethers.Signature.from(signature);

    await token.permit(treasury.address, alice.address, amount, deadline, v, r, s);
    expect(await token.allowance(treasury.address, alice.address)).to.equal(amount);
  });
});
