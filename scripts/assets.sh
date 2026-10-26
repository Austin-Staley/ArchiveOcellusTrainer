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

osrs-sdk-assets build "$@"
npm run --silent item-icons -- "$@"
node scripts/extract-sprites.mjs "$@"
