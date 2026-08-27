import { useState } from "react";
import { useLatestBlocks, type ExplorerBlock } from "./hooks/useLatestBlocks";
import { BlockList } from "./components/BlockList";
import { BlockDetail } from "./components/BlockDetail";
import { AddressLookup } from "./components/AddressLookup";
import { config } from "./lib/config";

export function App() {
  const { blocks, error } = useLatestBlocks();
  const [selected, setSelected] = useState<ExplorerBlock | null>(null);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 960, margin: "2rem auto" }}>
      <h1>Hydro Explorer</h1>
      <p>
        Connected to <code>{config.rpcUrl}</code>
      </p>
      {error && <p data-testid="rpc-error">RPC error: {error}</p>}

      <section>
        <h2>Address lookup</h2>
        <AddressLookup />
      </section>

      <section>
        <h2>Latest blocks</h2>
        <BlockList blocks={blocks} selectedBlockNumber={selected?.number ?? null} onSelect={setSelected} />
      </section>

      <section>
        <h2>Block detail</h2>
        <BlockDetail block={selected} />
      </section>
    </main>
  );
}
