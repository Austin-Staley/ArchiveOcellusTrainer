#!/usr/bin/env bash
set -euo pipefail

reader=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  if [[ ${args[$i]} == --reader-path && -n ${args[$((i + 1))]:-} ]]; then
    reader=${args[$((i + 1))]}
  fi
done
if [[ -n $reader ]]; then
  node scripts/patch-cache-reader.mjs "$reader"
fi
node scripts/patch-asset-tool.mjs

# The same default as webpack: an unset phase flag includes that phase's assets, and an explicit off leaves them out.
export ARCHIVE_P1="${ARCHIVE_P1:-on}"
export ARCHIVE_P2="${ARCHIVE_P2:-on}"
export ARCHIVE_P3="${ARCHIVE_P3:-on}"

osrs-sdk-assets build "$@"
npm run --silent item-icons -- "$@"
node scripts/extract-sprites.mjs "$@"
