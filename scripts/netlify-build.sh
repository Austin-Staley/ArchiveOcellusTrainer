#!/usr/bin/env bash
set -euo pipefail

OSRS_CACHE_READER_REPO="${OSRS_CACHE_READER_REPO:-https://github.com/Julian-Dasilva/osrscachereader.git}"
OSRS_CACHE_READER_COMMIT="${OSRS_CACHE_READER_COMMIT:-8ba9131f1afd1193e7c6180db5a895ffe9e21fa8}"
CACHE_ROOT="${NETLIFY_CACHE_DIR:-/opt/build/cache}/archive-ocellus"
READER="${CACHE_ROOT}/osrscachereader-${OSRS_CACHE_READER_COMMIT}"

cd "$(dirname "$0")/.."

prepare_reader() {
  find "${CACHE_ROOT}" -mindepth 1 -maxdepth 1 -name 'osrscachereader*' ! -path "${READER}" -exec rm -rf {} +
  if [[ -d "${READER}" ]]; then
    echo "netlify-build: reusing cache reader ${OSRS_CACHE_READER_COMMIT}"
    return 0
  fi
  echo "netlify-build: installing cache reader ${OSRS_CACHE_READER_REPO} at ${OSRS_CACHE_READER_COMMIT}"
  local work
  work="$(mktemp -d "${CACHE_ROOT}/osrscachereader.XXXXXX")"
  git init --quiet "${work}"
  git -C "${work}" fetch --quiet --depth 1 "${OSRS_CACHE_READER_REPO}" "${OSRS_CACHE_READER_COMMIT}"
  git -C "${work}" checkout --quiet FETCH_HEAD
  (cd "${work}" && npm ci --no-audit --no-fund)
  mv "${work}" "${READER}"
}

mkdir -p "${CACHE_ROOT}"
prepare_reader
npm ci --no-audit --no-fund
scripts/install-beta-sdk.sh
npm run assets -- --cache-dir "${CACHE_ROOT}/openrs2" --reader-path "${READER}"
npm run build
