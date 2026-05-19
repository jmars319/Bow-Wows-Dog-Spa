#!/usr/bin/env bash

# Automated tests run on isolated ports and pid/log files so normal manual
# review can keep using the permanent dev stack.
ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

export DEV_DIR="${DEV_TEST_DIR:-$ROOT_DIR/.dev/test}"
export DEV_CONFIG_FILE="${DEV_CONFIG_FILE:-/dev/null}"
export DEV_HOST="${DEV_HOST:-127.0.0.1}"
export BACKEND_PORT="${BACKEND_PORT:-4316}"
export FRONTEND_PORT="${FRONTEND_PORT:-4206}"
export ADMIN_PORT="${ADMIN_PORT:-4406}"
export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://$DEV_HOST:$BACKEND_PORT}"
export VITE_ADMIN_PROXY_TARGET="${VITE_ADMIN_PROXY_TARGET:-http://$DEV_HOST:$ADMIN_PORT}"
export BOWWOW_E2E_BASE_URL="${BOWWOW_E2E_BASE_URL:-http://$DEV_HOST:$FRONTEND_PORT}"
export DEV_BROWSER_OPEN="${DEV_BROWSER_OPEN:-0}"
export BOWWOW_SKIP_BROWSER_OPEN="${BOWWOW_SKIP_BROWSER_OPEN:-1}"
