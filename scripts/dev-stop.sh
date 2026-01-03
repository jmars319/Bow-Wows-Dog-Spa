#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/dev-admin-stop.sh" || true
"$ROOT_DIR/scripts/dev-frontend-stop.sh" || true
"$ROOT_DIR/scripts/dev-backend-stop.sh" || true
