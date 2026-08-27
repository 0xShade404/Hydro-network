# Explorer

A basic block explorer for the Hydro network: latest blocks, block/transaction
detail, and an address lookup (ETH balance, tx count, and HYDRO token
balance if a token address is configured). Built with React + Vite,
reading the chain via `@hydro/sdk`/viem over standard JSON-RPC — no
indexer or backend, everything is fetched live from the node.

## Usage

```bash
npm install                              # from repo root
npm run node:dev                         # start the local devnet (separate terminal)
npm run deploy:local                     # optional: deploy HydroToken to look up its balance
npm run explorer:dev                     # start the explorer at http://localhost:5173
```

Configure via `.env` (see `.env.example`):

- `VITE_RPC_URL` — JSON-RPC endpoint (default `http://127.0.0.1:8545`).
- `VITE_HYDRO_TOKEN_ADDRESS` — HydroToken address to show balances for in
  the address lookup. Optional; the ETH balance and tx count work without it.

## Testing

```bash
npm run test --workspace=apps/explorer
```

Unit tests cover the formatting helpers and the block list / address
lookup components (with the chain client mocked). There is no browser
end-to-end test for the explorer yet — verify manually against a running
devnet, or extend `tests/integration` to cover it.

## Scope

This is the "basic explorer" from the first-milestone roadmap: read-only,
polling-based, no pagination beyond the last N blocks, no search by block
hash or transaction hash (only by block number, via clicking a row). A
production explorer would add an indexer instead of polling the node
directly, search, and pagination.
