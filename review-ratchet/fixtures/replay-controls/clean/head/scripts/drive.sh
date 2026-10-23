#!/usr/bin/env bash
set -euo pipefail

WALK_QUERY="?walk=1"
ROUTE_QUERY="?route=1"

case "$1" in
  walk) echo "open ${WALK_QUERY}" ;;
  route) echo "open ${ROUTE_QUERY}" ;;
esac
