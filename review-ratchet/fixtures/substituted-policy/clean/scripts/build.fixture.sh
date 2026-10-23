#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/build.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() {
  printf 'ASSERTION FAILED: %s\n' "$*"
  exit 1
}

mkdir "$WORK/bin"
printf '#!/usr/bin/env bash\nexit 1\n' >"$WORK/bin/npm"
chmod +x "$WORK/bin/npm"

failed_install_is_not_reused() {
  echo "ready failed_install_is_not_reused"
  if CACHE_ROOT="$WORK" PATH="$WORK/bin:$PATH" bash "$SCRIPT"; then fail "build continued although npm ci failed"; fi
  [[ ! -e "$WORK/reader" ]] || fail "a failed install left $WORK/reader"
}

failed=0
if (failed_install_is_not_reused) >"$WORK/case.log" 2>&1; then
  echo "PASS failed_install_is_not_reused"
else
  echo "FAIL failed_install_is_not_reused"
  failed=1
fi
sed 's/^/  /' "$WORK/case.log"
exit $failed
