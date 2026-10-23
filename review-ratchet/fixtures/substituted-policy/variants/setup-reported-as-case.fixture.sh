#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/netlify-build.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

MODES=($(sed -n "1,2s/^set -euo //p" "$SCRIPT"))
[[ ${#MODES[@]} == 1 ]] || { printf "FAIL setup\n  ASSERTION FAILED: cannot determine script shell mode\n"; exit 1; }
printf "SHELL_MODE=%s\n" "${MODES[0]}"

PREPARE_READER="$(sed -n '/^prepare_reader() {$/,/^}$/p' "$SCRIPT")"
FAILURE_POLICY="$(grep -m1 '^set -' "$SCRIPT")"

setup() {
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
  if prepare_reader; then echo "install passed although npm ci failed"; return 1; fi
  [[ ! -e "$READER" ]] || { echo "a failed install left $READER"; return 1; }
  rm "$T/npm-fails"
  prepare_reader || { echo "retry failed"; return 1; }
  [[ -d "$READER/node_modules" ]] || { echo "retry did not install the reader"; return 1; }
  [[ "$(ls "$CACHE_ROOT")" == "osrscachereader-${OSRS_CACHE_READER_COMMIT}" ]] || { echo "cache root holds: $(ls "$CACHE_ROOT" | tr '\n' ' ')"; return 1; }
}

installed_reader_is_reused() {
  setup
  prepare_reader || { echo "first install failed"; return 1; }
  prepare_reader || { echo "second run failed"; return 1; }
  local fetched
  fetched="$(wc -l <"$T/fetches" | tr -d ' ')"
  [[ "$fetched" == 1 ]] || { echo "fetched $fetched times, expected 1"; return 1; }
}

changed_pin_removes_the_old_reader() {
  setup
  mkdir -p "$CACHE_ROOT/osrscachereader-0000000000000000000000000000000000000000" "$CACHE_ROOT/openrs2/2746"
  prepare_reader || { echo "install failed"; return 1; }
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
