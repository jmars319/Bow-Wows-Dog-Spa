#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if rg -n "window\\.confirm|window\\.alert|\\balert\\(" frontend/admin-app/src frontend/public-app/src --glob '!**/node_modules/**' --glob '!**/dist/**'; then
  echo "[rough-edges][error] Native confirm/alert calls remain in active frontend source." >&2
  exit 1
fi

if rg -n "Calendar Sync" frontend/admin-app/src/App.jsx; then
  echo "[rough-edges][error] Admin should present future calendar work as Calendar Prep." >&2
  exit 1
fi

rg -q "internal pre-launch notes only" frontend/admin-app/src/App.jsx
rg -q "Internal pre-launch setup only" frontend/admin-app/src/App.jsx

echo "[rough-edges] Admin rough-edge checks passed"
