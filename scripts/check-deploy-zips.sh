#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ZIP="$ROOT_DIR/deploy-backend.zip"
FRONTEND_ZIP="$ROOT_DIR/deploy-frontend.zip"
INCLUDE_CLI_TOOLS_IN_DEPLOY="${INCLUDE_CLI_TOOLS_IN_DEPLOY:-false}"

is_true() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

if [[ ! -f "$BACKEND_ZIP" ]] || [[ ! -f "$FRONTEND_ZIP" ]]; then
  echo "[check] Missing deploy zips. Run scripts/make-deploy-zips.sh first." >&2
  exit 1
fi

echo "[check] Frontend zip summary:"
ls -lh "$FRONTEND_ZIP"
FRONTEND_LIST="$(unzip -l "$FRONTEND_ZIP")"
FRONTEND_FILES="$(unzip -Z1 "$FRONTEND_ZIP")"
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

if echo "$BACKEND_FILES" | grep -Fx 'backend/.env.production'; then
  echo "[check][error] backend zip should not include backend/.env.production" >&2
  exit 1
fi

if echo "$BACKEND_FILES" | grep -Fx 'backend/public/seed_admin.php'; then
  echo "[check][error] backend zip must not include backend/public/seed_admin.php" >&2
  exit 1
fi

if is_true "$INCLUDE_CLI_TOOLS_IN_DEPLOY"; then
  if ! echo "$BACKEND_FILES" | grep -Fx 'backend/scripts/seed_admin.php'; then
    echo "[check][error] backend zip should include backend/scripts/seed_admin.php when INCLUDE_CLI_TOOLS_IN_DEPLOY=true" >&2
    exit 1
  fi

  if ! echo "$BACKEND_FILES" | grep -Fx 'backend/scripts/run_migrations.php'; then
    echo "[check][error] backend zip should include backend/scripts/run_migrations.php when INCLUDE_CLI_TOOLS_IN_DEPLOY=true" >&2
    exit 1
  fi
else
  if echo "$BACKEND_FILES" | grep -Fx 'backend/scripts/seed_admin.php'; then
    echo "[check][error] backend zip should not include backend/scripts/seed_admin.php by default" >&2
    exit 1
  fi

  if echo "$BACKEND_FILES" | grep -Fx 'backend/scripts/run_migrations.php'; then
    echo "[check][error] backend zip should not include backend/scripts/run_migrations.php by default" >&2
    exit 1
  fi
fi

if ! echo "$BACKEND_FILES" | grep -Fx 'backend/.env.example'; then
  echo "[check][error] backend zip must include backend/.env.example" >&2
  exit 1
fi

if echo "$BACKEND_FILES" | grep -Fq 'backend/uploads/'; then
  echo "[check][error] backend zip should not include uploads/" >&2
  exit 1
fi

for required_frontend_file in \
  ".htaccess" \
  "index.php" \
  "error-documents/403.html" \
  "error-documents/404.html" \
  "error-documents/500.html" \
  "error-documents/503.html" \
  "error-documents/styles.css" \
  "error-documents/app.js"
do
  if ! echo "$FRONTEND_FILES" | grep -Fx "$required_frontend_file"; then
    echo "[check][error] frontend zip must include $required_frontend_file" >&2
    exit 1
  fi
done

echo "[check] Deploy archives look good."
