#!/usr/bin/env bash
# Shared browser opener for local dev scripts.

dev_browser_log_info() {
  if declare -F log_info >/dev/null 2>&1; then
    log_info "$*"
  else
    printf '\033[1;32m[INFO]\033[0m %s\n' "$*"
  fi
}

dev_browser_log_warn() {
  if declare -F log_warn >/dev/null 2>&1; then
    log_warn "$*"
  else
    printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2
  fi
}

dev_browser_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

dev_browser_enabled() {
  case "${CI:-}" in
    1|true|TRUE|yes|YES) return 1 ;;
  esac

  case "${DEV_BROWSER_OPEN:-1}" in
    0|false|FALSE|no|NO|off|OFF) return 1 ;;
  esac

  case "${BOWWOW_SKIP_BROWSER_OPEN:-0}" in
    1|true|TRUE|yes|YES) return 1 ;;
  esac

  case "$(dev_browser_lower "${DEV_BROWSER:-}")" in
    none|off|false|no) return 1 ;;
  esac

  return 0
}

dev_browser_choice() {
  local requested
  requested="$(dev_browser_lower "${DEV_BROWSER:-}")"
  if [[ -n "$requested" ]]; then
    printf '%s' "$requested"
    return
  fi

  case "$(uname -s)" in
    Darwin) printf 'safari' ;;
    MINGW*|MSYS*|CYGWIN*) printf 'chrome' ;;
    *) printf 'default' ;;
  esac
}

dev_browser_open_macos() {
  local browser="$1"
  local url="$2"

  case "$browser" in
    safari)
      open -a "Safari" "$url" >/dev/null 2>&1 ||
        open -a "Google Chrome" "$url" >/dev/null 2>&1 ||
        open "$url" >/dev/null 2>&1
      ;;
    chrome|google-chrome)
      open -a "Google Chrome" "$url" >/dev/null 2>&1 ||
        open -a "Safari" "$url" >/dev/null 2>&1 ||
        open "$url" >/dev/null 2>&1
      ;;
    edge|microsoft-edge)
      open -a "Microsoft Edge" "$url" >/dev/null 2>&1 ||
        open -a "Safari" "$url" >/dev/null 2>&1 ||
        open "$url" >/dev/null 2>&1
      ;;
    firefox)
      open -a "Firefox" "$url" >/dev/null 2>&1 ||
        open -a "Safari" "$url" >/dev/null 2>&1 ||
        open "$url" >/dev/null 2>&1
      ;;
    default|system)
      open "$url" >/dev/null 2>&1
      ;;
    *)
      open -a "$browser" "$url" >/dev/null 2>&1 ||
        open -a "Safari" "$url" >/dev/null 2>&1 ||
        open -a "Google Chrome" "$url" >/dev/null 2>&1 ||
        open "$url" >/dev/null 2>&1
      ;;
  esac
}

dev_browser_open_windows() {
  local browser="$1"
  local url="$2"

  case "$browser" in
    chrome|google-chrome)
      cmd.exe /c start "" chrome "$url" >/dev/null 2>&1 ||
        cmd.exe /c start "" "$url" >/dev/null 2>&1
      ;;
    edge|microsoft-edge)
      cmd.exe /c start "" msedge "$url" >/dev/null 2>&1 ||
        cmd.exe /c start "" "$url" >/dev/null 2>&1
      ;;
    firefox)
      cmd.exe /c start "" firefox "$url" >/dev/null 2>&1 ||
        cmd.exe /c start "" "$url" >/dev/null 2>&1
      ;;
    default|system)
      cmd.exe /c start "" "$url" >/dev/null 2>&1
      ;;
    *)
      cmd.exe /c start "" "$browser" "$url" >/dev/null 2>&1 ||
        cmd.exe /c start "" chrome "$url" >/dev/null 2>&1 ||
        cmd.exe /c start "" "$url" >/dev/null 2>&1
      ;;
  esac
}

dev_browser_open_linux() {
  local browser="$1"
  local url="$2"

  case "$browser" in
    chrome|google-chrome)
      if command -v google-chrome >/dev/null 2>&1; then
        google-chrome "$url" >/dev/null 2>&1 &
      elif command -v chromium >/dev/null 2>&1; then
        chromium "$url" >/dev/null 2>&1 &
      elif command -v chromium-browser >/dev/null 2>&1; then
        chromium-browser "$url" >/dev/null 2>&1 &
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1
      else
        return 1
      fi
      ;;
    default|system)
      command -v xdg-open >/dev/null 2>&1 && xdg-open "$url" >/dev/null 2>&1
      ;;
    *)
      if command -v "$browser" >/dev/null 2>&1; then
        "$browser" "$url" >/dev/null 2>&1 &
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1
      else
        return 1
      fi
      ;;
  esac
}

open_dev_browser() {
  local url="$1"
  local browser
  browser="$(dev_browser_choice)"

  if ! dev_browser_enabled; then
    dev_browser_log_info "Browser auto-open skipped for $url"
    return 0
  fi

  case "$(uname -s)" in
    Darwin)
      if dev_browser_open_macos "$browser" "$url"; then
        dev_browser_log_info "Opened $url in ${DEV_BROWSER:-Safari}"
        return 0
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      if dev_browser_open_windows "$browser" "$url"; then
        dev_browser_log_info "Opened $url in ${DEV_BROWSER:-Chrome}"
        return 0
      fi
      ;;
    *)
      if dev_browser_open_linux "$browser" "$url"; then
        dev_browser_log_info "Opened $url in ${DEV_BROWSER:-system browser}"
        return 0
      fi
      ;;
  esac

  dev_browser_log_warn "Unable to open $url automatically"
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  open_dev_browser "${1:?Usage: dev-browser.sh URL}"
fi
