import { ethers } from "hardhat";

/**
 * Deploys the Verifier and HydroSettlement, then seeds two demo accounts
 * with balances so a transfer can be settled right away. Usage:
 *
 *   npm run deploy:local --workspace=chain/settlement
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const [deployer, alice, bob] = await ethers.getSigners();

  const verifierFactory = await ethers.getContractFactory("Verifier");
  const verifier = await verifierFactory.deploy();
  await verifier.waitForDeployment();

  const settlementFactory = await ethers.getContractFactory("HydroSettlement");
  const settlement = await settlementFactory.deploy(await verifier.getAddress());
  await settlement.waitForDeployment();

  await (await settlement.fund(alice.address, 100)).wait();
  await (await settlement.fund(bob.address, 10)).wait();

  console.log("Verifier deployed:      ", await verifier.getAddress());
  console.log("HydroSettlement deployed:", await settlement.getAddress());
  console.log("  funded", alice.address, "with 100");
  console.log("  funded", bob.address, "with 10");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
