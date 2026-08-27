import { ethers } from "hardhat";

/**
 * Deploys a fresh HydroToken, the Verifier, and HydroSettlement, then has
 * two demo accounts deposit real HYDRO into the settlement ledger so a
 * transfer can be settled right away. Usage:
 *
 *   npm run deploy:local --workspace=chain/settlement
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const [deployer, alice, bob] = await ethers.getSigners();

  const tokenFactory = await ethers.getContractFactory("HydroToken");
  const token = await tokenFactory.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const verifierFactory = await ethers.getContractFactory("Verifier");
  const verifier = await verifierFactory.deploy();
  await verifier.waitForDeployment();

  const settlementFactory = await ethers.getContractFactory("HydroSettlement");
  const settlement = await settlementFactory.deploy(await verifier.getAddress(), tokenAddress);
  await settlement.waitForDeployment();
  const settlementAddress = await settlement.getAddress();

  const aliceAmount = ethers.parseUnits("100", 18);
  const bobAmount = ethers.parseUnits("10", 18);

  await (await token.transfer(alice.address, aliceAmount)).wait();
  await (await token.transfer(bob.address, bobAmount)).wait();
  await (await token.connect(alice).approve(settlementAddress, aliceAmount)).wait();
  await (await token.connect(bob).approve(settlementAddress, bobAmount)).wait();
  await (await settlement.connect(alice).deposit(aliceAmount)).wait();
  await (await settlement.connect(bob).deposit(bobAmount)).wait();

  console.log("HydroToken deployed:      ", tokenAddress);
  console.log("Verifier deployed:        ", await verifier.getAddress());
  console.log("HydroSettlement deployed: ", settlementAddress);
  console.log("  ", alice.address, "deposited", ethers.formatUnits(aliceAmount, 18), "HYDRO");
  console.log("  ", bob.address, "deposited", ethers.formatUnits(bobAmount, 18), "HYDRO");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
