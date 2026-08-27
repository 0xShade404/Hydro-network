import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlockList } from "../src/components/BlockList";
import type { ExplorerBlock } from "../src/hooks/useLatestBlocks";

function fakeBlock(number: bigint): ExplorerBlock {
  return {
    number,
    hash: `0x${number.toString().padStart(64, "0")}`,
    timestamp: 1_700_000_000n,
    transactions: [],
  } as unknown as ExplorerBlock;
}

describe("BlockList", () => {
  it("shows a waiting message when there are no blocks yet", () => {
    render(<BlockList blocks={[]} selectedBlockNumber={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("block-list-empty")).toBeInTheDocument();
  });

  it("renders one row per block", () => {
    const blocks = [fakeBlock(3n), fakeBlock(2n), fakeBlock(1n)];
    render(<BlockList blocks={blocks} selectedBlockNumber={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("block-row-3")).toBeInTheDocument();
    expect(screen.getByTestId("block-row-2")).toBeInTheDocument();
    expect(screen.getByTestId("block-row-1")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked block", () => {
    const onSelect = vi.fn();
    const block = fakeBlock(5n);
    render(<BlockList blocks={[block]} selectedBlockNumber={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("block-row-5"));
    expect(onSelect).toHaveBeenCalledWith(block);
  });
});
