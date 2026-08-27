#!/usr/bin/env bash
# Compiles contracts and runs the full test suite: contract unit tests,
# SDK unit tests, and the local-devnet integration test.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm run test:all
