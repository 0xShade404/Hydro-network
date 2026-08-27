# Tests

Cross-package integration tests — currently `integration/localDevNetwork.test.ts`,
which spins up the local Hydro devnet, deploys `HydroToken`, and exercises
`@hydro/sdk` against it end-to-end.

Package-local unit tests live next to their code instead
(`contracts/token/test`, `sdk/hydro-sdk/test`).

## Usage

```bash
npm install               # from repo root
npm run compile            # compiles HydroToken so the integration test can deploy it
npm run test:integration
```

Or `npm run test:all` from the repo root to run contract, SDK, and
integration tests together.
