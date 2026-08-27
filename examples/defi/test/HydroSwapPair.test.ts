import { expect } from "chai";
import { ethers } from "hardhat";

const E18 = 10n ** 18n;
const U = (n: bigint) => n * E18;

describe("HydroSwapPair", () => {
  async function deployFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("HydroToken");
    const hydro = await tokenFactory.deploy(deployer.address);
    await hydro.waitForDeployment();

    const usdhFactory = await ethers.getContractFactory("MockUSDH");
    const usdh = await usdhFactory.deploy();
    await usdh.waitForDeployment();
    await (await usdh.mint(deployer.address, U(10_000_000n))).wait();

    const pairFactory = await ethers.getContractFactory("HydroSwapPair");
    const pair = await pairFactory.deploy(await hydro.getAddress(), await usdh.getAddress());
    await pair.waitForDeployment();
    const pairAddress = await pair.getAddress();

    // Fund alice/bob from the deployer, who holds the full HydroToken and MockUSDH supply.
    await (await hydro.transfer(alice.address, U(1_000_000n))).wait();
    await (await hydro.transfer(bob.address, U(1_000_000n))).wait();
    await (await usdh.mint(alice.address, U(1_000_000n))).wait();
    await (await usdh.mint(bob.address, U(1_000_000n))).wait();

    for (const signer of [deployer, alice, bob]) {
      await (await hydro.connect(signer).approve(pairAddress, ethers.MaxUint256)).wait();
      await (await usdh.connect(signer).approve(pairAddress, ethers.MaxUint256)).wait();
    }

    return { hydro, usdh, pair, deployer, alice, bob };
  }

  it("mints sqrt(x*y) - MINIMUM_LIQUIDITY on first deposit, locking the minimum to a burn address", async () => {
    const { pair, deployer } = await deployFixture();
    const amount0 = U(10_000n);
    const amount1 = U(40_000n); // price: 4 USDH per HYDRO

    await pair.connect(deployer).addLiquidity(amount0, amount1);

    const minLiquidity = await pair.MINIMUM_LIQUIDITY();
    const burnAddress = await pair.BURN_ADDRESS();
    const expectedTotal = isqrt(amount0 * amount1);

    expect(await pair.totalSupply()).to.equal(expectedTotal);
    expect(await pair.balanceOf(burnAddress)).to.equal(minLiquidity);
    expect(await pair.balanceOf(deployer.address)).to.equal(expectedTotal - minLiquidity);
    expect(await pair.reserve0()).to.equal(amount0);
    expect(await pair.reserve1()).to.equal(amount1);
  });

  it("rejects zero-amount deposits", async () => {
    const { pair, deployer } = await deployFixture();
    await expect(pair.connect(deployer).addLiquidity(0, U(1n))).to.be.revertedWith(
      "HydroSwapPair: zero amount"
    );
  });

  it("mints proportionally to the limiting side on subsequent deposits", async () => {
    const { pair, deployer, alice } = await deployFixture();
    await pair.connect(deployer).addLiquidity(U(10_000n), U(40_000n)); // 1:4 ratio

    const supplyBefore = await pair.totalSupply();
    // Alice offers a 1:4 ratio too (500 HYDRO, 2000 USDH) — should mint proportionally.
    await pair.connect(alice).addLiquidity(U(500n), U(2000n));

    const expectedMinted = (U(500n) * supplyBefore) / U(10_000n);
    expect(await pair.balanceOf(alice.address)).to.equal(expectedMinted);
  });

  it("quotes and executes swaps with the same constant-product-minus-fee formula", async () => {
    const { hydro, usdh, pair, deployer, alice } = await deployFixture();
    await pair.connect(deployer).addLiquidity(U(10_000n), U(40_000n));

    const amountIn = U(100n);
    const quoted = await pair.getAmountOut(await hydro.getAddress(), amountIn);
    expect(quoted).to.be.greaterThan(0n);

    const usdhBefore = await usdh.balanceOf(alice.address);
    await pair.connect(alice).swap(await hydro.getAddress(), amountIn, quoted);
    expect(await usdh.balanceOf(alice.address)).to.equal(usdhBefore + quoted);
  });

  it("takes a ~0.3% fee, so the constant product k strictly increases after a swap", async () => {
    const { hydro, pair, deployer, alice } = await deployFixture();
    await pair.connect(deployer).addLiquidity(U(10_000n), U(40_000n));

    const kBefore = (await pair.reserve0()) * (await pair.reserve1());
    await pair.connect(alice).swap(await hydro.getAddress(), U(500n), 0);
    const kAfter = (await pair.reserve0()) * (await pair.reserve1());

    expect(kAfter).to.be.greaterThan(kBefore);
  });

  it("reverts a swap when the output would be below minAmountOut (slippage protection)", async () => {
    const { hydro, pair, deployer, alice } = await deployFixture();
    await pair.connect(deployer).addLiquidity(U(10_000n), U(40_000n));

    const quoted = await pair.getAmountOut(await hydro.getAddress(), U(100n));
    await expect(
      pair.connect(alice).swap(await hydro.getAddress(), U(100n), quoted + 1n)
    ).to.be.revertedWith("HydroSwapPair: slippage exceeded");
  });

  it("rejects swapping a token that isn't part of the pair", async () => {
    const { pair, alice } = await deployFixture();
    await expect(
      pair.connect(alice).swap(alice.address, U(1n), 0)
    ).to.be.revertedWith("HydroSwapPair: invalid token");
  });

  it("returns a proportional share of current balances (including accrued fees) on withdrawal", async () => {
    const { hydro, usdh, pair, deployer, alice } = await deployFixture();
    await pair.connect(deployer).addLiquidity(U(10_000n), U(40_000n));
    await pair.connect(alice).swap(await hydro.getAddress(), U(1000n), 0); // generates fees

    const lpBalance = await pair.balanceOf(deployer.address);
    const supply = await pair.totalSupply();
    const poolHydro = await hydro.balanceOf(await pair.getAddress());
    const poolUsdh = await usdh.balanceOf(await pair.getAddress());

    const expectedHydro = (lpBalance * poolHydro) / supply;
    const expectedUsdh = (lpBalance * poolUsdh) / supply;

    const hydroBefore = await hydro.balanceOf(deployer.address);
    const usdhBefore = await usdh.balanceOf(deployer.address);
    await pair.connect(deployer).removeLiquidity(lpBalance);

    expect(await hydro.balanceOf(deployer.address)).to.equal(hydroBefore + expectedHydro);
    expect(await usdh.balanceOf(deployer.address)).to.equal(usdhBefore + expectedUsdh);
    expect(await pair.balanceOf(deployer.address)).to.equal(0n);
  });
});

// Integer sqrt for test-side expectation math (matches OpenZeppelin's Math.sqrt for perfect and non-perfect squares).
function isqrt(value: bigint): bigint {
  if (value < 2n) return value;
  let x0 = value / 2n;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}
