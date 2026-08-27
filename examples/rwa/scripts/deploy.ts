import { ethers } from "hardhat";

/**
 * Deploys HydroToken and a HydroRWANote (30-day maturity, 5% redemption
 * yield, redeemable for HYDRO), allowlists the deployer, issues notes,
 * and funds the redemption pool. Usage:
 *
 *   npm run deploy:local --workspace=examples/rwa
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const tokenFactory = await ethers.getContractFactory("HydroToken");
  const hydro = await tokenFactory.deploy(deployer.address);
  await hydro.waitForDeployment();

  const latestBlock = await ethers.provider.getBlock("latest");
  const maturity = (latestBlock!.timestamp) + 30 * 24 * 60 * 60;
  const redemptionRate = ethers.parseUnits("1.05", 18);

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
  const noteAddress = await note.getAddress();

  await (await note.setAllowed(deployer.address, true)).wait();
  const issueAmount = ethers.parseUnits("10000", 18);
  await (await note.issue(deployer.address, issueAmount)).wait();

  const payout = (issueAmount * redemptionRate) / 10n ** 18n;
  await (await hydro.approve(noteAddress, payout)).wait();
  await (await note.fundRedemption(payout)).wait();

  console.log("HydroToken deployed:  ", await hydro.getAddress());
  console.log("HydroRWANote deployed:", noteAddress);
  console.log("  matures:", new Date(maturity * 1000).toISOString());
  console.log("  issued", ethers.formatUnits(issueAmount, 18), "HYD30 to", deployer.address);
  console.log("  funded redemption pool with", ethers.formatUnits(payout, 18), "HYDRO");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
