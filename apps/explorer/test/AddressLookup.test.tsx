import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../src/lib/hydro", () => ({
  client: {
    getBalance: vi.fn(),
    getTransactionCount: vi.fn(),
  },
}));

vi.mock("@hydro/sdk", () => ({
  getTokenBalance: vi.fn(),
  getTokenInfo: vi.fn(),
}));

vi.mock("../src/lib/config", () => ({
  config: { rpcUrl: "http://127.0.0.1:8545", hydroTokenAddress: "" },
}));

import { AddressLookup } from "../src/components/AddressLookup";
import { client } from "../src/lib/hydro";

const VALID_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("AddressLookup", () => {
  beforeEach(() => {
    vi.mocked(client.getBalance).mockReset();
    vi.mocked(client.getTransactionCount).mockReset();
  });

  it("rejects an invalid address without calling the RPC", async () => {
    render(<AddressLookup />);
    fireEvent.change(screen.getByLabelText("address"), { target: { value: "not-an-address" } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(await screen.findByTestId("address-lookup-error")).toHaveTextContent(
      "valid 0x-prefixed"
    );
    expect(client.getBalance).not.toHaveBeenCalled();
  });

  it("shows the ETH balance and tx count for a valid address", async () => {
    vi.mocked(client.getBalance).mockResolvedValue(2_500_000_000_000_000_000n);
    vi.mocked(client.getTransactionCount).mockResolvedValue(7);

    render(<AddressLookup />);
    fireEvent.change(screen.getByLabelText("address"), { target: { value: VALID_ADDRESS } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    const result = await screen.findByTestId("address-lookup-result");
    expect(result).toHaveTextContent("2.5000 ETH");
    expect(result).toHaveTextContent("7");
    expect(client.getBalance).toHaveBeenCalledWith({ address: VALID_ADDRESS });
  });
});
