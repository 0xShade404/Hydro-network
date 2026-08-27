import { expect } from "chai";
import { ethers } from "hardhat";
import { mine, time } from "@nomicfoundation/hardhat-network-helpers";

// Small, test-friendly governance parameters (block-denominated, since
// HydroToken's ERC20Votes clock defaults to block number). Real deployment
// values are in scripts/deploy.ts — these are compressed purely so tests
// don't have to mine thousands of blocks.
const VOTING_DELAY_BLOCKS = 1;
const VOTING_PERIOD_BLOCKS = 50;
const PROPOSAL_THRESHOLD = ethers.parseUnits("1000", 18);
const QUORUM_PERCENT = 4;
const TIMELOCK_MIN_DELAY = 60; // seconds

const AGAINST = 0;
const FOR = 1;

async function proposalIdFor(governor: any, targets: string[], values: bigint[], calldatas: string[], description: string) {
  const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
  return governor.hashProposal(targets, values, calldatas, descriptionHash);
}

describe("HydroGovernor", () => {
  async function deployFixture() {
    const [deployer, alice, bob, carol, dave] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("HydroToken");
    const token = await tokenFactory.deploy(deployer.address);
    await token.waitForDeployment();

    const stakingFactory = await ethers.getContractFactory("HydroStaking");
    const staking = await stakingFactory.deploy(await token.getAddress(), 7 * 24 * 60 * 60);
    await staking.waitForDeployment();

    // alice: well above quorum (4% of 371M ~= 14.84M) so she alone can pass a vote.
    // bob: below the proposal threshold.
    // carol: above the proposal threshold but well below quorum.
    // dave: large balance, deliberately left un-delegated for the snapshot test.
    await (await token.transfer(alice.address, ethers.parseUnits("20000000", 18))).wait();
    await (await token.transfer(bob.address, ethers.parseUnits("10", 18))).wait();
    await (await token.transfer(carol.address, ethers.parseUnits("2000", 18))).wait();
    await (await token.transfer(dave.address, ethers.parseUnits("20000000", 18))).wait();

    for (const signer of [alice, bob, carol]) {
      await (await token.connect(signer).delegate(signer.address)).wait();
    }

    const timelockFactory = await ethers.getContractFactory("TimelockController");
    const timelock = await timelockFactory.deploy(TIMELOCK_MIN_DELAY, [], [], deployer.address);
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

    await (await timelock.grantRole(PROPOSER_ROLE, governorAddress)).wait();
    await (await timelock.grantRole(CANCELLER_ROLE, governorAddress)).wait();
    await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait();
    await (await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address)).wait();

    await (await staking.transferOwnership(timelockAddress)).wait();

    return { token, staking, timelock, governor, deployer, alice, bob, carol, dave, DEFAULT_ADMIN_ROLE };
  }

  function setRewardsDurationProposal(staking: any, newDuration: number) {
    const targets = [staking.target as string];
    const values = [0n];
    const calldatas = [staking.interface.encodeFunctionData("setRewardsDuration", [newDuration])];
    const description = `Set rewards duration to ${newDuration}`;
    return { targets, values, calldatas, description };
  }

  it("passes a proposal through the full propose -> vote -> queue -> execute flow", async () => {
    const { governor, staking, alice } = await deployFixture();
    const newDuration = 14 * 24 * 60 * 60;
    const { targets, values, calldatas, description } = setRewardsDurationProposal(staking, newDuration);

    await governor.connect(alice).propose(targets, values, calldatas, description);
    const proposalId = await proposalIdFor(governor, targets, values, calldatas, description);

    await mine(VOTING_DELAY_BLOCKS + 1);
    await governor.connect(alice).castVote(proposalId, FOR);
    await mine(VOTING_PERIOD_BLOCKS + 1);

    expect(await governor.state(proposalId)).to.equal(4n); // Succeeded

    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
    await governor.queue(targets, values, calldatas, descriptionHash);
    expect(await governor.state(proposalId)).to.equal(5n); // Queued

    await time.increase(TIMELOCK_MIN_DELAY + 1);
    await governor.execute(targets, values, calldatas, descriptionHash);

    expect(await staking.rewardsDuration()).to.equal(newDuration);
    expect(await governor.state(proposalId)).to.equal(7n); // Executed
  });

  it("rejects proposals from accounts below the proposal threshold", async () => {
    const { governor, staking, bob } = await deployFixture();
    const { targets, values, calldatas, description } = setRewardsDurationProposal(staking, 1000);

    await expect(
      governor.connect(bob).propose(targets, values, calldatas, description)
    ).to.be.revertedWithCustomError(governor, "GovernorInsufficientProposerVotes");
  });

  it("defeats a proposal that doesn't reach quorum, even with unanimous support", async () => {
    const { governor, staking, carol } = await deployFixture();
    const { targets, values, calldatas, description } = setRewardsDurationProposal(staking, 2000);

    await governor.connect(carol).propose(targets, values, calldatas, description);
    const proposalId = await proposalIdFor(governor, targets, values, calldatas, description);

    await mine(VOTING_DELAY_BLOCKS + 1);
    await governor.connect(carol).castVote(proposalId, FOR); // carol alone: well under 4% quorum
    await mine(VOTING_PERIOD_BLOCKS + 1);

    expect(await governor.state(proposalId)).to.equal(3n); // Defeated
  });

  it("does not count voting power delegated after a proposal's snapshot", async () => {
    const { governor, staking, alice, dave } = await deployFixture();
    const { targets, values, calldatas, description } = setRewardsDurationProposal(staking, 3000);

    await governor.connect(alice).propose(targets, values, calldatas, description);
    const proposalId = await proposalIdFor(governor, targets, values, calldatas, description);
    const snapshot = await governor.proposalSnapshot(proposalId);

    // Move past the snapshot block first, then have dave delegate —
    // activating voting power strictly after the snapshot, too late to
    // count for this proposal.
    await mine(VOTING_DELAY_BLOCKS + 2);

    const tokenAddress = await governor.token();
    const HydroToken = await ethers.getContractFactory("HydroToken");
    const token = HydroToken.attach(tokenAddress) as any;
    await (await token.connect(dave).delegate(dave.address)).wait();

    expect(await governor.getVotes(dave.address, snapshot)).to.equal(0n);

    await expect(governor.connect(dave).castVote(proposalId, FOR))
      .to.emit(governor, "VoteCast")
      .withArgs(dave.address, proposalId, FOR, 0n, "");
  });

  it("blocks execution until the timelock delay has passed", async () => {
    const { governor, staking, alice } = await deployFixture();
    const { targets, values, calldatas, description } = setRewardsDurationProposal(staking, 4000);

    await governor.connect(alice).propose(targets, values, calldatas, description);
    const proposalId = await proposalIdFor(governor, targets, values, calldatas, description);

    await mine(VOTING_DELAY_BLOCKS + 1);
    await governor.connect(alice).castVote(proposalId, FOR);
    await mine(VOTING_PERIOD_BLOCKS + 1);

    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
    await governor.queue(targets, values, calldatas, descriptionHash);

    await expect(governor.execute(targets, values, calldatas, descriptionHash)).to.be.reverted;

    await time.increase(TIMELOCK_MIN_DELAY + 1);
    await expect(governor.execute(targets, values, calldatas, descriptionHash)).to.not.be.reverted;
  });

  it("leaves HydroStaking's owner-only functions unreachable outside governance", async () => {
    const { staking, deployer } = await deployFixture();
    await expect(staking.connect(deployer).setRewardsDuration(1000)).to.be.revertedWithCustomError(
      staking,
      "OwnableUnauthorizedAccount"
    );
  });

  it("renounces the deployer's timelock admin role, closing the setup backdoor", async () => {
    const { timelock, deployer, DEFAULT_ADMIN_ROLE } = await deployFixture();
    expect(await timelock.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(false);
    await expect(
      timelock.connect(deployer).grantRole(await timelock.PROPOSER_ROLE(), deployer.address)
    ).to.be.reverted;
  });
});
