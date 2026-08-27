import { formatUnits } from "viem";

/** Shortens a hash/address to `0x1234…abcd` form. */
export function shortenHash(hash: string, chars = 4): string {
  if (hash.length <= 2 + chars * 2) return hash;
  return `${hash.slice(0, 2 + chars)}…${hash.slice(-chars)}`;
}

/** Formats an 18-decimal HYDRO amount for display. */
export function formatHydro(amount: bigint, decimals = 4): string {
  return Number(formatUnits(amount, 18)).toFixed(decimals);
}
