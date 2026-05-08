#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

COLOR_RESET="\033[0m"
COLOR_BLUE="\033[0;34m"
COLOR_GREEN="\033[0;32m"
COLOR_YELLOW="\033[0;33m"
COLOR_RED="\033[0;31m"
COLOR_BOLD="\033[1m"

fail_count=0
warn_count=0

section() {
  printf "\n%b==>%b %s\n" "$COLOR_BOLD" "$COLOR_RESET" "$*"
}

ok() {
  printf "%b[OK]%b %s\n" "$COLOR_GREEN" "$COLOR_RESET" "$*"
}

info() {
  printf "%b[INFO]%b %s\n" "$COLOR_BLUE" "$COLOR_RESET" "$*"
}

warn() {
  warn_count=$((warn_count + 1))
  printf "%b[WARN]%b %s\n" "$COLOR_YELLOW" "$COLOR_RESET" "$*" >&2
}

fail() {
  fail_count=$((fail_count + 1))
  printf "%b[ERROR]%b %s\n" "$COLOR_RED" "$COLOR_RESET" "$*" >&2
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  if has_cmd "$1"; then
    ok "Command available: $1"
  else
    fail "Missing required command: $1"
  fi
}

check_file() {
  if [[ -f "$ROOT_DIR/$1" ]]; then
    ok "File present: $1"
  else
    fail "Missing file: $1"
  fi
}

check_dir() {
  if [[ -d "$ROOT_DIR/$1" ]]; then
    ok "Directory present: $1"
  else
    fail "Missing directory: $1"
  fi
}

