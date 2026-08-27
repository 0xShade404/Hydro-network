import { formatEther, formatUnits } from "viem";

/** Shortens a hash/address to `0x1234…abcd` form. */
export function shortenHash(hash: string, chars = 4): string {
  if (hash.length <= 2 + chars * 2) return hash;
  return `${hash.slice(0, 2 + chars)}…${hash.slice(-chars)}`;
}

/** Formats a wei amount as ETH with a fixed number of decimal places. */
export function formatEth(wei: bigint, decimals = 4): string {
  return Number(formatEther(wei)).toFixed(decimals);
}

/** Formats a token amount (base units) using the token's own decimals. */
export function formatTokenAmount(amount: bigint, tokenDecimals: number, decimals = 4): string {
  return Number(formatUnits(amount, tokenDecimals)).toFixed(decimals);
}

/** Formats a unix timestamp (seconds) as a locale time string. */
export function formatTimestamp(unixSeconds: bigint | number): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}
