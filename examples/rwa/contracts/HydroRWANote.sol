// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title HydroRWANote
/// @notice An RWA example: a fixed-term note representing a fractional
/// claim on an off-chain asset (e.g. a short-term note or invoice),
/// tokenized with the two mechanics that distinguish an RWA token from a
/// plain ERC-20:
///
///  - **Compliance allowlist.** Only issuer-approved (KYC'd) addresses
///    can hold or receive notes — real-world securities/RWA tokens are
///    almost never permissionless. Revoking an address only blocks its
///    *future* transfers; it can still redeem notes it already
///    legitimately holds (removing compliance status isn't confiscation).
///  - **Funded, fixed-term redemption**, not a promise. At or after
///    `maturityTimestamp`, a holder burns notes for a fixed amount of
///    `redemptionAsset` (`redemptionRate`, set once at deployment and
///    never changeable — a holder's terms can't shift after they buy in).
///    That payout can only come from `redemptionAsset` the issuer
///    actually transfers in via `fundRedemption` — this contract has no
///    way to conjure the payout token, so an under-funded maturity fails
///    closed (the transfer reverts) rather than paying out something
///    it doesn't have.
///
/// This is illustrative, not a real security or compliance system: no
/// real KYC/AML integration, no legal wrapper, no oracle-verified
/// off-chain asset backing. `issue`/`setAllowed`/`fundRedemption` are all
/// a single owner key here — a real deployment would put that behind
/// something like contracts/governance or a multisig, not a single EOA.
contract HydroRWANote is ERC20, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable redemptionAsset;
    uint256 public immutable maturityTimestamp;
    /// @notice Redemption payout per note, 18-decimal fixed point
    /// (1e18 = 1:1; 1.05e18 = a note redeems for 1.05x its face amount).
    uint256 public immutable redemptionRate;

    mapping(address => bool) public isAllowed;

    event AllowlistUpdated(address indexed account, bool allowed);
    event Issued(address indexed to, uint256 amount);
    event RedemptionFunded(address indexed funder, uint256 amount);
    event Redeemed(address indexed holder, uint256 noteAmount, uint256 payoutAmount);

    constructor(
        string memory name_,
        string memory symbol_,
        address redemptionAssetAddress,
        uint256 maturityTimestamp_,
        uint256 redemptionRate_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        require(redemptionAssetAddress != address(0), "HydroRWANote: zero redemption asset");
        require(maturityTimestamp_ > block.timestamp, "HydroRWANote: maturity must be in the future");
        require(redemptionRate_ > 0, "HydroRWANote: zero redemption rate");
        redemptionAsset = IERC20(redemptionAssetAddress);
        maturityTimestamp = maturityTimestamp_;
        redemptionRate = redemptionRate_;
    }

    /// @notice Grants or revokes an address's compliance status. Revoking
    /// blocks future transfers to/from `account` but does not affect
    /// notes it already holds — see `redeem`.
    function setAllowed(address account, bool allowed) external onlyOwner {
        isAllowed[account] = allowed;
        emit AllowlistUpdated(account, allowed);
    }

    /// @notice Issues `amount` new notes to `to`, who must already be allowlisted.
    function issue(address to, uint256 amount) external onlyOwner {
        require(isAllowed[to], "HydroRWANote: recipient not allowlisted");
        require(amount > 0, "HydroRWANote: zero amount");
        _mint(to, amount);
        emit Issued(to, amount);
    }

    /// @notice Funds the redemption pool by transferring `amount` of
    /// `redemptionAsset` from the caller into this contract. Anyone can
    /// call this (the issuer, or a third party backstopping the notes);
    /// there's no special permission needed to add funds.
    function fundRedemption(uint256 amount) external {
        require(amount > 0, "HydroRWANote: zero amount");
        redemptionAsset.safeTransferFrom(msg.sender, address(this), amount);
        emit RedemptionFunded(msg.sender, amount);
    }

    /// @notice Burns `amount` of the caller's notes for
    /// `amount * redemptionRate / 1e18` of `redemptionAsset`. Only after
    /// `maturityTimestamp`. Reverts (rather than partially paying) if the
    /// redemption pool isn't funded enough to cover the payout.
    function redeem(uint256 amount) external {
        require(block.timestamp >= maturityTimestamp, "HydroRWANote: not yet matured");
        require(amount > 0, "HydroRWANote: zero amount");

        uint256 payout = (amount * redemptionRate) / 1e18;
        _burn(msg.sender, amount);
        redemptionAsset.safeTransfer(msg.sender, payout);
        emit Redeemed(msg.sender, amount, payout);
    }

    /// @dev Enforces the compliance allowlist on transfers (both legs),
    /// but not on mint (`from == 0`, i.e. `issue`) or burn (`to == 0`,
    /// i.e. `redeem`) — `issue` already separately requires the recipient
    /// to be allowlisted, and `redeem` deliberately does not, so a
    /// holder's existing claim survives a later compliance revocation.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(isAllowed[from] && isAllowed[to], "HydroRWANote: not allowlisted");
        }
        super._update(from, to, value);
    }
}
