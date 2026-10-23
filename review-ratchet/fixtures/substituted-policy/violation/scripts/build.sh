#!/usr/bin/env bash
set -euo pipefail

READER="${CACHE_ROOT:-/tmp/cache}/reader"

prepare_reader() {
  local staging
  staging="$(mktemp -d "${CACHE_ROOT}/reader.XXXXXX")"
  (cd "${staging}" && npm ci)
  mv "${staging}" "${READER}"
}

prepare_reader
npm run build
