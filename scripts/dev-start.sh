#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-common.sh"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/dev-browser.sh"

"$ROOT_DIR/scripts/dev-backend-start.sh"
"$ROOT_DIR/scripts/dev-frontend-start.sh"
"$ROOT_DIR/scripts/dev-admin-start.sh"

PUBLIC_URL="http://$(browser_host):${FRONTEND_PORT}"
open_dev_browser "$PUBLIC_URL"
