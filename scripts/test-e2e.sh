#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR
# shellcheck source=dev-test-ports.sh
source "$ROOT_DIR/scripts/dev-test-ports.sh"

env -u NO_COLOR FORCE_COLOR=0 DEV_BROWSER_OPEN=0 playwright test
