import { ethers } from "hardhat";

/**
 * Deploys HydroToken, minting the full max supply to the deploying
 * account. Usage:
 *
 *   npm run deploy:local --workspace=contracts/token
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("HydroToken");
  const token = await factory.deploy(deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  const totalSupply = await token.totalSupply();

  console.log("HydroToken deployed");
  console.log("  address:      ", address);
  console.log("  initialHolder:", deployer.address);
  console.log("  totalSupply:  ", ethers.formatUnits(totalSupply, 18), "HYDRO");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
