#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm run test:static
npm run test:unit
npm run build
npm run test:e2e
npm run verify
npm run test:deploy

echo "[test:all] All checks passed"
