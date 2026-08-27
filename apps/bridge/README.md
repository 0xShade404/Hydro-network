# Bridge

A deposit/withdraw UI for `chain/settlement`'s `HydroSettlement` contract
— the bridge *primitive* (lock real HYDRO 1:1, credit/debit a ledger)
that a real cross-chain bridge would build on. Read `chain/settlement/README.md`'s
"What this is NOT" section first: there's only one chain here standing in
for both L1 and L2, so this moves HYDRO between a wallet and a ledger on
the *same* chain, not across two real chains.

## Why a pasted private key instead of MetaMask

There's no real second network to bridge to/from yet, so wiring up a
proper wallet-extension (MetaMask/EIP-1193) connection would be building
ahead of what exists to connect it to — and this sandbox has no browser
wallet extension available to actually verify that flow, so shipping it
unverified would violate this project's own "never claim readiness
without testing" rule. Hardhat's local devnet already prints well-known,
publicly-known throwaway private keys on startup with its own "never use
on a live network" warning — `useDevSigner` just makes explicit use of
that same tradeoff instead of pretending a real wallet integration exists.
A real MetaMask connection is natural follow-up work once there's an
actual network worth connecting to.

## Usage

```bash
npm install                              # from repo root
npm run node:dev                         # separate terminal: local devnet
npm run deploy:local --workspace=chain/settlement   # deploys HydroToken + HydroSettlement
npm run bridge:dev                        # start the bridge at http://localhost:5173
```

Configure via `.env` (see `.env.example`) with the addresses
`deploy:local` printed:

- `VITE_RPC_URL` (default `http://127.0.0.1:8545`)
- `VITE_HYDRO_TOKEN_ADDRESS`
- `VITE_HYDRO_SETTLEMENT_ADDRESS`

Paste a local devnet account's private key (Hardhat prints twenty of them
on startup) to connect, then deposit or withdraw HYDRO between your
wallet and the settlement ledger.

## Testing

```bash
npm run test --workspace=apps/bridge
```

11 unit/component tests cover the signer validation, and the deposit/
withdraw forms with `@hydro/sdk` mocked (success, failure, and the
not-ready state). Manually verified end-to-end in a real browser
(Playwright) against a live devnet with real deployed contracts: deposit
and withdraw both moved the exact expected HYDRO amounts between wallet
and ledger balances, with a real transaction hash shown in the UI.
