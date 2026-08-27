import { ethers } from "hardhat";

/**
 * Deploys a fresh HydroToken and HydroTreasury, then seeds the treasury
 * with a demo balance of both HYDRO and ETH. Usage:
 *
 *   npm run deploy:local --workspace=contracts/treasury
 *
 * against a Hydro dev network started with `npm run node:dev`.
 *
 * This deploys HydroTreasury owned by the deployer for a standalone demo.
 * A real deployment should pass a TimelockController's address as
 * `initialOwner` directly (or call `transferOwnership` immediately after,
 * the way contracts/governance/scripts/deploy.ts does for HydroStaking)
 * so disbursements are governance-gated from the start.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const tokenFactory = await ethers.getContractFactory("HydroToken");
  const token = await tokenFactory.deploy(deployer.address);
  await token.waitForDeployment();

  const treasuryFactory = await ethers.getContractFactory("HydroTreasury");
  const treasury = await treasuryFactory.deploy(deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();

  const demoTokenAmount = ethers.parseUnits("5000000", 18); // 5,000,000 HYDRO
  await (await token.transfer(treasuryAddress, demoTokenAmount)).wait();
  await (
    await deployer.sendTransaction({ to: treasuryAddress, value: ethers.parseEther("1") })
  ).wait();

  console.log("HydroToken deployed:  ", await token.getAddress());
  console.log("HydroTreasury deployed:", treasuryAddress);
  console.log("  seeded with", ethers.formatUnits(demoTokenAmount, 18), "HYDRO and 1 ETH");
  console.log("  owner:", await treasury.owner(), "(transfer to a timelock for real use)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
