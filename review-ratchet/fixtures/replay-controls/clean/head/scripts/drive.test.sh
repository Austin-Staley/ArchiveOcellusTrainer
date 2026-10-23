#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/drive.sh"
eval "$(grep -E '^(WALK_QUERY)=' "$SCRIPT")"

fake_browser() {
  case "$1" in
    *"?route=1"*) echo routed ;;
    *"$WALK_QUERY"*) echo walked ;;
  esac
}

walk_passes() {
  [[ "$(fake_browser "$(bash "$SCRIPT" walk)")" == walked ]] || { echo "the walk was not driven"; return 1; }
}

route_passes() {
  [[ "$(fake_browser "$(bash "$SCRIPT" route)")" == routed ]] || { echo "the route was not driven"; return 1; }
}

for t in walk_passes route_passes; do
  if out="$("$t" 2>&1)"; then echo "PASS $t"; else echo "FAIL $t"; echo "  $out"; fi
done
