#!/usr/bin/env bash
set -uo pipefail

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PIN=1111111111111111111111111111111111111111
OTHER=2222222222222222222222222222222222222222
REAL_NPM="$(command -v npm)"
export REAL_NPM OSRS_SDK_COMMIT="$PIN" OSRS_SDK_REPO=https://example.invalid/osrs-sdk.git
export npm_config_offline=true npm_config_cache="$WORK/npm-cache"

fail() {
  printf 'ASSERTION FAILED: %s\n' "$*"
  exit 1
}

ready() {
  printf 'ready %s\n' "$t"
}

# The network and the SDK's own build are the external boundaries.
mkdir "$WORK/bin"
cat >"$WORK/bin/sdk-source" <<'EOF'
#!/usr/bin/env bash
mkdir -p "$1/packages/osrs-sdk-assets" "$1/packages/osrs-sdk-react"
echo '{"name":"osrs-sdk","version":"0.1.8","workspaces":["packages/osrs-sdk-assets","packages/osrs-sdk-react"]}' >"$1/package.json"
echo '{"name":"osrs-sdk-assets","version":"0.1.8"}' >"$1/packages/osrs-sdk-assets/package.json"
echo '{"name":"osrs-sdk-react","version":"0.1.0"}' >"$1/packages/osrs-sdk-react/package.json"
for dir in "$1" "$1/packages/osrs-sdk-assets" "$1/packages/osrs-sdk-react"; do echo 'module.exports = {};' >"$dir/index.js"; done
EOF
cat >"$WORK/bin/git" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  init) mkdir -p "$3" ;;
  -C)
    case "$3" in
      fetch) echo "${@: -1}" >>"$T/fetches" ;;
      checkout) sdk-source "$2" ;;
      rev-parse) tail -n 1 "$T/fetches" ;;
    esac
    ;;
esac
EOF
cat >"$WORK/bin/npm" <<'EOF'
#!/usr/bin/env bash
case "$PWD:$1" in
  "$APP:ci") echo ci >>"$T/registry-installs"; rm -rf node_modules ;;
  *:ci | *:run) ;;
  *) exec "$REAL_NPM" "$@" ;;
esac
EOF
chmod +x "$WORK/bin/sdk-source" "$WORK/bin/git" "$WORK/bin/npm"
export PATH="$WORK/bin:$PATH"

setup() {
  T="$(mktemp -d "$WORK/case.XXXXXX")"
  APP="$T/app"
  export T APP HOME="$T/home" VERIFY_DIR="$T/verify"
  mkdir -p "$APP/scripts" "$HOME"
  cp "$SCRIPTS/install-beta-sdk.sh" "$SCRIPTS/verify.sh" "$APP/scripts/"
  echo '{"name":"app","version":"0.0.0","private":true}' >"$APP/package.json"
  : >"$T/fetches"
  : >"$T/registry-installs"
}

packs() {
  local dir="$1" commit="$2" src
  src="$(mktemp -d "$T/src.XXXXXX")"
  sdk-source "$src"
  mkdir -p "$dir"
  (
    cd "$src" || exit 1
    [[ -z "$commit" ]] || "$REAL_NPM" pkg set "gitHead=$commit" --workspaces --include-workspace-root
    "$REAL_NPM" pack --pack-destination "$dir" --silent
    "$REAL_NPM" pack --workspace osrs-sdk-assets --pack-destination "$dir" --silent
    "$REAL_NPM" pack --workspace osrs-sdk-react --pack-destination "$dir" --silent
  ) >/dev/null || return 1
}

