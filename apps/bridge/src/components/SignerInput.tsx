import type { DevSigner } from "../hooks/useDevSigner";
import { shortenHash } from "../lib/format";

export function SignerInput({ signer }: { signer: DevSigner }) {
  return (
    <div data-testid="signer-input">
      <label htmlFor="private-key">Local devnet private key</label>
      <input
        id="private-key"
        aria-label="private key"
        type="password"
        placeholder="0x… (a local devnet key only — never a real one)"
        value={signer.privateKeyInput}
        onChange={(e) => signer.setPrivateKeyInput(e.target.value)}
        style={{ width: "100%" }}
      />
      <p style={{ fontSize: "0.85em", color: "#a33" }}>
        Local devnet only. Never paste a private key that holds real funds — see the warning
        Hardhat itself prints for its own well-known test accounts.
      </p>
      {signer.error && <p data-testid="signer-error">{signer.error}</p>}
      {signer.address && <p data-testid="signer-address">Connected: {shortenHash(signer.address)}</p>}
    </div>
  );
}
