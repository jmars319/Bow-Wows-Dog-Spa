#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/dev-backend-start.sh"
"$ROOT_DIR/scripts/dev-frontend-start.sh"
"$ROOT_DIR/scripts/dev-admin-start.sh"
