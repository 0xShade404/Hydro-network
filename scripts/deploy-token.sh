#!/usr/bin/env bash
# Compiles and deploys HydroToken to the local dev network.
# Requires the network to already be running (see dev-network.sh).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm run deploy:local
