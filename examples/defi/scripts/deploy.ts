import { ethers } from "hardhat";

/**
 * Deploys HydroToken, MockUSDH, and a HydroSwapPair between them, then
 * seeds it with initial liquidity. Usage:
 *
 *   npm run deploy:local --workspace=examples/defi
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const tokenFactory = await ethers.getContractFactory("HydroToken");
  const hydro = await tokenFactory.deploy(deployer.address);
  await hydro.waitForDeployment();

  const usdhFactory = await ethers.getContractFactory("MockUSDH");
  const usdh = await usdhFactory.deploy();
  await usdh.waitForDeployment();
  await (await usdh.mint(deployer.address, ethers.parseUnits("10000000", 18))).wait();

  const pairFactory = await ethers.getContractFactory("HydroSwapPair");
  const pair = await pairFactory.deploy(await hydro.getAddress(), await usdh.getAddress());
  await pair.waitForDeployment();
  const pairAddress = await pair.getAddress();

  const hydroAmount = ethers.parseUnits("100000", 18);
  const usdhAmount = ethers.parseUnits("400000", 18); // seeds a 1:4 HYDRO:USDH price
  await (await hydro.approve(pairAddress, hydroAmount)).wait();
  await (await usdh.approve(pairAddress, usdhAmount)).wait();
  await (await pair.addLiquidity(hydroAmount, usdhAmount)).wait();

  console.log("HydroToken deployed:   ", await hydro.getAddress());
  console.log("MockUSDH deployed:     ", await usdh.getAddress());
  console.log("HydroSwapPair deployed:", pairAddress);
  console.log(
    "  seeded with",
    ethers.formatUnits(hydroAmount, 18),
    "HYDRO and",
    ethers.formatUnits(usdhAmount, 18),
    "USDH"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
