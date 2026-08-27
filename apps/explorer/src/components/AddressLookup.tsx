import { useState } from "react";
import type { Address } from "viem";
import { getTokenBalance, getTokenInfo } from "@hydro/sdk";
import { client } from "../lib/hydro";
import { config } from "../lib/config";
import { formatEth, formatTokenAmount } from "../lib/format";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

interface Result {
  address: Address;
  ethBalance: bigint;
  txCount: number;
  hydroBalance: { amount: bigint; decimals: number; symbol: string } | null;
}

export function AddressLookup() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const address = input.trim();
    if (!ADDRESS_RE.test(address)) {
      setError("Enter a valid 0x-prefixed 40-hex-character address.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const addr = address as Address;
      const [ethBalance, txCount] = await Promise.all([
        client.getBalance({ address: addr }),
        client.getTransactionCount({ address: addr }),
      ]);

      let hydroBalance: Result["hydroBalance"] = null;
      if (config.hydroTokenAddress) {
        const [amount, info] = await Promise.all([
          getTokenBalance(client, config.hydroTokenAddress, addr),
          getTokenInfo(client, config.hydroTokenAddress),
        ]);
        hydroBalance = { amount, decimals: info.decimals, symbol: info.symbol };
      }

      setResult({ address: addr, ethBalance, txCount, hydroBalance });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-testid="address-lookup">
      <form onSubmit={lookup}>
        <input
          aria-label="address"
          placeholder="0x…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>

      {error && <p data-testid="address-lookup-error">{error}</p>}

      {result && (
        <dl data-testid="address-lookup-result">
          <dt>Address</dt>
          <dd>{result.address}</dd>
          <dt>ETH balance</dt>
          <dd>{formatEth(result.ethBalance)} ETH</dd>
          <dt>Transaction count</dt>
          <dd>{result.txCount}</dd>
          {result.hydroBalance && (
            <>
              <dt>HYDRO balance</dt>
              <dd>
                {formatTokenAmount(result.hydroBalance.amount, result.hydroBalance.decimals)}{" "}
                {result.hydroBalance.symbol}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
