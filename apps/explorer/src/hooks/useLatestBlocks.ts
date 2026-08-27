import { useEffect, useRef, useState } from "react";
import type { Block, Transaction } from "viem";
import { client } from "../lib/hydro";

export type ExplorerBlock = Block<bigint, true, "latest", Transaction<bigint, number, false>>;

/**
 * Polls the chain for new blocks and keeps the most recent `limit` of them,
 * newest first. Polling (rather than a websocket subscription) keeps this
 * dependency-free and works against any standard JSON-RPC endpoint.
 */
export function useLatestBlocks(limit = 10, pollIntervalMs = 2000) {
  const [blocks, setBlocks] = useState<ExplorerBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const knownBlockNumber = useRef<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const latest = await client.getBlockNumber({ cacheTime: 0 });
        if (knownBlockNumber.current !== null && latest <= knownBlockNumber.current) {
          return;
        }

        const from =
          knownBlockNumber.current === null
            ? latest - BigInt(limit - 1) > 0n
              ? latest - BigInt(limit - 1)
              : 0n
            : knownBlockNumber.current + 1n;

        const numbers: bigint[] = [];
        for (let n = from; n <= latest; n++) numbers.push(n);

        const fetched = await Promise.all(
          numbers.map((blockNumber) =>
            client.getBlock({ blockNumber, includeTransactions: true })
          )
        );

        if (cancelled) return;
        knownBlockNumber.current = latest;
        setBlocks((prev) =>
          [...fetched.reverse(), ...prev].slice(0, limit) as ExplorerBlock[]
        );
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    poll();
    const interval = setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [limit, pollIntervalMs]);

  return { blocks, error };
}
