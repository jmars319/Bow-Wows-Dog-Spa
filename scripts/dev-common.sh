#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEV_DIR="$ROOT_DIR/.dev"
mkdir -p "$DEV_DIR"

for required in curl lsof; do
  if ! command -v "$required" >/dev/null 2>&1; then
    >&2 echo "[dev][error] Command '$required' is required."
    exit 1
  fi
done

DEFAULT_DEV_HOST="127.0.0.1"
DEFAULT_BACKEND_PORT="8088"
DEFAULT_FRONTEND_PORT="5173"
DEFAULT_ADMIN_PORT="5174"

if [[ -f "$ROOT_DIR/.dev/dev-config.sh" ]]; then
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.dev/dev-config.sh"
fi

DEV_HOST="${DEV_HOST:-$DEFAULT_DEV_HOST}"
BACKEND_PORT="${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}"
FRONTEND_PORT="${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}"
BACKEND_DIR="${BACKEND_DIR:-$ROOT_DIR/backend}"
BACKEND_PUBLIC_DIR="${BACKEND_PUBLIC_DIR:-$BACKEND_DIR/public}"
FRONTEND_PUBLIC_DIR="${FRONTEND_PUBLIC_DIR:-$ROOT_DIR/frontend/public-app}"
FRONTEND_ADMIN_DIR="${FRONTEND_ADMIN_DIR:-$ROOT_DIR/frontend/admin-app}"
ADMIN_PORT="${ADMIN_PORT:-$DEFAULT_ADMIN_PORT}"

COLOR_RESET=$'\033[0m'
COLOR_GREEN=$'\033[32m'
COLOR_RED=$'\033[31m'
COLOR_YELLOW=$'\033[33m'
COLOR_BLUE=$'\033[36m'

function log() {
  printf '[dev] %s\n' "$*"
}

function error() {
  printf >&2 '[dev][error] %s\n' "$*"
}

function colorize() {
  local color=$1
  shift
  printf '%s%s%s' "$color" "$*" "$COLOR_RESET"
}

function status_tag() {
  local kind=$1
  case "$kind" in
    success) colorize "$COLOR_GREEN" "SUCCESS" ;;
    warn) colorize "$COLOR_YELLOW" "WARN" ;;
    error) colorize "$COLOR_RED" "FAIL" ;;
    *) colorize "$COLOR_BLUE" "INFO" ;;
  esac
}

function log_status() {
  local label=$1
  local kind=$2
  local message=$3
  printf '[dev] %-8s %s %s\n' "$label" "$(status_tag "$kind")" "$message"
}

function pid_file() {
  printf '%s/%s.pid' "$DEV_DIR" "$1"
}

function log_file() {
  printf '%s/%s.log' "$DEV_DIR" "$1"
}

function read_pid() {
  local file
  file=$(pid_file "$1")
  if [[ -f "$file" ]]; then
    cat "$file"
  fi
}

function write_pid() {
  local name=$1
  local pid=$2
  echo "$pid" > "$(pid_file "$name")"
}

function remove_pid() {
  rm -f "$(pid_file "$1")"
}

function ensure_not_running() {
  local pid
  pid=$(read_pid "$1" || true)
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    log_status "$1" "error" "Already running (PID $pid). Stop it first."
    exit 1
  fi
}

function stop_service() {
  local name=$1
  local pid
  pid=$(read_pid "$name" || true)
  if [[ -z "${pid:-}" ]]; then
    log_status "$name" "info" "Already stopped"
    return
  fi

  if kill "$pid" >/dev/null 2>&1; then
    log_status "$name" "info" "Stopping (PID $pid)"
    wait "$pid" 2>/dev/null || true
  else
    log_status "$name" "error" "Unable to stop (PID $pid)"
  fi

  remove_pid "$name"
}

function wait_for_url() {
  local url=$1
  local attempts=${2:-30}
  for ((i=0; i<attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

function port_status() {
  local port=$1
  if lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | grep -q ":$port "; then
    printf 'listening:%s' "$port"
  else
    printf 'closed:%s' "$port"
  fi
}

function service_status() {
  local name=$1
  local port=$2
  local pid running
  pid=$(read_pid "$name" || true)
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    running="up"
  else
    running="down"
  fi
  local pid_display="${pid:-"-"}"
  local badge
  if [[ "$running" == "up" ]]; then
    badge=$(colorize "$COLOR_GREEN" "UP")
  else
    badge=$(colorize "$COLOR_RED" "DOWN")
  fi
  printf '%-10s %-8s %-8s %s\n' "$name" "$pid_display" "$badge" "$(port_status "$port")"
}
