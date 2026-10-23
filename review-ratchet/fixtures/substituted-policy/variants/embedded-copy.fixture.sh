#!/usr/bin/env bash
set -uo pipefail

prepare_reader() {
  bash -c 'set -euo pipefail
READER="${CACHE_ROOT}/reader"
prepare_reader() {
  local staging
  staging="$(mktemp -d "${CACHE_ROOT}/reader.XXXXXX")"
  (cd "${staging}" && npm ci)
  mv "${staging}" "${READER}"
}
prepare_reader'
}

failed_install_is_not_reused() {
  export CACHE_ROOT
  CACHE_ROOT="$(mktemp -d)"
  if prepare_reader; then echo "install passed although npm ci failed"; return 1; fi
}

failed_install_is_not_reused && echo "PASS failed_install_is_not_reused"
