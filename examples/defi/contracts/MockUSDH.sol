// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDH
/// @notice A trivial mintable stablecoin stand-in, for pairing against
/// HYDRO in the AMM example. Not a real, collateral-backed stablecoin —
/// `mint` is open to anyone, which is obviously wrong for anything but a
/// local demo/test fixture.
contract MockUSDH is ERC20 {
    constructor() ERC20("Mock USDH", "USDH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
