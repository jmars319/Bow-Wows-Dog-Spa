#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCROOT="$ROOT_DIR/.build/public-error-pages"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/bowwow-error-pages.XXXXXX")"
PORT="${VERIFY_PUBLIC_ERROR_PAGES_PORT:-8099}"
SERVER_PID=""
LAST_STATUS=""
LAST_BODY="$TMP_DIR/body"
LAST_HEADERS="$TMP_DIR/headers"

cleanup() {
  rm -f "$DOCROOT/maintenance.flag"
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

fail() {
  printf '[verify][error] %s\n' "$1" >&2
  if [[ -f "$LAST_HEADERS" ]]; then
    printf '[verify][error] Headers:\n' >&2
    cat "$LAST_HEADERS" >&2
  fi
  if [[ -f "$LAST_BODY" ]]; then
    printf '[verify][error] Body:\n' >&2
    cat "$LAST_BODY" >&2
  fi
  exit 1
}

log() {
  printf '[verify] %s\n' "$1"
}

require_file() {
  local file="$1"
  [[ -f "$file" ]] || fail "Missing required file: $file"
}

fetch() {
  local path="$1"
  LAST_STATUS="$(curl -sS -D "$LAST_HEADERS" -o "$LAST_BODY" -w '%{http_code}' "http://127.0.0.1:${PORT}${path}")"
}

assert_status() {
  local path="$1"
  local expected="$2"
  fetch "$path"
  [[ "$LAST_STATUS" == "$expected" ]] || fail "Expected $path to return $expected but got $LAST_STATUS"
}

assert_body_contains() {
  local needle="$1"
  grep -Fq "$needle" "$LAST_BODY" || fail "Expected response body to contain: $needle"
}

assert_headers_contain() {
  local needle="$1"
  grep -Fqi "$needle" "$LAST_HEADERS" || fail "Expected response headers to contain: $needle"
}

assert_file_contains() {
  local file="$1"
  local needle="$2"
  grep -Fq "$needle" "$file" || fail "Expected $file to contain: $needle"
}

prepare_docroot() {
  require_file "$ROOT_DIR/frontend/public-app/dist/index.html"
  require_file "$ROOT_DIR/frontend/admin-app/dist/index.html"

  rm -rf "$DOCROOT"
  mkdir -p "$DOCROOT"

  rsync -a "$ROOT_DIR/frontend/public-app/dist/" "$DOCROOT/"
  rsync -a "$ROOT_DIR/frontend/admin-app/dist/" "$DOCROOT/admin/"
  rsync -a --exclude '.DS_Store' "$ROOT_DIR/public-root/" "$DOCROOT/"
  cp "$ROOT_DIR/index.php" "$DOCROOT/index.php"
  cp "$ROOT_DIR/.htaccess" "$DOCROOT/.htaccess"
}

verify_static_fallbacks() {
  local code
  for code in 403 404 500 503; do
    require_file "$DOCROOT/error-documents/${code}.html"
    assert_file_contains "$DOCROOT/error-documents/${code}.html" "Bow Wow's Dog Spa"
    assert_file_contains "$DOCROOT/error-documents/${code}.html" "Back"
    assert_file_contains "$DOCROOT/error-documents/${code}.html" "Home"
  done

  require_file "$DOCROOT/error-documents/styles.css"
  require_file "$DOCROOT/error-documents/app.js"
}

verify_server_config() {
  assert_file_contains "$ROOT_DIR/.htaccess" "ErrorDocument 404 /error-documents/404.html"
  assert_file_contains "$ROOT_DIR/.htaccess" "ErrorDocument 503 /error-documents/503.html"
  assert_file_contains "$ROOT_DIR/.htaccess" "maintenance.flag"
  assert_file_contains "$ROOT_DIR/.htaccess" "!^/admin(?:/|$)"
  assert_file_contains "$ROOT_DIR/.htaccess" "!^/api/health/?$"
  assert_file_contains "$ROOT_DIR/.htaccess" "!^/api/admin(?:/|$)"
}

start_server() {
  php -S "127.0.0.1:${PORT}" -t "$DOCROOT" "$ROOT_DIR/scripts/public-router.php" >"$TMP_DIR/server.log" 2>&1 &
  SERVER_PID="$!"

  for _ in {1..40}; do
    if curl -sS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
      return
    fi
    sleep 0.25
  done

  cat "$TMP_DIR/server.log" >&2 || true
  fail "Timed out waiting for public verification server on port ${PORT}"
}

verify_runtime_routes() {
  assert_status "/" "200"
  assert_status "/privacy" "200"
  assert_status "/terms" "200"
  assert_status "/preview" "301"
  assert_headers_contain "Location: /"

  assert_status "/status/access-denied" "403"
  assert_headers_contain "X-Robots-Tag: noindex, nofollow"

  assert_status "/status/not-found" "404"
  assert_headers_contain "X-Robots-Tag: noindex, nofollow"

  assert_status "/status/server-error" "500"
  assert_headers_contain "X-Robots-Tag: noindex, nofollow"

  assert_status "/status/maintenance" "503"
  assert_headers_contain "Retry-After: 3600"

  assert_status "/this-route-does-not-exist" "404"
  assert_headers_contain "X-Robots-Tag: noindex, nofollow"
}

verify_maintenance_mode() {
  touch "$DOCROOT/maintenance.flag"

  assert_status "/" "503"
  assert_body_contains "Bow Wow's Dog Spa"
  assert_body_contains "Home"

  assert_status "/privacy" "503"
  assert_body_contains "Back"

  assert_status "/admin/login" "200"
  assert_status "/api/health" "200"
  rm -f "$DOCROOT/maintenance.flag"

  assert_status "/" "200"
}

prepare_docroot
verify_static_fallbacks
verify_server_config
start_server
verify_runtime_routes
verify_maintenance_mode

log "Public error page coverage checks passed."
