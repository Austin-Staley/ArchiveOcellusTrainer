#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/build.sh"
PREPARE_READER="$(bash <<'READ_BODY'
sed -n '/^prepare_reader() {$/,/^}$/p' ./scripts/build.s?
READ_BODY
)"
FAILURE_POLICY="$(bash <<'READ_POLICY'
grep -m1 '^set -' ./scripts/build.s?
READ_POLICY
)"

prepare_reader() {
  bash -c "${PREPARE_READER}
${FAILURE_POLICY}
prepare_reader"
}

failed_install_is_not_reused() {
  CACHE_ROOT="$(mktemp -d)"
  if prepare_reader; then echo "install passed although npm ci failed"; return 1; fi
}

failed_install_is_not_reused && echo "PASS failed_install_is_not_reused"
