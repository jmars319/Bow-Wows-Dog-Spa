#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if rg -n "window\\.confirm|window\\.alert|\\balert\\(" frontend/admin-app/src frontend/public-app/src --glob '!**/node_modules/**' --glob '!**/dist/**'; then
  echo "[rough-edges][error] Native confirm/alert calls remain in active frontend source." >&2
  exit 1
fi

if rg -n "future calendar|without connecting any provider|event-writing work still has to be implemented" frontend/admin-app/src docs README.md --glob '!**/node_modules/**' --glob '!**/dist/**'; then
  echo "[rough-edges][error] Calendar copy still describes launch Google Calendar work as future-only." >&2
  exit 1
fi

rg -q "internal pre-launch notes only" frontend/admin-app/src
rg -q "there is no live cart, checkout, payment, shipping, or order management" frontend/admin-app/src

echo "[rough-edges] Admin rough-edge checks passed"
