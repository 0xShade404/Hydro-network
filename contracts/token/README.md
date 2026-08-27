# Token Contracts

`HydroToken.sol` — the HYDRO ERC-20 token. Fixed max supply
(371,000,000 HYDRO), minted entirely to a specified initial holder at
deployment. No mint function exists, so the cap cannot be raised later.

Staking, governance and treasury contracts are separate, not-yet-built
modules (`contracts/staking`, `contracts/governance`, `contracts/treasury`).

## Why not Foundry

The project's target stack prefers Foundry, but this environment's network
policy blocks `binaries.soliditylang.org`, which both `forge` and Hardhat's
own compiler downloader need. Contracts are instead compiled with the
npm-installed `solc` package (`scripts/compile.ts`), which bundles the
compiler binary so no extra network access is required beyond `npm install`.
The output artifacts match Hardhat's own format exactly, so
`hardhat-ethers`, `hardhat node`, and everything downstream (SDK,
integration tests) work unmodified. Swap in Foundry later if the network
policy changes — nothing here depends on this workaround beyond the
`compile` script.

## Usage

```bash
npm install               # from repo root
npm run compile --workspace=contracts/token
npm run test --workspace=contracts/token
npm run node --workspace=contracts/token       # start local devnet
npm run deploy:local --workspace=contracts/token
```

Or via the root scripts: `npm run compile`, `npm run test:contracts`,
`npm run node:dev`, `npm run deploy:local`.
