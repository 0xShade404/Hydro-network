import { useState } from "react";
import { parseUnits } from "viem";
import type { WalletClient } from "viem";
import { depositToSettlement, withdrawFromSettlement } from "@hydro/sdk";
import { client } from "../lib/hydro";
import { config } from "../lib/config";

interface BridgeFormProps {
  walletClient: WalletClient | null;
  onSettled: () => void;
}

export function BridgeForm({ walletClient, onSettled }: BridgeFormProps) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = Boolean(walletClient && config.hydroTokenAddress && config.hydroSettlementAddress);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletClient || !config.hydroTokenAddress || !config.hydroSettlementAddress) return;
    setBusy(true);
    setError(null);
    try {
      const amount = parseUnits(depositAmount, 18);
      setStatus("Depositing…");
      const { approveHash, depositHash } = await depositToSettlement(
        client,
        walletClient,
        config.hydroSettlementAddress,
        config.hydroTokenAddress,
        amount
      );
      await client.waitForTransactionReceipt({ hash: depositHash });
      setStatus(approveHash ? `Approved and deposited (${depositHash})` : `Deposited (${depositHash})`);
      setDepositAmount("");
      onSettled();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!walletClient || !config.hydroSettlementAddress) return;
    setBusy(true);
    setError(null);
    try {
      const amount = parseUnits(withdrawAmount, 18);
      setStatus("Withdrawing…");
      const hash = await withdrawFromSettlement(walletClient, config.hydroSettlementAddress, amount);
      await client.waitForTransactionReceipt({ hash });
      setStatus(`Withdrawn (${hash})`);
      setWithdrawAmount("");
      onSettled();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="bridge-form">
      <form onSubmit={handleDeposit}>
        <h3>Deposit (wallet → ledger)</h3>
        <input
          aria-label="deposit amount"
          placeholder="Amount in HYDRO"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          disabled={!ready || busy}
        />
        <button type="submit" disabled={!ready || busy || !depositAmount}>
          Deposit
        </button>
      </form>

      <form onSubmit={handleWithdraw}>
        <h3>Withdraw (ledger → wallet)</h3>
        <input
          aria-label="withdraw amount"
          placeholder="Amount in HYDRO"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          disabled={!ready || busy}
        />
        <button type="submit" disabled={!ready || busy || !withdrawAmount}>
          Withdraw
        </button>
      </form>

      {!ready && (
        <p data-testid="bridge-not-ready">
          Connect a signer and configure VITE_HYDRO_TOKEN_ADDRESS / VITE_HYDRO_SETTLEMENT_ADDRESS to enable
          the bridge.
        </p>
      )}
      {status && <p data-testid="bridge-status">{status}</p>}
      {error && <p data-testid="bridge-error">{error}</p>}
    </div>
  );
}
