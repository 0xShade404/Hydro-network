import type { ExplorerBlock } from "../hooks/useLatestBlocks";
import { formatTimestamp, shortenHash } from "../lib/format";

interface BlockListProps {
  blocks: ExplorerBlock[];
  selectedBlockNumber: bigint | null;
  onSelect: (block: ExplorerBlock) => void;
}

export function BlockList({ blocks, selectedBlockNumber, onSelect }: BlockListProps) {
  if (blocks.length === 0) {
    return <p data-testid="block-list-empty">Waiting for blocks…</p>;
  }

  return (
    <table data-testid="block-list">
      <thead>
        <tr>
          <th>Block</th>
          <th>Hash</th>
          <th>Time</th>
          <th>Txns</th>
        </tr>
      </thead>
      <tbody>
        {blocks.map((block) => (
          <tr
            key={block.hash}
            data-testid={`block-row-${block.number}`}
            aria-selected={block.number === selectedBlockNumber}
            onClick={() => onSelect(block)}
            style={{ cursor: "pointer" }}
          >
            <td>{block.number?.toString()}</td>
            <td>{block.hash ? shortenHash(block.hash) : "—"}</td>
            <td>{formatTimestamp(block.timestamp)}</td>
            <td>{block.transactions.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
