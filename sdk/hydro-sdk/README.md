# Hydro SDK

A minimal TypeScript client for the Hydro network, built on
[viem](https://viem.sh).

```ts
import { createHydroClient, createHydroWalletClient, getTokenInfo, getTokenBalance, transferToken } from "@hydro/sdk";

const client = createHydroClient(); // defaults to the local devnet
const info = await getTokenInfo(client, tokenAddress);

const wallet = createHydroWalletClient(privateKey);
await transferToken(wallet, tokenAddress, recipient, amount);
```

Exports:

- `hydroLocal` — the local devnet chain definition (chain id `90731`).
- `createHydroClient(options?)` — a read-only `PublicClient`.
- `createHydroWalletClient(privateKey, options?)` — a signing `WalletClient`.
- `getTokenInfo`, `getTokenBalance`, `transferToken` — ERC-20 helpers (works
  against `HydroToken` or any other standard ERC-20).
- `erc20Abi` — the standard ERC-20 ABI these helpers use.

This SDK currently only knows the standard ERC-20 surface, since that's all
`HydroToken` exposes today. Staking/governance/bridge-specific methods will
be added once those contracts exist.

## Usage

```bash
npm install                                 # from repo root
npm run build --workspace=sdk/hydro-sdk
npm run test --workspace=sdk/hydro-sdk
```
