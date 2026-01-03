#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ZIP="$ROOT_DIR/deploy-backend.zip"
FRONTEND_ZIP="$ROOT_DIR/deploy-frontend.zip"

if [[ ! -f "$BACKEND_ZIP" ]] || [[ ! -f "$FRONTEND_ZIP" ]]; then
  echo "[check] Missing deploy zips. Run scripts/make-deploy-zips.sh first." >&2
  exit 1
fi

echo "[check] Frontend zip summary:"
ls -lh "$FRONTEND_ZIP"
FRONTEND_LIST="$(unzip -l "$FRONTEND_ZIP")"
echo "$FRONTEND_LIST" | head -n 40

echo "[check] Backend zip summary:"
ls -lh "$BACKEND_ZIP"
BACKEND_LIST="$(unzip -l "$BACKEND_ZIP")"
BACKEND_FILES="$(unzip -Z1 "$BACKEND_ZIP")"
echo "$BACKEND_LIST" | head -n 40

if echo "$BACKEND_FILES" | grep -Fx 'backend/config/config.php'; then
  echo "[check][error] backend zip should not include config/config.php" >&2
  exit 1
fi

if echo "$BACKEND_FILES" | grep -Fx 'backend/.env'; then
  echo "[check][error] backend zip should not include backend/.env" >&2
  exit 1
fi

if ! echo "$BACKEND_FILES" | grep -Fx 'backend/.env.example'; then
  echo "[check][error] backend zip must include backend/.env.example" >&2
  exit 1
fi

if echo "$BACKEND_FILES" | grep -Fq 'backend/uploads/'; then
  echo "[check][error] backend zip should not include uploads/" >&2
  exit 1
fi

echo "[check] Deploy archives look good."
