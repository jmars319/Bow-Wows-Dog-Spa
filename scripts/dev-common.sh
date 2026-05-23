#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEV_DIR="${DEV_DIR:-$ROOT_DIR/.dev}"
mkdir -p "$DEV_DIR"

for required in curl lsof; do
  if ! command -v "$required" >/dev/null 2>&1; then
    >&2 echo "[dev][error] Command '$required' is required."
    exit 1
  fi
done

DEFAULT_DEV_HOST="127.0.0.1"
DEFAULT_BACKEND_PORT="3316"
DEFAULT_FRONTEND_PORT="3206"
DEFAULT_ADMIN_PORT="3406"
DEV_SESSION_PREFIX="${DEV_SESSION_PREFIX:-bowwow-dev}"

DEV_CONFIG_FILE="${DEV_CONFIG_FILE:-$ROOT_DIR/.dev/dev-config.sh}"
if [[ -f "$DEV_CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$DEV_CONFIG_FILE"
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
  printf '%s[dev][INFO]%s %s\n' "$COLOR_BLUE" "$COLOR_RESET" "$*"
}

function error() {
  printf >&2 '%s[dev][ERROR]%s %s\n' "$COLOR_RED" "$COLOR_RESET" "$*"
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

function stop_detached_session() {
  local name=$1
  if command -v screen >/dev/null 2>&1; then
    screen -S "$DEV_SESSION_PREFIX-$name" -X quit >/dev/null 2>&1 || true
  fi
}

function start_detached_service() {
  local name=$1
  local work_dir=$2
  shift 2

  stop_detached_session "$name"

  if command -v screen >/dev/null 2>&1; then
    screen -dmS "$DEV_SESSION_PREFIX-$name" bash -c '
      name="$1"
      work_dir="$2"
      pid_file="$3"
      log_file="$4"
      shift 4
      cd "$work_dir" || exit 1
      echo $$ > "$pid_file"
      exec "$@" >> "$log_file" 2>&1
    ' bash "$name" "$work_dir" "$(pid_file "$name")" "$(log_file "$name")" "$@"
  else
    (
      cd "$work_dir"
      nohup "$@" > "$(log_file "$name")" 2>&1 < /dev/null &
      echo $! > "$(pid_file "$name")"
    )
  fi

  for _ in {1..50}; do
    if [[ -s "$(pid_file "$name")" ]]; then
      return 0
    fi
    sleep 0.1
  done

  error "Started $name but no PID file was written."
  return 1
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

  stop_detached_session "$name"
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

function browser_host() {
  if [[ "$DEV_HOST" == "0.0.0.0" ]]; then
    printf '127.0.0.1'
    return
  fi

  printf '%s' "$DEV_HOST"
}
