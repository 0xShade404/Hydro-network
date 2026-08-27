# DeFi Example: Constant-Product AMM

`HydroSwapPair.sol` — a minimal automated market maker for a single
HYDRO/`MockUSDH` pair, following Uniswap V2's well-audited core math
(`x * y = k` pricing, a 0.3% swap fee, the same minimum-liquidity burn on
first deposit) rather than a novel pricing mechanism. LP shares are
themselves an ERC-20 (`HYDRO-LP`), exactly like Uniswap V2's pair
contracts.

`MockUSDH.sol` is a trivial mintable stablecoin stand-in for pairing
against — `mint` is open to anyone, which is obviously wrong for anything
but this local demo.

## Simplifications vs. real Uniswap V2

- **One pair per contract, no factory/router.** Real Uniswap V2 deploys
  pairs from a factory at deterministic addresses and routes multi-hop
  swaps through a separate router contract. This is just the core pair
  logic.
- **`swap` pulls funds via `transferFrom` inside the call**, not Uniswap's
  flash-swap-capable "check the balance you already received" pattern —
  simpler to reason about, at the cost of not supporting flash swaps.
- **No optimal-ratio liquidity math.** A real router computes the ideal
  `amount0`/`amount1` pair before calling in. Here, supplying an
  imperfect ratio after the first deposit only credits the limiting
  side — the excess is effectively donated to the pool, matching what
  Uniswap V2's Pair contract itself does when called directly (as opposed
  to through its Router).

## Usage

```bash
npm install                                    # from repo root
npm run test --workspace=examples/defi
npm run node:dev                                # separate terminal: local devnet
npm run deploy:local --workspace=examples/defi
```

`deploy:local` deploys HydroToken, MockUSDH, and a pair seeded with
100,000 HYDRO / 400,000 USDH (a 1:4 price).

## Testing

8 tests cover: first-deposit LP minting (`sqrt(x*y) - MINIMUM_LIQUIDITY`,
with the minimum locked to a burn address), proportional minting on
later deposits, swap output matching the quoted `getAmountOut`, the
constant product `k` strictly increasing after a swap (proof the fee is
actually retained by the pool), slippage protection, rejecting an
out-of-pair token, and withdrawal returning a proportional share of
current balances — including any fees accrued since deposit. Also
manually verified against a live devnet.
