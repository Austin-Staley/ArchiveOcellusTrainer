#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/netlify-build.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail() {
  printf 'ASSERTION FAILED: %s\n' "$*"
  exit 1
}

PREPARE_READER="$(sed -n '/^prepare_reader() {$/,/^}$/p' "$SCRIPT")"
FAILURE_POLICY="$(grep -m1 '^set -' "$SCRIPT")"

setup() {
  MODES=($(sed -n "1,2s/^set -euo //p" "$SCRIPT"))
  [[ ${#MODES[@]} == 1 ]] || fail "cannot determine script shell mode"
  T="$(mktemp -d "$WORK/case.XXXXXX")"
  OSRS_CACHE_READER_REPO="https://example.invalid/osrscachereader.git"
  OSRS_CACHE_READER_COMMIT="1111111111111111111111111111111111111111"
  CACHE_ROOT="$T/cache/archive-ocellus"
  READER="${CACHE_ROOT}/osrscachereader-${OSRS_CACHE_READER_COMMIT}"
  mkdir -p "$CACHE_ROOT"
  git() {
    case "$1" in
      init) mkdir -p "$3" ;;
      -C) [[ "$3" != fetch ]] || echo fetch >>"$T/fetches" ;;
    esac
  }
  npm() {
    [[ ! -e "$T/npm-fails" ]] || return 1
    mkdir node_modules
  }
}

# A fresh bash keeps errexit live; the caller's `if` and `||` would otherwise suspend it, as they never do in the build.
prepare_reader() {
  bash -c "$(declare -p T CACHE_ROOT READER OSRS_CACHE_READER_REPO OSRS_CACHE_READER_COMMIT)
$(declare -f git npm)
${PREPARE_READER}
${FAILURE_POLICY}
prepare_reader"
}

failed_install_is_not_reused() {
  setup
  : >"$T/npm-fails"
  if prepare_reader; then fail "install passed although npm ci failed"; fi
  [[ ! -e "$READER" ]] || fail "a failed install left $READER"
  rm "$T/npm-fails"
  prepare_reader || fail "retry failed"
  [[ -d "$READER/node_modules" ]] || fail "retry did not install the reader"
  [[ "$(ls "$CACHE_ROOT")" == "osrscachereader-${OSRS_CACHE_READER_COMMIT}" ]] || { echo "cache root holds: $(ls "$CACHE_ROOT" | tr '\n' ' ')"; return 1; }
}

installed_reader_is_reused() {
  setup
  prepare_reader || fail "first install failed"
  prepare_reader || fail "second run failed"
  local fetched
  fetched="$(wc -l <"$T/fetches" | tr -d ' ')"
  [[ "$fetched" == 1 ]] || fail "fetched $fetched times, expected 1"
}

changed_pin_removes_the_old_reader() {
  setup
  mkdir -p "$CACHE_ROOT/osrscachereader-0000000000000000000000000000000000000000" "$CACHE_ROOT/openrs2/2746"
  prepare_reader || fail "install failed"
  [[ "$(ls "$CACHE_ROOT" | tr '\n' ' ')" == "openrs2 osrscachereader-${OSRS_CACHE_READER_COMMIT} " ]] || { echo "cache root holds: $(ls "$CACHE_ROOT" | tr '\n' ' ')"; return 1; }
}

failed=0
for t in \
  failed_install_is_not_reused \
  installed_reader_is_reused \
  changed_pin_removes_the_old_reader; do
  if ("$t") >"$WORK/$t.log" 2>&1; then
    echo "PASS $t"
  else
    echo "FAIL $t"
    sed 's/^/  /' "$WORK/$t.log"
    failed=1
  fi
done
exit $failed
