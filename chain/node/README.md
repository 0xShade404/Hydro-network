# Node

The Hydro local development network's EVM node, JSON-RPC and block
production are currently provided by Hardhat Network, configured in
`contracts/token/hardhat.config.ts` and documented in
`chain/config/local.json`.

A dedicated Hydro node/sequencer implementation (Phase 2 of the roadmap:
ZK infrastructure, Ethereum settlement) has not been built yet — this
directory is a placeholder for it.

## Running the current local devnet

From the repo root:

```bash
npm run node:dev
```

This starts a JSON-RPC node at `http://127.0.0.1:8545` (chain id `90731`,
see `chain/config/local.json`) with 20 pre-funded, publicly-known test
accounts. It is wallet-compatible (MetaMask, etc.) — add a custom network
pointing at that RPC URL and chain id.

Do not send real funds to this network or its well-known test accounts.
