#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm run test:static
npm run test:selectors
npm run security:local
npm run test:unit
npm run build
npm run audit:maintainability -- --strict
npm run budget:bundle
npm run test:e2e
npm run test:flake-report
npm run verify
npm run test:deploy:full-local
npm run test:deploy

echo "[test:all] All checks passed"
