// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HydroStaking
/// @notice Stake HYDRO, earn HYDRO. Designed around what's good for the
/// holder, not the protocol:
///
///  - No lock-up: stake or withdraw any amount at any time. Rewards
///    accrue continuously and proportionally to (amount staked) x (time
///    staked), so there is nothing to gain by timing a withdrawal —
///    unlike a snapshot/epoch reward scheme, there's no cliff to game.
///  - No inflation: HydroToken has no mint function, so this contract
///    cannot create new HYDRO. Rewards can only come from HYDRO the
///    owner actually transfers in via `addRewards`. Staking here never
///    dilutes non-stakers.
///  - Solvent by construction: `addRewards` refuses to promise a reward
///    rate the contract doesn't hold enough balance to cover, on top of
///    everyone's staked principal. A holder's staked balance can never be
///    eaten into to pay someone else's rewards.
///  - `exit()` lets a holder unstake everything and claim rewards in one
///    transaction instead of two.
///
/// This is a single-pool, single-token (stake HYDRO, earn HYDRO) rewards
/// contract following the widely-used "Synthetix StakingRewards" design
/// (continuous reward-per-token accrual) — not a novel reward mechanism.
contract HydroStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    uint256 public rewardsDuration;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public totalStaked;
    mapping(address => uint256) public stakedBalanceOf;

    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event RewardPaid(address indexed account, uint256 amount);
    event RewardAdded(uint256 amount, uint256 rewardRate, uint256 periodFinish);
    event RewardsDurationUpdated(uint256 newDuration);

    /// @param tokenAddress The HYDRO token — staked and earned are the same asset.
    /// @param rewardsDuration_ How long a funded reward period lasts, in seconds.
    constructor(address tokenAddress, uint256 rewardsDuration_) Ownable(msg.sender) {
        require(tokenAddress != address(0), "HydroStaking: zero token address");
        require(rewardsDuration_ > 0, "HydroStaking: zero duration");
        token = IERC20(tokenAddress);
        rewardsDuration = rewardsDuration_;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) /
            totalStaked;
    }

    /// @notice Total HYDRO `account` has earned so far and not yet claimed.
    function earned(address account) public view returns (uint256) {
        return
            (stakedBalanceOf[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) /
            1e18 +
            rewards[account];
    }

    /// @notice Stakes `amount` HYDRO. Requires a prior `approve`.
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "HydroStaking: cannot stake 0");
        totalStaked += amount;
        stakedBalanceOf[msg.sender] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    /// @notice Withdraws `amount` of the caller's staked HYDRO. No lock-up,
    /// no penalty — already-earned rewards are unaffected and stay claimable.
    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "HydroStaking: cannot withdraw 0");
        require(stakedBalanceOf[msg.sender] >= amount, "HydroStaking: insufficient staked balance");
        totalStaked -= amount;
        stakedBalanceOf[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Claims the caller's accrued rewards.
    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            token.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /// @notice Withdraws the caller's full staked balance and claims their
    /// rewards in one transaction.
    function exit() external {
        withdraw(stakedBalanceOf[msg.sender]);
        getReward();
    }

    /// @notice Funds a new reward period: pulls `amount` HYDRO from the
    /// owner into the contract and distributes it linearly over
    /// `rewardsDuration` seconds. If a period is still active, its unpaid
    /// remainder rolls into the new one instead of being lost. Reverts if
    /// the resulting rate would promise more than the contract can
    /// actually pay out on top of everyone's staked principal — this
    /// contract can never become insolvent to its stakers.
    function addRewards(uint256 amount) external onlyOwner updateReward(address(0)) {
        require(amount > 0, "HydroStaking: zero reward amount");
        token.safeTransferFrom(msg.sender, address(this), amount);

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (amount + leftover) / rewardsDuration;
        }

        uint256 available = token.balanceOf(address(this)) - totalStaked;
        require(
            rewardRate * rewardsDuration <= available,
            "HydroStaking: reward funding insufficient for promised rate"
        );

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(amount, rewardRate, periodFinish);
    }

    /// @notice Changes how long future reward periods last. Only while no
    /// period is currently active, so the rules can't change under stakers
    /// mid-stream.
    function setRewardsDuration(uint256 newDuration) external onlyOwner {
        require(block.timestamp > periodFinish, "HydroStaking: reward period still active");
        require(newDuration > 0, "HydroStaking: zero duration");
        rewardsDuration = newDuration;
        emit RewardsDurationUpdated(newDuration);
    }
}
