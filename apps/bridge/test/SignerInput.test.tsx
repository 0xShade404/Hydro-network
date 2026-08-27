import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignerInput } from "../src/components/SignerInput";
import type { DevSigner } from "../src/hooks/useDevSigner";

function fakeSigner(overrides: Partial<DevSigner> = {}): DevSigner {
  return {
    privateKeyInput: "",
    setPrivateKeyInput: vi.fn(),
    address: null,
    walletClient: null,
    error: null,
    ...overrides,
  };
}

describe("SignerInput", () => {
  it("shows no address or error by default", () => {
    render(<SignerInput signer={fakeSigner()} />);
    expect(screen.queryByTestId("signer-address")).not.toBeInTheDocument();
    expect(screen.queryByTestId("signer-error")).not.toBeInTheDocument();
  });

  it("shows the connected address once a signer is derived", () => {
    render(
      <SignerInput
        signer={fakeSigner({ address: "0x000000000000000000000000000000000000dEaD" })}
      />
    );
    expect(screen.getByTestId("signer-address")).toHaveTextContent("0x0000…dEaD");
  });

  it("shows a validation error for a malformed key", () => {
    render(<SignerInput signer={fakeSigner({ privateKeyInput: "not-a-key", error: "Enter a valid key." })} />);
    expect(screen.getByTestId("signer-error")).toHaveTextContent("Enter a valid key.");
  });

  it("always shows the dev-only warning", () => {
    render(<SignerInput signer={fakeSigner()} />);
    expect(screen.getByText(/local devnet only/i)).toBeInTheDocument();
  });
});
