// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title HydroToken
/// @notice The HYDRO network token. Fixed maximum supply, minted once at
/// deployment. There is no mint function: the cap is enforced by
/// construction rather than by a mutable supply check, so it cannot be
/// bypassed by a future upgrade or admin key.
/// @dev This is the basic first-milestone token contract. Staking,
/// governance and vesting behavior are intentionally out of scope here and
/// will live in their own contracts (contracts/staking, contracts/governance)
/// once those modules are built.
contract HydroToken is ERC20 {
    /// @notice Maximum supply: 371,000,000 HYDRO (18 decimals).
    uint256 public constant MAX_SUPPLY = 371_000_000 * 10 ** 18;

    /// @param initialHolder Address that receives the entire initial supply
    /// (e.g. the treasury/deployer multisig). Distribution to the
    /// allocation categories in docs/tokenomics.md happens out-of-band from
    /// this address, not in this contract.
    constructor(address initialHolder) ERC20("Hydro", "HYDRO") {
        require(initialHolder != address(0), "HydroToken: zero initial holder");
        _mint(initialHolder, MAX_SUPPLY);
    }
}
