import type { Balances } from "../hooks/useBalances";
import { formatHydro } from "../lib/format";

export function BalancesPanel({ balances, error }: { balances: Balances; error: string | null }) {
  return (
    <dl data-testid="balances-panel">
      {error && <p data-testid="balances-error">{error}</p>}
      <dt>HYDRO in wallet</dt>
      <dd data-testid="balance-wallet">{formatHydro(balances.hydroWallet)} HYDRO</dd>
      <dt>HYDRO in HydroSettlement ledger</dt>
      <dd data-testid="balance-ledger">{formatHydro(balances.hydroLedger)} HYDRO</dd>
      <dt>ETH (for gas)</dt>
      <dd data-testid="balance-eth">{formatHydro(balances.eth)} ETH</dd>
    </dl>
  );
}
