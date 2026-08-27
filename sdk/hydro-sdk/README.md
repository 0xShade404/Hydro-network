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
- `getTokenInfo`, `getTokenBalance`, `transferToken`, `getAllowance`,
  `approveToken` — ERC-20 helpers (work against `HydroToken` or any other
  standard ERC-20). `erc20Abi` is the ABI they use.
- `getSettlementBalance`, `depositToSettlement`, `withdrawFromSettlement`
  — `chain/settlement`'s deposit/withdraw bridge primitive.
  `depositToSettlement` checks the existing allowance first and only
  sends an `approve` if it isn't already enough. `hydroSettlementAbi` is
  the ABI these use.

Staking/governance-specific methods aren't here yet — `apps/bridge` is the
first app built on this SDK beyond `apps/explorer`.

## Usage

```bash
npm install                                 # from repo root
npm run build --workspace=sdk/hydro-sdk
npm run test --workspace=sdk/hydro-sdk
```
