#!/usr/bin/env bash
# Starts the Hydro local development network (Hardhat Network JSON-RPC node).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm run node:dev
