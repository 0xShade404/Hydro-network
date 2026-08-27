import { useDevSigner } from "./hooks/useDevSigner";
import { useBalances } from "./hooks/useBalances";
import { SignerInput } from "./components/SignerInput";
import { BalancesPanel } from "./components/BalancesPanel";
import { BridgeForm } from "./components/BridgeForm";
import { config } from "./lib/config";

export function App() {
  const signer = useDevSigner();
  const { balances, error: balancesError, refresh } = useBalances(signer.address);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "2rem auto" }}>
      <h1>Hydro Bridge</h1>
      <p>
        Locks/releases HYDRO 1:1 against <code>chain/settlement</code>'s ledger. Connected to{" "}
        <code>{config.rpcUrl}</code>.
      </p>

      <section>
        <h2>Signer</h2>
        <SignerInput signer={signer} />
      </section>

      <section>
        <h2>Balances</h2>
        <BalancesPanel balances={balances} error={balancesError} />
      </section>

      <section>
        <h2>Bridge</h2>
        <BridgeForm walletClient={signer.walletClient} onSettled={refresh} />
      </section>
    </main>
  );
}
