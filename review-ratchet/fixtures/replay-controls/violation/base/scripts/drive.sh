#!/usr/bin/env bash
set -euo pipefail

WALK_QUERY="?walk=1"

case "$1" in
  walk) echo "open ${WALK_QUERY}" ;;
esac
