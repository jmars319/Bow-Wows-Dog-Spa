#!/usr/bin/env bash
# This template uses defaulted exports so sourcing it directly matches the repo defaults.
export DEV_HOST="${DEV_HOST:-127.0.0.1}"
export BACKEND_PORT="${BACKEND_PORT:-3316}"
export FRONTEND_PORT="${FRONTEND_PORT:-3206}"
export ADMIN_PORT="${ADMIN_PORT:-3406}"
export BACKEND_DIR="${BACKEND_DIR:-$ROOT_DIR/backend}"
export FRONTEND_PUBLIC_DIR="${FRONTEND_PUBLIC_DIR:-$ROOT_DIR/frontend/public-app}"
export FRONTEND_ADMIN_DIR="${FRONTEND_ADMIN_DIR:-$ROOT_DIR/frontend/admin-app}"
export DEV_BROWSER_OPEN="${DEV_BROWSER_OPEN:-1}"
export DEV_BROWSER="${DEV_BROWSER:-default}"
