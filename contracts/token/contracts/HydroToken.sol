// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title HydroToken
/// @notice The HYDRO network token. Fixed maximum supply, minted once at
/// deployment. There is no mint function: the cap is enforced by
/// construction rather than by a mutable supply check, so it cannot be
/// bypassed by a future upgrade or admin key.
/// @dev Adds ERC20Votes (checkpointed voting power, for contracts/governance)
/// and ERC20Permit (gasless approvals) on top of plain ERC20 — both are
/// additive OpenZeppelin extensions; existing balances/transfers/allowances
/// are unaffected. Voting power is NOT automatic: per ERC20Votes' design, a
/// holder must call `delegate` (even to themselves) before their balance
/// counts as votes — see contracts/governance/README.md.
contract HydroToken is ERC20, ERC20Permit, ERC20Votes {
    /// @notice Maximum supply: 371,000,000 HYDRO (18 decimals).
    uint256 public constant MAX_SUPPLY = 371_000_000 * 10 ** 18;

    /// @param initialHolder Address that receives the entire initial supply
    /// (e.g. the treasury/deployer multisig). Distribution to the
    /// allocation categories in docs/tokenomics.md happens out-of-band from
    /// this address, not in this contract.
    constructor(address initialHolder) ERC20("Hydro", "HYDRO") ERC20Permit("Hydro") {
        require(initialHolder != address(0), "HydroToken: zero initial holder");
        _mint(initialHolder, MAX_SUPPLY);
    }

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
