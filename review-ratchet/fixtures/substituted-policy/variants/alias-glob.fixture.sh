#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/build.sh"
POLICY_SOURCE="$(cd "$(dirname "$0")" && pwd)/build.s?"
PREPARE_READER="$(sed -n '/^prepare_reader() {$/,/^}$/p' $POLICY_SOURCE)"
FAILURE_POLICY="$(grep -m1 '^set -' $POLICY_SOURCE)"

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