installed_from_packs() {
  packs "$T/old-packs" "$1" || return 1
  (cd "$APP" && "$REAL_NPM" install --no-save --no-audit --no-fund "$T"/old-packs/*.tgz >/dev/null)
}

installed_commits() {
  (cd "$APP" && node -p '["osrs-sdk", "osrs-sdk-assets", "osrs-sdk-react"].map((name) => require(`./node_modules/${name}/package.json`).gitHead).join(" ")')
}

count() {
  wc -l <"$1" | tr -d ' '
}

run_verify() {
  bash "$APP/scripts/verify.sh" build >"$T/out.txt" 2>&1 || { cat "$T/out.txt"; fail "verify.sh build failed"; }
}

install_sdk() {
  bash "$APP/scripts/install-beta-sdk.sh" >"$T/out.txt" 2>&1 || { cat "$T/out.txt"; fail "install-beta-sdk.sh failed"; }
}

expect_reinstalled_at_the_pin() {
  [[ "$(count "$T/registry-installs")" == 1 ]] || { cat "$T/out.txt"; fail "verify ran npm ci $(count "$T/registry-installs") times, expected 1"; }
  [[ "$(count "$T/fetches")" == 1 ]] || { cat "$T/out.txt"; fail "verify fetched the SDK $(count "$T/fetches") times, expected 1"; }
  [[ "$(installed_commits)" == "$PIN $PIN $PIN" ]] || fail "node_modules holds SDK packages from: $(installed_commits)"
}

expect_built_at_the_pin() {
  [[ "$(cat "$T/fetches")" == "$PIN" ]] || { cat "$T/out.txt"; fail "fetched '$(cat "$T/fetches")', expected the pin alone"; }
  [[ "$(installed_commits)" == "$PIN $PIN $PIN" ]] || fail "node_modules holds SDK packages from: $(installed_commits)"
}

install_at_the_pin_is_reused() {
  setup
  bash "$APP/scripts/install-beta-sdk.sh" >"$T/first-install.txt" 2>&1 || { cat "$T/first-install.txt"; return 1; }
  ready
  run_verify
  [[ "$(count "$T/fetches")" == 1 ]] || fail "verify fetched the SDK again"
  [[ "$(count "$T/registry-installs")" == 0 ]] || fail "verify ran npm ci over an install at the pin"
  grep -qxF "install-beta-sdk: installed osrs-sdk commit $PIN matches the pin" "$T/out.txt" || { cat "$T/out.txt"; fail "verify did not name the SDK commit it runs on"; }
}

unrecorded_install_is_replaced() {
  setup
  installed_from_packs "" || return 1
  ready
  run_verify
  expect_reinstalled_at_the_pin
}

install_from_another_commit_is_replaced() {
  setup
  installed_from_packs "$OTHER" || return 1
  ready
  run_verify
  expect_reinstalled_at_the_pin
}

unrecorded_packs_are_refused() {
  setup
  packs "$T/prebuilt" "" || return 1
  ready
  OSRS_SDK_PACKS="$T/prebuilt" install_sdk
  expect_built_at_the_pin
}

packs_from_another_commit_are_refused() {
  setup
  packs "$T/prebuilt" "$OTHER" || return 1
  ready
  OSRS_SDK_PACKS="$T/prebuilt" install_sdk
  expect_built_at_the_pin
}

packs_at_the_pin_are_used() {
  setup
  packs "$T/prebuilt" "$PIN" || return 1
  ready
  OSRS_SDK_PACKS="$T/prebuilt" install_sdk
  [[ "$(count "$T/fetches")" == 0 ]] || fail "built the SDK although the packs are at the pin"
  grep -qxF "install-beta-sdk: installed osrs-sdk commit $PIN matches the pin" "$T/out.txt" || { cat "$T/out.txt"; fail "the install did not name the SDK commit it installed"; }
}

failed=0
for t in \
  install_at_the_pin_is_reused \
  unrecorded_install_is_replaced \
  install_from_another_commit_is_replaced \
  unrecorded_packs_are_refused \
  packs_from_another_commit_are_refused \
  packs_at_the_pin_are_used; do
  if ("$t") >"$WORK/$t.log" 2>&1; then
    echo "PASS $t"
  else
    echo "FAIL $t"
    failed=1
  fi
  sed 's/^/  /' "$WORK/$t.log"
done
exit $failed
