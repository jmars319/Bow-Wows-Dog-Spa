#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR

"$ROOT_DIR/scripts/dev-frontend-stop.sh" || true
"$ROOT_DIR/scripts/dev-frontend-start.sh"
