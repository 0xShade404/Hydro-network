// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title HydroSwapPair
/// @notice A minimal constant-product AMM (`x * y = k`) for a single
/// token0/token1 pair — the core DeFi primitive, following Uniswap V2's
/// well-audited math (constant-product pricing, a 0.3% swap fee, and the
/// same minimum-liquidity lock on first deposit) rather than inventing a
/// novel pricing mechanism.
///
/// Deliberately smaller than real Uniswap V2: one pair per contract (no
/// factory/router), and `swap` pulls the input token via `transferFrom`
/// inside the call (the caller must `approve` first) instead of Uniswap's
/// flash-swap-capable "check the balance you already received" pattern —
/// simpler to reason about, at the cost of not supporting flash swaps.
/// LP shares are themselves an ERC-20 (`HYDRO-LP`), exactly like Uniswap
/// V2's pair contracts.
contract HydroSwapPair is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Permanently locked into the first liquidity provision (sent
    /// to a burn address, since OZ's ERC20 reverts on minting to the zero
    /// address) so the pool can never be fully drained of LP supply and an
    /// attacker can't manipulate the initial price with a 1-wei deposit.
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    /// @notice Swap fee: 0.3%, taken from the input amount (Uniswap V2's rate).
    uint256 public constant FEE_NUMERATOR = 997;
    uint256 public constant FEE_DENOMINATOR = 1000;

    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;

    event Mint(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Burn(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Swap(address indexed trader, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address token0Address, address token1Address) ERC20("Hydro LP", "HYDRO-LP") {
        require(token0Address != address(0) && token1Address != address(0), "HydroSwapPair: zero token address");
        require(token0Address != token1Address, "HydroSwapPair: identical tokens");
        token0 = IERC20(token0Address);
        token1 = IERC20(token1Address);
    }

    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = balance0;
        reserve1 = balance1;
    }

    /// @notice Deposits exactly `amount0Desired` of token0 and
    /// `amount1Desired` of token1, minting LP tokens in return. After the
    /// first deposit, only the limiting side (by the pool's current price)
    /// is credited — supplying an imperfect ratio donates the excess to
    /// the pool rather than reverting, matching Uniswap V2's Pair-level
    /// behavior (a Router would normally compute the optimal amounts
    /// first; this contract doesn't have one).
    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired) external nonReentrant returns (uint256 liquidity) {
        require(amount0Desired > 0 && amount1Desired > 0, "HydroSwapPair: zero amount");

        uint256 supply = totalSupply();
        if (supply == 0) {
            liquidity = Math.sqrt(amount0Desired * amount1Desired) - MINIMUM_LIQUIDITY;
            _mint(BURN_ADDRESS, MINIMUM_LIQUIDITY);
        } else {
            liquidity = Math.min(
                (amount0Desired * supply) / reserve0,
                (amount1Desired * supply) / reserve1
            );
        }
        require(liquidity > 0, "HydroSwapPair: insufficient liquidity minted");

        token0.safeTransferFrom(msg.sender, address(this), amount0Desired);
        token1.safeTransferFrom(msg.sender, address(this), amount1Desired);
        _mint(msg.sender, liquidity);
        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));

        emit Mint(msg.sender, amount0Desired, amount1Desired, liquidity);
    }

    /// @notice Burns `liquidity` LP tokens for a proportional share of the
    /// pool's *current* balances (including any fees accrued since the
    /// caller deposited), exactly like Uniswap V2's Pair.burn().
    function removeLiquidity(uint256 liquidity) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(liquidity > 0, "HydroSwapPair: zero liquidity");

        uint256 supply = totalSupply();
        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));
        amount0 = (liquidity * balance0) / supply;
        amount1 = (liquidity * balance1) / supply;
        require(amount0 > 0 && amount1 > 0, "HydroSwapPair: insufficient liquidity burned");

        _burn(msg.sender, liquidity);
        token0.safeTransfer(msg.sender, amount0);
        token1.safeTransfer(msg.sender, amount1);
        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));

        emit Burn(msg.sender, amount0, amount1, liquidity);
    }

    /// @notice Swaps `amountIn` of `tokenIn` (must be `token0` or
    /// `token1`) for the other token, at the constant-product price minus
    /// the 0.3% fee. Reverts if the output would be less than
    /// `minAmountOut` (slippage protection).
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "HydroSwapPair: zero amount in");
        require(tokenIn == address(token0) || tokenIn == address(token1), "HydroSwapPair: invalid token");
        bool zeroForOne = tokenIn == address(token0);
        (IERC20 tokenInErc, IERC20 tokenOutErc, uint256 reserveIn, uint256 reserveOut) = zeroForOne
            ? (token0, token1, reserve0, reserve1)
            : (token1, token0, reserve1, reserve0);
        require(reserveIn > 0 && reserveOut > 0, "HydroSwapPair: no liquidity");

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
        require(amountOut >= minAmountOut, "HydroSwapPair: slippage exceeded");
        require(amountOut < reserveOut, "HydroSwapPair: insufficient reserve");

        tokenInErc.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenOutErc.safeTransfer(msg.sender, amountOut);
        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));

        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }

    /// @notice Quotes the output amount for a hypothetical swap, without
    /// executing it — the same formula `swap` uses.
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256) {
        require(tokenIn == address(token0) || tokenIn == address(token1), "HydroSwapPair: invalid token");
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == address(token0)
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
        if (reserveIn == 0 || reserveOut == 0) return 0;
        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        return (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
    }
}
