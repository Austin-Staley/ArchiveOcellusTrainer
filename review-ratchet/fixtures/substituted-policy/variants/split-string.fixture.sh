#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/build.sh"
PREPARE_READER="$(env -S sed -n '/^prepare_reader() {$/,/^}$/p' "$SCRIPT")"
FAILURE_POLICY="$(env -S grep -m1 '^set -' "$SCRIPT")"

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
