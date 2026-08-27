import { defineChain } from "viem";

/**
 * Hydro's local development network. Chain id must match
 * chain/config/local.json and contracts/token/hardhat.config.ts. This is a
 * provisional devnet id, not an assigned mainnet/testnet id.
 */
export const hydroLocal = defineChain({
  id: 90731,
  name: "Hydro Local Devnet",
  nativeCurrency: { name: "Hydro Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});
