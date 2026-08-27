# Scripts

Developer convenience wrappers around the root `package.json` scripts.

| Script | What it does |
|---|---|
| `dev-network.sh` | Starts the local Hydro dev network (JSON-RPC on `:8545`). |
| `deploy-token.sh` | Compiles and deploys `HydroToken` to the running dev network. |
| `test-all.sh` | Compiles contracts and runs contract, SDK and integration tests. |

Run any of them from the repo root, e.g. `./scripts/dev-network.sh`.
