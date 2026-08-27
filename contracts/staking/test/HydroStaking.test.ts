import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("HydroStaking", () => {
  const REWARDS_DURATION = 1000; // seconds
  const REWARD_AMOUNT = ethers.parseUnits("1000", 18); // rate = 1 HYDRO/sec

  async function deployFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("HydroToken");
    const token = await tokenFactory.deploy(deployer.address);
    await token.waitForDeployment();

    const stakingFactory = await ethers.getContractFactory("HydroStaking");
    const staking = await stakingFactory.deploy(await token.getAddress(), REWARDS_DURATION);
    await staking.waitForDeployment();

    const stakingAddress = await staking.getAddress();
    const give = ethers.parseUnits("10000", 18);
    await (await token.transfer(alice.address, give)).wait();
    await (await token.transfer(bob.address, give)).wait();
    await (await token.connect(alice).approve(stakingAddress, ethers.MaxUint256)).wait();
    await (await token.connect(bob).approve(stakingAddress, ethers.MaxUint256)).wait();

    return { token, staking, deployer, alice, bob };
  }

  async function fund(token: any, staking: any, deployer: any, amount: bigint) {
    await (await token.approve(await staking.getAddress(), amount)).wait();
    await (await staking.addRewards(amount)).wait();
  }

  it("stakes and withdraws, keeping totalStaked and stakedBalanceOf in sync", async () => {
    const { token, staking, alice } = await deployFixture();
    const amount = ethers.parseUnits("100", 18);

    await expect(staking.connect(alice).stake(amount))
      .to.emit(staking, "Staked")
      .withArgs(alice.address, amount);
    expect(await staking.stakedBalanceOf(alice.address)).to.equal(amount);
    expect(await staking.totalStaked()).to.equal(amount);
    expect(await token.balanceOf(await staking.getAddress())).to.equal(amount);

    await expect(staking.connect(alice).withdraw(amount))
      .to.emit(staking, "Withdrawn")
      .withArgs(alice.address, amount);
    expect(await staking.stakedBalanceOf(alice.address)).to.equal(0);
    expect(await staking.totalStaked()).to.equal(0);
  });

  it("rejects staking or withdrawing zero", async () => {
    const { staking, alice } = await deployFixture();
    await expect(staking.connect(alice).stake(0)).to.be.revertedWith("HydroStaking: cannot stake 0");
    await expect(staking.connect(alice).withdraw(0)).to.be.revertedWith(
      "HydroStaking: cannot withdraw 0"
    );
  });

  it("rejects withdrawing more than staked", async () => {
    const { staking, alice } = await deployFixture();
    await staking.connect(alice).stake(ethers.parseUnits("10", 18));
    await expect(staking.connect(alice).withdraw(ethers.parseUnits("11", 18))).to.be.revertedWith(
      "HydroStaking: insufficient staked balance"
    );
  });

  it("splits rewards fairly between stakers, proportional to stake and time", async () => {
    const { token, staking, deployer, alice, bob } = await deployFixture();
    await fund(token, staking, deployer, REWARD_AMOUNT); // rate = 1 HYDRO/sec over 1000s

    const stakeAmount = ethers.parseUnits("100", 18);
    await staking.connect(alice).stake(stakeAmount);

    // Alice alone for 500s: earns all of it, 500 HYDRO.
    await time.increase(500);

    // Bob joins with an equal stake for the remaining ~500s: the two split
    // the remaining reward 50/50 from here on.
    await staking.connect(bob).stake(stakeAmount);
    await time.increase(500);

    const aliceEarned = await staking.earned(alice.address);
    const bobEarned = await staking.earned(bob.address);

    const tolerance = ethers.parseUnits("1", 18); // integer-division dust
    expect(aliceEarned).to.be.closeTo(ethers.parseUnits("750", 18), tolerance);
    expect(bobEarned).to.be.closeTo(ethers.parseUnits("250", 18), tolerance);

    // Nothing is created or lost: the two together earned ~ the full pool.
    expect(aliceEarned + bobEarned).to.be.closeTo(REWARD_AMOUNT, tolerance);
  });

  it("pays out claimed rewards and lets a holder withdraw principal without forfeiting them", async () => {
    const { token, staking, deployer, alice } = await deployFixture();
    await fund(token, staking, deployer, REWARD_AMOUNT);

    const stakeAmount = ethers.parseUnits("100", 18);
    await staking.connect(alice).stake(stakeAmount);
    await time.increase(100); // ~100 HYDRO earned

    const balanceBefore = await token.balanceOf(alice.address);
    await staking.connect(alice).withdraw(stakeAmount);
    // Withdrawing principal doesn't touch the reward owed.
    const earnedAfterWithdraw = await staking.earned(alice.address);
    expect(earnedAfterWithdraw).to.be.closeTo(ethers.parseUnits("100", 18), ethers.parseUnits("1", 18));

    await staking.connect(alice).getReward();
    const balanceAfter = await token.balanceOf(alice.address);
    const received = balanceAfter - balanceBefore;
    // received = principal back + reward claimed
    expect(received).to.be.closeTo(stakeAmount + earnedAfterWithdraw, ethers.parseUnits("1", 18));
    expect(await staking.earned(alice.address)).to.equal(0);
  });

  it("exit() withdraws principal and claims rewards in one transaction", async () => {
    const { token, staking, deployer, alice } = await deployFixture();
    await fund(token, staking, deployer, REWARD_AMOUNT);

    const stakeAmount = ethers.parseUnits("100", 18);
    await staking.connect(alice).stake(stakeAmount);
    await time.increase(100);

    const balanceBefore = await token.balanceOf(alice.address);
    await staking.connect(alice).exit();

    expect(await staking.stakedBalanceOf(alice.address)).to.equal(0);
    expect(await staking.earned(alice.address)).to.equal(0);
    const received = (await token.balanceOf(alice.address)) - balanceBefore;
    expect(received).to.be.greaterThan(stakeAmount); // principal + some reward
  });

  it("rejects addRewards and setRewardsDuration from non-owners", async () => {
    const { staking, alice } = await deployFixture();
    await expect(staking.connect(alice).addRewards(1)).to.be.revertedWithCustomError(
      staking,
      "OwnableUnauthorizedAccount"
    );
    await expect(staking.connect(alice).setRewardsDuration(1)).to.be.revertedWithCustomError(
      staking,
      "OwnableUnauthorizedAccount"
    );
  });

  it("rejects funding rewards without first approving the token transfer", async () => {
    const { staking } = await deployFixture();
    await expect(staking.addRewards(ethers.parseUnits("1", 18))).to.be.reverted;
  });

  it("rolls unpaid leftover rewards into a new period instead of losing them", async () => {
    const { token, staking, deployer, alice } = await deployFixture();
    await fund(token, staking, deployer, REWARD_AMOUNT); // 1000 HYDRO over 1000s

    await staking.connect(alice).stake(ethers.parseUnits("100", 18));
    await time.increase(500); // half the period elapses, unclaimed

    // Top up mid-period: the ~500 HYDRO of unpaid leftover should roll in,
    // not be forgotten.
    await fund(token, staking, deployer, REWARD_AMOUNT);

    await time.increase(1000); // run the (now-extended) period out fully
    const earned = await staking.earned(alice.address);

    // Alice is the only staker throughout, so she should end up with
    // close to the full ~2000 HYDRO funded across both calls (minus
    // integer-division dust), not just the second call's 1000.
    expect(earned).to.be.closeTo(ethers.parseUnits("2000", 18), ethers.parseUnits("2", 18));
  });

  it("prevents changing rewardsDuration while a period is active", async () => {
    const { token, staking, deployer } = await deployFixture();
    await fund(token, staking, deployer, REWARD_AMOUNT);
    await expect(staking.setRewardsDuration(500)).to.be.revertedWith(
      "HydroStaking: reward period still active"
    );

    await time.increase(REWARDS_DURATION + 1);
    await expect(staking.setRewardsDuration(500))
      .to.emit(staking, "RewardsDurationUpdated")
      .withArgs(500);
  });
});
