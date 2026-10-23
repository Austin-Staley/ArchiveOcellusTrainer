#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/build.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir "$WORK/bin"
printf '#!/usr/bin/env bash\nexit 1\n' >"$WORK/bin/npm"
chmod +x "$WORK/bin/npm"

failed_install_is_not_reused() {
  if CACHE_ROOT="$WORK" PATH="$WORK/bin:$PATH" bash -e "$SCRIPT"; then echo "build continued although npm ci failed"; return 1; fi
  [[ ! -e "$WORK/reader" ]] || { echo "a failed install left $WORK/reader"; return 1; }
}

failed_install_is_not_reused && echo "PASS failed_install_is_not_reused"
