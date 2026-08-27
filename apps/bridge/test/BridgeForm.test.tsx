import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const TOKEN = "0x0000000000000000000000000000000000000001";
const SETTLEMENT = "0x0000000000000000000000000000000000000002";

// vi.mock factories are hoisted above top-level const declarations, so the
// addresses are inlined here rather than referencing TOKEN/SETTLEMENT.
vi.mock("../src/lib/config", () => ({
  config: {
    rpcUrl: "http://127.0.0.1:8545",
    hydroTokenAddress: "0x0000000000000000000000000000000000000001",
    hydroSettlementAddress: "0x0000000000000000000000000000000000000002",
  },
}));

vi.mock("../src/lib/hydro", () => ({
  client: { waitForTransactionReceipt: vi.fn().mockResolvedValue({}) },
}));

vi.mock("@hydro/sdk", () => ({
  depositToSettlement: vi.fn(),
  withdrawFromSettlement: vi.fn(),
}));

import { BridgeForm } from "../src/components/BridgeForm";
import { depositToSettlement, withdrawFromSettlement } from "@hydro/sdk";

const fakeWalletClient = { account: { address: "0xabc" } } as any;

describe("BridgeForm", () => {
  beforeEach(() => {
    vi.mocked(depositToSettlement).mockReset();
    vi.mocked(withdrawFromSettlement).mockReset();
  });

  it("shows the not-ready message when there is no connected signer", () => {
    render(<BridgeForm walletClient={null} onSettled={vi.fn()} />);
    expect(screen.getByTestId("bridge-not-ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deposit/i })).toBeDisabled();
  });

  it("deposits the entered amount and reports success", async () => {
    vi.mocked(depositToSettlement).mockResolvedValue({ depositHash: "0xdeposit" as any });
    const onSettled = vi.fn();
    render(<BridgeForm walletClient={fakeWalletClient} onSettled={onSettled} />);

    fireEvent.change(screen.getByLabelText("deposit amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /^deposit$/i }));

    await waitFor(() => expect(screen.getByTestId("bridge-status")).toHaveTextContent("0xdeposit"));
    expect(depositToSettlement).toHaveBeenCalledWith(
      expect.anything(),
      fakeWalletClient,
      SETTLEMENT,
      TOKEN,
      100n * 10n ** 18n
    );
    expect(onSettled).toHaveBeenCalled();
  });

  it("withdraws the entered amount and reports success", async () => {
    vi.mocked(withdrawFromSettlement).mockResolvedValue("0xwithdraw" as any);
    const onSettled = vi.fn();
    render(<BridgeForm walletClient={fakeWalletClient} onSettled={onSettled} />);

    fireEvent.change(screen.getByLabelText("withdraw amount"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /^withdraw$/i }));

    await waitFor(() => expect(screen.getByTestId("bridge-status")).toHaveTextContent("0xwithdraw"));
    expect(withdrawFromSettlement).toHaveBeenCalledWith(fakeWalletClient, SETTLEMENT, 50n * 10n ** 18n);
    expect(onSettled).toHaveBeenCalled();
  });

  it("shows an error message when a deposit fails", async () => {
    vi.mocked(depositToSettlement).mockRejectedValue(new Error("insufficient funds"));
    render(<BridgeForm walletClient={fakeWalletClient} onSettled={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("deposit amount"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /^deposit$/i }));

    await waitFor(() => expect(screen.getByTestId("bridge-error")).toHaveTextContent("insufficient funds"));
  });
});
