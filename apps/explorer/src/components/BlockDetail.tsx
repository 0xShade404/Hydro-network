import type { ExplorerBlock } from "../hooks/useLatestBlocks";
import { formatEth, formatTimestamp, shortenHash } from "../lib/format";

interface BlockDetailProps {
  block: ExplorerBlock | null;
}

export function BlockDetail({ block }: BlockDetailProps) {
  if (!block) {
    return <p data-testid="block-detail-empty">Select a block to see its transactions.</p>;
  }

  return (
    <div data-testid="block-detail">
      <h3>Block #{block.number?.toString()}</h3>
      <dl>
        <dt>Hash</dt>
        <dd>{block.hash}</dd>
        <dt>Timestamp</dt>
        <dd>{formatTimestamp(block.timestamp)}</dd>
        <dt>Gas used</dt>
        <dd>{block.gasUsed.toString()}</dd>
      </dl>

      <h4>Transactions ({block.transactions.length})</h4>
      {block.transactions.length === 0 ? (
        <p>No transactions in this block.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hash</th>
              <th>From</th>
              <th>To</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {block.transactions.map((tx) => (
              <tr key={tx.hash} data-testid={`tx-row-${tx.hash}`}>
                <td>{shortenHash(tx.hash)}</td>
                <td>{shortenHash(tx.from)}</td>
                <td>{tx.to ? shortenHash(tx.to) : "contract creation"}</td>
                <td>{formatEth(tx.value)} ETH</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
