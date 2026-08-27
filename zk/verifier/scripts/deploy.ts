import { ethers } from "hardhat";

/**
 * Deploys the generated TransferValidity Verifier contract. Usage:
 *
 *   npm run deploy:local --workspace=zk/verifier
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const factory = await ethers.getContractFactory("Verifier");
  const verifier = await factory.deploy();
  await verifier.waitForDeployment();

  console.log("TransferValidity Verifier deployed");
  console.log("  address:", await verifier.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
