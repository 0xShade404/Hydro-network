import { ethers } from "hardhat";

const REWARDS_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
const DEMO_REWARD_AMOUNT = ethers.parseUnits("1000000", 18); // 1,000,000 HYDRO

/**
 * Deploys a fresh HydroToken and HydroStaking pointing at it, then funds
 * the staking contract with a demo reward pool. Usage:
 *
 *   npm run deploy:local --workspace=contracts/staking
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const tokenFactory = await ethers.getContractFactory("HydroToken");
  const token = await tokenFactory.deploy(deployer.address);
  await token.waitForDeployment();

  const stakingFactory = await ethers.getContractFactory("HydroStaking");
  const staking = await stakingFactory.deploy(await token.getAddress(), REWARDS_DURATION_SECONDS);
  await staking.waitForDeployment();

  await (await token.approve(await staking.getAddress(), DEMO_REWARD_AMOUNT)).wait();
  await (await staking.addRewards(DEMO_REWARD_AMOUNT)).wait();

  console.log("HydroToken deployed:  ", await token.getAddress());
  console.log("HydroStaking deployed:", await staking.getAddress());
  console.log(
    "  funded with",
    ethers.formatUnits(DEMO_REWARD_AMOUNT, 18),
    "HYDRO over",
    REWARDS_DURATION_SECONDS / (24 * 60 * 60),
    "days"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
