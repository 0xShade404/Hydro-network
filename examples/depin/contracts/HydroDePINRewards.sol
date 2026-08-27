// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HydroDePINRewards
/// @notice A DePIN example: node operators earn HYDRO for verified
/// physical-resource contribution (uptime, coverage, compute — whatever
/// the network measures), reported by a trusted `reporter` role. Reuses
/// contracts/staking's exact reward-accrual mechanism (continuous
/// reward-per-unit accounting, funded rather than inflationary
/// distribution) with "reported contribution units" standing in for
/// "staked balance" — the same proven pattern, a different weighting
/// input.
///
/// The most important simplification: `reporter` is a single trusted
/// address here. A real DePIN network verifies physical contribution
/// through some decentralized, hard-to-forge process (multiple
/// independent verifiers reaching consensus, challenge-response
/// protocols, ZK proofs of measurements) — not one address anyone has to
/// trust. Swapping in that verification is the real engineering problem
/// a DePIN project solves; this contract only demonstrates what happens
/// *after* contribution is verified: turning it into a fair, funded
/// reward claim.
contract HydroDePINRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken;
    address public reporter;

    uint256 public rewardsDuration;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerUnitStored;

    mapping(address => uint256) public userRewardPerUnitPaid;
    mapping(address => uint256) public rewards;

    /// @notice Cumulative verified contribution units. Only ever
    /// increases — unlike a stake, past contribution can't be
    /// "unstaked," so there's no withdraw() here.
    uint256 public totalContribution;
    mapping(address => uint256) public contributionOf;

    event ReporterUpdated(address indexed reporter);
    event ContributionReported(address indexed node, uint256 units, uint256 totalForNode);
    event RewardPaid(address indexed node, uint256 amount);
    event RewardAdded(uint256 amount, uint256 rewardRate, uint256 periodFinish);
    event RewardsDurationUpdated(uint256 newDuration);

    constructor(address rewardTokenAddress, address reporter_, uint256 rewardsDuration_) Ownable(msg.sender) {
        require(rewardTokenAddress != address(0), "HydroDePINRewards: zero reward token");
        require(reporter_ != address(0), "HydroDePINRewards: zero reporter");
        require(rewardsDuration_ > 0, "HydroDePINRewards: zero duration");
        rewardToken = IERC20(rewardTokenAddress);
        reporter = reporter_;
        rewardsDuration = rewardsDuration_;
    }

    modifier onlyReporter() {
        require(msg.sender == reporter, "HydroDePINRewards: not reporter");
        _;
    }

    modifier updateReward(address node) {
        rewardPerUnitStored = rewardPerUnit();
        lastUpdateTime = lastTimeRewardApplicable();
        if (node != address(0)) {
            rewards[node] = earned(node);
            userRewardPerUnitPaid[node] = rewardPerUnitStored;
        }
        _;
    }

    /// @notice Changes the trusted attestation source. Takes effect
    /// immediately — the old reporter can no longer report.
    function setReporter(address newReporter) external onlyOwner {
        require(newReporter != address(0), "HydroDePINRewards: zero reporter");
        reporter = newReporter;
        emit ReporterUpdated(newReporter);
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerUnit() public view returns (uint256) {
        if (totalContribution == 0) {
            return rewardPerUnitStored;
        }
        return
            rewardPerUnitStored +
            ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) /
            totalContribution;
    }

    /// @notice Total HYDRO `node` has earned so far and not yet claimed.
    function earned(address node) public view returns (uint256) {
        return
            (contributionOf[node] * (rewardPerUnit() - userRewardPerUnitPaid[node])) /
            1e18 +
            rewards[node];
    }

    /// @notice Records `units` of newly-verified contribution for `node`.
    function reportContribution(address node, uint256 units) external onlyReporter updateReward(node) {
        require(node != address(0), "HydroDePINRewards: zero node");
        require(units > 0, "HydroDePINRewards: zero units");
        totalContribution += units;
        contributionOf[node] += units;
        emit ContributionReported(node, units, contributionOf[node]);
    }

    /// @notice Claims the caller's accrued rewards.
    function claimReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /// @notice Funds a new reward period, exactly like
    /// contracts/staking's addRewards: pulls `amount` from the owner,
    /// rolls any unpaid leftover from an active period into the new rate,
    /// and refuses to promise a rate the contract doesn't hold enough
    /// balance to cover. Unlike staking, the reward token isn't also a
    /// stakeable asset here, so the whole token balance (not
    /// balance-minus-principal) is available to back rewards.
    function addRewards(uint256 amount) external onlyOwner updateReward(address(0)) {
        require(amount > 0, "HydroDePINRewards: zero reward amount");
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (amount + leftover) / rewardsDuration;
        }

        uint256 available = rewardToken.balanceOf(address(this));
        require(
            rewardRate * rewardsDuration <= available,
            "HydroDePINRewards: reward funding insufficient for promised rate"
        );

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(amount, rewardRate, periodFinish);
    }

    /// @notice Changes how long future reward periods last. Only while no
    /// period is currently active.
    function setRewardsDuration(uint256 newDuration) external onlyOwner {
        require(block.timestamp > periodFinish, "HydroDePINRewards: reward period still active");
        require(newDuration > 0, "HydroDePINRewards: zero duration");
        rewardsDuration = newDuration;
        emit RewardsDurationUpdated(newDuration);
    }
}
