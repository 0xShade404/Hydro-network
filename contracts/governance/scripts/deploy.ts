import { ethers } from "hardhat";

// Investor-grade defaults, expressed in blocks (HydroToken's ERC20Votes
// clock defaults to block number, not timestamp) assuming ~12s blocks:
const VOTING_DELAY_BLOCKS = 7_200; // ~1 day before voting opens
const VOTING_PERIOD_BLOCKS = 50_400; // ~1 week voting window
const PROPOSAL_THRESHOLD = ethers.parseUnits("1000000", 18); // ~0.27% of supply to propose
const QUORUM_PERCENT = 4; // 4% of total supply must vote, standard Compound-style default
const TIMELOCK_MIN_DELAY_SECONDS = 2 * 24 * 60 * 60; // 2 days between a passed vote and execution

const STAKING_REWARDS_DURATION_SECONDS = 7 * 24 * 60 * 60;

/**
 * Deploys HydroToken, HydroStaking, a TimelockController, and
 * HydroGovernor, then wires them together the way a real deployment
 * should: the timelock's own admin role is renounced once setup is done,
 * so from then on the timelock (and therefore HydroStaking, whose
 * ownership is transferred to it) can only be controlled by a passed
 * governance proposal — no lingering admin key. Usage:
 *
 *   npm run deploy:local --workspace=contracts/governance
 *
 * against a Hydro dev network started with `npm run node:dev`.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const tokenFactory = await ethers.getContractFactory("HydroToken");
  const token = await tokenFactory.deploy(deployer.address);
  await token.waitForDeployment();
  await (await token.delegate(deployer.address)).wait(); // activate voting power

  const stakingFactory = await ethers.getContractFactory("HydroStaking");
  const staking = await stakingFactory.deploy(await token.getAddress(), STAKING_REWARDS_DURATION_SECONDS);
  await staking.waitForDeployment();

  const timelockFactory = await ethers.getContractFactory("TimelockController");
  const timelock = await timelockFactory.deploy(
    TIMELOCK_MIN_DELAY_SECONDS,
    [], // proposers: granted to the governor below
    [], // executors: opened to everyone below
    deployer.address // temporary admin, renounced at the end
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();

  const governorFactory = await ethers.getContractFactory("HydroGovernor");
  const governor = await governorFactory.deploy(
    await token.getAddress(),
    timelockAddress,
    VOTING_DELAY_BLOCKS,
    VOTING_PERIOD_BLOCKS,
    PROPOSAL_THRESHOLD,
    QUORUM_PERCENT
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();

  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();
  const OPEN_ROLE = ethers.ZeroAddress;

  await (await timelock.grantRole(PROPOSER_ROLE, governorAddress)).wait();
  await (await timelock.grantRole(CANCELLER_ROLE, governorAddress)).wait();
  await (await timelock.grantRole(EXECUTOR_ROLE, OPEN_ROLE)).wait();
  await (await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address)).wait();

  await (await staking.transferOwnership(timelockAddress)).wait();

  console.log("HydroToken deployed:     ", await token.getAddress());
  console.log("HydroStaking deployed:   ", await staking.getAddress());
  console.log("TimelockController deployed:", timelockAddress);
  console.log("HydroGovernor deployed:  ", governorAddress);
  console.log("HydroStaking ownership -> timelock (governance-controlled from here on)");
  console.log("Deployer's timelock admin role renounced — no admin backdoor remains.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
