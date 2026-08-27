// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HydroTreasury
/// @notice Holds HYDRO (or any ERC-20) and ETH, and disburses it only
/// through the owner — intended to be the DAO timelock from
/// contracts/governance, exactly like contracts/staking's ownership. No
/// funds move without a passed governance proposal.
///
/// Deliberately minimal: this is a gated vault, not a budgeting or
/// vesting system. It doesn't track categories, schedules, or per-grant
/// state — every disbursement is a single owner-authorized transfer with
/// an on-chain event, auditable by anyone. Streaming/vesting disbursement
/// (e.g. for grants or team allocations) is a natural extension once
/// there's a concrete need for it, not built preemptively here.
contract HydroTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event TokenDisbursed(address indexed token, address indexed to, uint256 amount, string reason);
    event EthDisbursed(address indexed to, uint256 amount, string reason);
    event EthReceived(address indexed from, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Accepts plain ETH transfers into the treasury.
    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }

    /// @notice Sends `amount` of `token` to `to`. `reason` is a
    /// human-readable note carried in the event for on-chain auditability
    /// (e.g. a grant proposal's description or id) — it has no on-chain
    /// effect.
    function disburseToken(
        address token,
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyOwner nonReentrant {
        require(to != address(0), "HydroTreasury: zero recipient");
        require(amount > 0, "HydroTreasury: zero amount");
        IERC20(token).safeTransfer(to, amount);
        emit TokenDisbursed(token, to, amount, reason);
    }

    /// @notice Sends `amount` wei of ETH to `to`.
    function disburseEth(address payable to, uint256 amount, string calldata reason) external onlyOwner nonReentrant {
        require(to != address(0), "HydroTreasury: zero recipient");
        require(amount > 0, "HydroTreasury: zero amount");
        require(address(this).balance >= amount, "HydroTreasury: insufficient ETH balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "HydroTreasury: ETH transfer failed");
        emit EthDisbursed(to, amount, reason);
    }

    /// @notice Convenience read: this treasury's balance of `token`.
    function tokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
