import { ethers } from "hardhat";

const REWARDS_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
const DEMO_REWARD_AMOUNT = ethers.parseUnits("500000", 18);

/**
 * Deploys HydroToken and HydroDePINRewards (deployer acts as the
 * reporter for the demo), funds a reward pool, and reports some demo
 * contribution for two nodes. Usage:
 *
 *   npm run deploy:local --workspace=examples/depin
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const [deployer, nodeA, nodeB] = await ethers.getSigners();

  const tokenFactory = await ethers.getContractFactory("HydroToken");
  const token = await tokenFactory.deploy(deployer.address);
  await token.waitForDeployment();

  const rewardsFactory = await ethers.getContractFactory("HydroDePINRewards");
  const rewards = await rewardsFactory.deploy(
    await token.getAddress(),
    deployer.address, // reporter == deployer for this demo
    REWARDS_DURATION_SECONDS
  );
  await rewards.waitForDeployment();
  const rewardsAddress = await rewards.getAddress();

  await (await token.approve(rewardsAddress, DEMO_REWARD_AMOUNT)).wait();
  await (await rewards.addRewards(DEMO_REWARD_AMOUNT)).wait();
  await (await rewards.reportContribution(nodeA.address, 100)).wait();
  await (await rewards.reportContribution(nodeB.address, 50)).wait();

  console.log("HydroToken deployed:        ", await token.getAddress());
  console.log("HydroDePINRewards deployed: ", rewardsAddress);
  console.log(
    "  funded with",
    ethers.formatUnits(DEMO_REWARD_AMOUNT, 18),
    "HYDRO over",
    REWARDS_DURATION_SECONDS / (24 * 60 * 60),
    "days"
  );
  console.log("  reported", nodeA.address, "-> 100 units");
  console.log("  reported", nodeB.address, "-> 50 units");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
