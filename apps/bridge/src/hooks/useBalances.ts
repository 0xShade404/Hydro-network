import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { getSettlementBalance, getTokenBalance } from "@hydro/sdk";
import { client } from "../lib/hydro";
import { config } from "../lib/config";

export interface Balances {
  eth: bigint;
  hydroWallet: bigint;
  hydroLedger: bigint;
}

const ZERO: Balances = { eth: 0n, hydroWallet: 0n, hydroLedger: 0n };

/** Polls a connected account's ETH balance, HYDRO wallet balance, and HydroSettlement ledger balance. */
export function useBalances(address: Address | null, pollIntervalMs = 3000) {
  const [balances, setBalances] = useState<Balances>(ZERO);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setBalances(ZERO);
      return;
    }
    try {
      const [eth, hydroWallet, hydroLedger] = await Promise.all([
        client.getBalance({ address }),
        config.hydroTokenAddress
          ? getTokenBalance(client, config.hydroTokenAddress, address)
          : Promise.resolve(0n),
        config.hydroSettlementAddress
          ? getSettlementBalance(client, config.hydroSettlementAddress, address)
          : Promise.resolve(0n),
      ]);
      setBalances({ eth, hydroWallet, hydroLedger });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [address]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  return { balances, error, refresh };
}
