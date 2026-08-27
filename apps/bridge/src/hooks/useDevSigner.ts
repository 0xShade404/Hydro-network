import { useMemo, useState } from "react";
import { createHydroWalletClient } from "@hydro/sdk";
import type { Address, WalletClient } from "viem";

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export interface DevSigner {
  privateKeyInput: string;
  setPrivateKeyInput: (value: string) => void;
  address: Address | null;
  walletClient: WalletClient | null;
  error: string | null;
}

/**
 * A signer for the local Hydro devnet, derived from a pasted private key —
 * not a real wallet connection (MetaMask/EIP-1193 support is future work,
 * see apps/bridge/README.md). This exists because the local devnet's own
 * accounts are already publicly-known throwaway keys (Hardhat prints them
 * on startup, with its own "never use on a live network" warning) — this
 * hook makes the same tradeoff explicit rather than pretending a real
 * wallet integration exists before there's a real network to connect it to.
 */
export function useDevSigner(): DevSigner {
  const [privateKeyInput, setPrivateKeyInput] = useState("");

  return useMemo(() => {
    const trimmed = privateKeyInput.trim();
    if (trimmed.length === 0) {
      return { privateKeyInput, setPrivateKeyInput, address: null, walletClient: null, error: null };
    }
    if (!PRIVATE_KEY_RE.test(trimmed)) {
      return {
        privateKeyInput,
        setPrivateKeyInput,
        address: null,
        walletClient: null,
        error: "Enter a valid 0x-prefixed 64-hex-character private key.",
      };
    }
    const walletClient = createHydroWalletClient(trimmed as `0x${string}`);
    return {
      privateKeyInput,
      setPrivateKeyInput,
      address: walletClient.account!.address,
      walletClient,
      error: null,
    };
  }, [privateKeyInput]);
}