package_files() {
  local candidates=(
    "package.json"
    "frontend/package.json"
    "frontend/public-app/package.json"
    "frontend/admin-app/package.json"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    [[ -f "$ROOT_DIR/$candidate" ]] && printf "%s\n" "$candidate"
  done
}

has_package_files() {
  [[ -n "$(package_files)" ]]
}

has_php_backend() {
  [[ -d "$ROOT_DIR/backend" ]] && find "$ROOT_DIR/backend" -name "*.php" -print -quit | grep -q .
}

has_deploy_zip_scripts() {
  [[ -f "$ROOT_DIR/scripts/make-deploy-zips.sh" || -f "$ROOT_DIR/scripts/check-deploy-zips.sh" ]]
}

has_dev_runner() {
  [[ -f "$ROOT_DIR/scripts/dev-start.sh" || -f "$ROOT_DIR/scripts/dev-status.sh" ]]
}

json_valid() {
  local package_path="$1"
  if ! has_cmd node; then
    warn "Skipping JSON parse for $package_path because node is unavailable"
    return
  fi

  if node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$ROOT_DIR/$package_path" >/dev/null 2>&1; then
    ok "Valid JSON: $package_path"
  else
    fail "Invalid JSON: $package_path"
  fi
}

package_has_script() {
  local package_path="$1"
  local script_name="$2"
  has_cmd node || return 1
  node - "$ROOT_DIR/$package_path" "$script_name" <<'NODE'
const fs = require("fs");
const packagePath = process.argv[2];
const scriptName = process.argv[3];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
process.exit(pkg.scripts && pkg.scripts[scriptName] ? 0 : 1);
NODE
}

check_package_script() {
  local package_path="$1"
  local script_name="$2"
  if package_has_script "$package_path" "$script_name"; then
    ok "$package_path exposes npm script: $script_name"
  else
    warn "$package_path does not expose npm script: $script_name"
  fi
}

check_node_modules() {
  local package_path="$1"
  local package_dir
  package_dir="$(dirname "$package_path")"
  [[ "$package_dir" == "." ]] && package_dir=""

  if has_cmd node && node - "$ROOT_DIR/$package_path" <<'NODE'
const fs = require("fs");
const packagePath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const count =
  Object.keys(pkg.dependencies || {}).length +
  Object.keys(pkg.devDependencies || {}).length +
  Object.keys(pkg.optionalDependencies || {}).length;
process.exit(count === 0 ? 0 : 1);
NODE
  then
    info "No npm dependencies declared for ${package_path}; skipping node_modules check"
    return
  fi

  if [[ -d "$ROOT_DIR/$package_dir/node_modules" ]]; then
    ok "Dependencies installed for ${package_path}"
  else
    warn "Dependencies are not installed for ${package_path}; run npm install in ${package_dir:-repo root}"
  fi
}

section "Required Commands"
require_cmd git
if has_package_files; then
  require_cmd node
  require_cmd npm
fi
if has_php_backend; then
  require_cmd php
fi
if has_deploy_zip_scripts; then
  require_cmd zip
  require_cmd unzip
  require_cmd rsync
fi
if has_dev_runner; then
  require_cmd curl
  if has_cmd lsof; then
    ok "Command available: lsof"
  else
    warn "lsof unavailable; dev status scripts may have reduced port diagnostics"
  fi
fi

section "Project Shape"
check_file ".gitignore"
check_file ".editorconfig"
check_file ".nvmrc"
[[ -d "$ROOT_DIR/scripts" ]] && ok "Directory present: scripts" || warn "No scripts directory present"
if [[ -d "$ROOT_DIR/backend" ]]; then
  ok "Directory present: backend"
fi
if [[ -d "$ROOT_DIR/frontend" ]]; then
  ok "Directory present: frontend"
fi
if [[ -d "$ROOT_DIR/src/app" || -d "$ROOT_DIR/app" ]]; then
  ok "Next app directory present"
fi
if [[ -f "$ROOT_DIR/.nvmrc" ]] && has_cmd node; then
  expected_node="$(tr -d 'v[:space:]' < "$ROOT_DIR/.nvmrc")"
  current_node_major="$(node -p "process.versions.node.split('.')[0]")"
  if ! [[ "$expected_node" =~ ^[0-9]+$ ]]; then
    warn "Unable to interpret .nvmrc value: $expected_node"
  elif [[ "$current_node_major" == "$expected_node" ]]; then
    ok "Node major matches .nvmrc: $expected_node"
  else
    fail "Node major mismatch: .nvmrc expects $expected_node but current node is $(node -v)"
  fi
fi

section "Package Files"
if has_package_files; then
  while IFS= read -r package_path; do
    json_valid "$package_path"
    check_node_modules "$package_path"
  done < <(package_files)
else
  warn "No package.json files found"
fi

section "Root Script Surface"
if [[ -f "$ROOT_DIR/package.json" ]]; then
  check_package_script "package.json" "doctor"
  [[ -f "$ROOT_DIR/scripts/dev-start.sh" ]] && check_package_script "package.json" "dev:start"
  [[ -f "$ROOT_DIR/scripts/dev-stop.sh" ]] && check_package_script "package.json" "dev:stop"
  [[ -f "$ROOT_DIR/scripts/dev-status.sh" ]] && check_package_script "package.json" "dev:status"
  [[ -f "$ROOT_DIR/scripts/dev-verify.sh" ]] && check_package_script "package.json" "verify"
  [[ -f "$ROOT_DIR/scripts/make-deploy-zips.sh" ]] && check_package_script "package.json" "deploy:make"
  [[ -f "$ROOT_DIR/scripts/check-deploy-zips.sh" ]] && check_package_script "package.json" "deploy:check"
fi

section "Environment Files"
env_examples=()
while IFS= read -r env_example; do
  env_examples+=("${env_example#$ROOT_DIR/}")
done < <(find "$ROOT_DIR" -maxdepth 3 -type f \( -name ".env.example" -o -name ".env.production.example" -o -name "config.example.php" \) -not -path "*/node_modules/*" | sort)

if [[ "${#env_examples[@]}" -gt 0 ]]; then
  for env_example in "${env_examples[@]}"; do
    ok "Environment example present: $env_example"
  done
else
  warn "No environment example files found"
fi

while IFS= read -r env_file; do
  rel="${env_file#$ROOT_DIR/}"
  info "Local environment file present: $rel"
done < <(find "$ROOT_DIR" -maxdepth 3 -type f \( -name ".env" -o -name ".env.local" -o -name ".env.production" -o -name "config.php" \) -not -path "*/node_modules/*" | sort)

section "Deploy Scripts"
if [[ -f "$ROOT_DIR/scripts/make-deploy-zips.sh" ]]; then
  ok "Deploy builder present: scripts/make-deploy-zips.sh"
  [[ -f "$ROOT_DIR/scripts/check-deploy-zips.sh" ]] || warn "Deploy builder exists without scripts/check-deploy-zips.sh"
fi
if [[ -f "$ROOT_DIR/scripts/check-deploy-zips.sh" ]]; then
  ok "Deploy checker present: scripts/check-deploy-zips.sh"
fi

section "Summary"
if [[ "$fail_count" -gt 0 ]]; then
  fail "Doctor found $fail_count blocking issue(s) and $warn_count warning(s)"
  exit 1
fi

if [[ "$warn_count" -gt 0 ]]; then
  warn "Doctor completed with $warn_count warning(s)"
else
  ok "Doctor completed with no warnings"
fi
