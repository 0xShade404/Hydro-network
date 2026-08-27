import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const REWARDS_DURATION = 1000; // seconds
const REWARD_AMOUNT = ethers.parseUnits("1000", 18); // rate = 1 HYDRO/sec

describe("HydroDePINRewards", () => {
  async function deployFixture() {
    const [deployer, reporter, nodeA, nodeB, outsider] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("HydroToken");
    const token = await tokenFactory.deploy(deployer.address);
    await token.waitForDeployment();

    const rewardsFactory = await ethers.getContractFactory("HydroDePINRewards");
    const rewards = await rewardsFactory.deploy(await token.getAddress(), reporter.address, REWARDS_DURATION);
    await rewards.waitForDeployment();

    return { token, rewards, deployer, reporter, nodeA, nodeB, outsider };
  }

  async function fund(token: any, rewards: any, deployer: any, amount: bigint) {
    await (await token.approve(await rewards.getAddress(), amount)).wait();
    await (await rewards.addRewards(amount)).wait();
  }

  it("only the reporter can report contribution", async () => {
    const { rewards, nodeA, outsider } = await deployFixture();
    await expect(rewards.connect(outsider).reportContribution(nodeA.address, 100)).to.be.revertedWith(
      "HydroDePINRewards: not reporter"
    );
  });

  it("only the owner can change the reporter, add rewards, or set the duration", async () => {
    const { rewards, reporter, outsider } = await deployFixture();
    await expect(rewards.connect(outsider).setReporter(outsider.address)).to.be.revertedWithCustomError(
      rewards,
      "OwnableUnauthorizedAccount"
    );
    await expect(rewards.connect(reporter).addRewards(1)).to.be.revertedWithCustomError(
      rewards,
      "OwnableUnauthorizedAccount"
    );
    await expect(rewards.connect(reporter).setRewardsDuration(1)).to.be.revertedWithCustomError(
      rewards,
      "OwnableUnauthorizedAccount"
    );
  });

  it("accumulates reported contribution per node and in total", async () => {
    const { rewards, reporter, nodeA } = await deployFixture();
    await expect(rewards.connect(reporter).reportContribution(nodeA.address, 100))
      .to.emit(rewards, "ContributionReported")
      .withArgs(nodeA.address, 100, 100);
    await (await rewards.connect(reporter).reportContribution(nodeA.address, 50)).wait();

    expect(await rewards.contributionOf(nodeA.address)).to.equal(150);
    expect(await rewards.totalContribution()).to.equal(150);
  });

  it("splits rewards fairly between nodes, proportional to reported contribution and time", async () => {
    const { token, rewards, deployer, reporter, nodeA, nodeB } = await deployFixture();
    await fund(token, rewards, deployer, REWARD_AMOUNT); // rate = 1 HYDRO/sec over 1000s

    await (await rewards.connect(reporter).reportContribution(nodeA.address, 100)).wait();

    // Node A alone for 500s: earns all of it, 500 HYDRO.
    await time.increase(500);

    // Node B joins with equal reported contribution for the remaining ~500s.
    await (await rewards.connect(reporter).reportContribution(nodeB.address, 100)).wait();
    await time.increase(500);

    const earnedA = await rewards.earned(nodeA.address);
    const earnedB = await rewards.earned(nodeB.address);
    const tolerance = ethers.parseUnits("1", 18);

    expect(earnedA).to.be.closeTo(ethers.parseUnits("750", 18), tolerance);
    expect(earnedB).to.be.closeTo(ethers.parseUnits("250", 18), tolerance);
    expect(earnedA + earnedB).to.be.closeTo(REWARD_AMOUNT, tolerance);
  });

  it("pays out claimed rewards and zeroes the claimable balance", async () => {
    const { token, rewards, deployer, reporter, nodeA } = await deployFixture();
    await fund(token, rewards, deployer, REWARD_AMOUNT);
    await (await rewards.connect(reporter).reportContribution(nodeA.address, 100)).wait();
    await time.increase(100); // ~100 HYDRO earned

    const balanceBefore = await token.balanceOf(nodeA.address);
    // Don't assert against a pre-fetched `earned()` value: claimReward's
    // own transaction lands in a later block, accruing a bit more first.
    const receipt = await (await rewards.connect(nodeA).claimReward()).wait();
    const paidEvent = receipt!.logs
      .map((log: any) => {
        try {
          return rewards.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === "RewardPaid");
    const paidAmount = paidEvent!.args.amount as bigint;

    expect(paidAmount).to.be.greaterThanOrEqual(ethers.parseUnits("100", 18));
    expect(await token.balanceOf(nodeA.address)).to.equal(balanceBefore + paidAmount);
    expect(await rewards.earned(nodeA.address)).to.equal(0n);
  });

  it("stops attributing new rewards to a reporter that's since been replaced", async () => {
    const { token, rewards, deployer, reporter, nodeA, outsider } = await deployFixture();
    await fund(token, rewards, deployer, REWARD_AMOUNT);
    await (await rewards.setReporter(outsider.address)).wait();

    await expect(rewards.connect(reporter).reportContribution(nodeA.address, 100)).to.be.revertedWith(
      "HydroDePINRewards: not reporter"
    );
    await expect(rewards.connect(outsider).reportContribution(nodeA.address, 100)).to.not.be.reverted;
  });

  it("rolls unpaid leftover rewards into a new period instead of losing them", async () => {
    const { token, rewards, deployer, reporter, nodeA } = await deployFixture();
    await fund(token, rewards, deployer, REWARD_AMOUNT); // 1000 HYDRO over 1000s
    await (await rewards.connect(reporter).reportContribution(nodeA.address, 100)).wait();
    await time.increase(500); // half the period elapses, unclaimed

    await fund(token, rewards, deployer, REWARD_AMOUNT); // top up mid-period

    await time.increase(1000);
    const earned = await rewards.earned(nodeA.address);

    expect(earned).to.be.closeTo(ethers.parseUnits("2000", 18), ethers.parseUnits("2", 18));
  });

  it("prevents changing rewardsDuration while a period is active", async () => {
    const { token, rewards, deployer } = await deployFixture();
    await fund(token, rewards, deployer, REWARD_AMOUNT);
    await expect(rewards.setRewardsDuration(500)).to.be.revertedWith(
      "HydroDePINRewards: reward period still active"
    );

    await time.increase(REWARDS_DURATION + 1);
    await expect(rewards.setRewardsDuration(500))
      .to.emit(rewards, "RewardsDurationUpdated")
      .withArgs(500);
  });
});
