#!/usr/bin/env bash
set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/shell-test-runs-entry.mjs"
FIXTURES="$(cd "$(dirname "$0")/../fixtures/substituted-policy" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# shell-test-runs-entry.mjs counts a failure under a mutation only when this line is printed.
fail() {
  printf 'ASSERTION FAILED: %s\n' "$*"
  exit 1
}

POSITION='scripts/build.test.sh: passes when scripts/build.sh breaks "errexit is on before prepare_reader runs", so the test does not run the policy it guards'

# Each row is name|fixture|exit|line|setup. setup runs inside a copy of the fixture before the check, and line must appear in the check's output.
CASES="$(cat <<EOF
clean|clean|0|shell-test-runs-entry: 0 finding(s) in 1 shell test(s)|
violation|violation|1|${POSITION}|
historical_own_errexit|historical-a3c10e6|1|scripts/netlify-build.test.sh: passes when scripts/netlify-build.sh breaks "errexit stops the build at the first failed command", so the test does not run the policy it guards|
historical_copied_set_line|historical-9d9143b|1|scripts/netlify-build.test.sh: passes when scripts/netlify-build.sh breaks "errexit is on before prepare_reader runs", so the test does not run the policy it guards|
prefixed_reader|clean|1|${POSITION}|cp "\$FIXTURES/variants/prefixed.test.sh" scripts/build.test.sh
split_string_reader|clean|1|${POSITION}|cp "\$FIXTURES/variants/split-string.test.sh" scripts/build.test.sh
glob_in_variable|clean|1|${POSITION}|cp "\$FIXTURES/variants/alias-glob.test.sh" scripts/build.test.sh
glob_in_here_document|clean|1|${POSITION}|cp "\$FIXTURES/variants/heredoc-glob.test.sh" scripts/build.test.sh
interpreter_option|clean|1|${POSITION}|cp "\$FIXTURES/variants/interpreter-option.test.sh" scripts/build.test.sh
embedded_copy|clean|1|${POSITION}|cp "\$FIXTURES/variants/embedded-copy.test.sh" scripts/build.test.sh
unrelated_setup_error|historical-9d9143b|2|scripts/netlify-build.test.sh fails with exit 1 when scripts/netlify-build.sh breaks "errexit stops the build at the first failed command" without an ASSERTION FAILED line, so the failure does not show that the test checks the policy|cp "\$FIXTURES/variants/unrelated-setup-error.test.sh" scripts/netlify-build.test.sh
unlisted_test|clean|2|scripts/other.test.sh is not listed in review-ratchet/guarded-policies.json, so no mutation checks it|cp scripts/build.test.sh scripts/other.test.sh
mutation_text_absent|clean|2|cannot break "errexit stops the build at the first failed command" in scripts/build.sh: "set -euo pipefail\\n" occurs 0 times|sed -i.bak 's/^set -euo pipefail\$/set -eu -o pipefail/' scripts/build.sh && rm scripts/build.sh.bak
failing_test|clean|2|scripts/build.test.sh fails with exit 3 before any mutation|printf 'exit 3\n' >scripts/build.test.sh
passes_only_when_broken|clean|2|scripts/build.test.sh fails with exit 1 before any mutation|printf 'grep -q "^set -uo pipefail" scripts/build.sh\n' >scripts/build.test.sh
mutation_breaks_syntax|clean|2|cannot break "errexit stops the build at the first failed command" in scripts/build.sh: the mutant fails bash -n|sed -i.bak 's/"replace": "set -uo pipefail/"replace": "fi/' review-ratchet/guarded-policies.json && rm review-ratchet/guarded-policies.json.bak
mutation_text_twice|clean|2|cannot break "errexit stops the build at the first failed command" in scripts/build.sh: "set -euo pipefail\\n" occurs 2 times|printf 'set -euo pipefail\n' >>scripts/build.sh
missing_policy_file|clean|2|cannot read review-ratchet/guarded-policies.json|rm review-ratchet/guarded-policies.json
EOF
)"

run_case() {
  local name="$1" fixture="$2" status="$3" line="$4" setup="$5"
  local tree="$WORK/$name"
  cp -R "$FIXTURES/$fixture" "$tree"
  (cd "$tree" && eval "$setup") || { echo "setup failed"; return 1; }
  node "$CHECK" "$tree" >"$WORK/$name.out" 2>&1
  local actual=$?
  [[ "$actual" == "$status" ]] || { cat "$WORK/$name.out"; fail "exit $actual, expected $status"; }
  grep -qxF -- "$line" "$WORK/$name.out" || grep -qxF -- "shell-test-runs-entry: $line" "$WORK/$name.out" || { cat "$WORK/$name.out"; fail "missing: $line"; }
}

hanging_test() {
  local tree="$WORK/hanging"
  cp -R "$FIXTURES/clean" "$tree"
  printf 'sleep 30\n' >"$tree/scripts/build.test.sh"
  node "$CHECK" --timeout 1 "$tree" >"$WORK/hanging.out" 2>&1
  local actual=$?
  [[ "$actual" == 2 ]] || { cat "$WORK/hanging.out"; fail "exit $actual, expected 2"; }
  grep -qxF "shell-test-runs-entry: scripts/build.test.sh timed out after 1s before any mutation" "$WORK/hanging.out" || { cat "$WORK/hanging.out"; fail "missing the timeout line"; }
}

failed=0
report() {
  if ("$@") >"$WORK/case.log" 2>&1; then
    echo "PASS $NAME"
  else
    echo "FAIL $NAME"
    sed 's/^/  /' "$WORK/case.log"
    failed=1
  fi
}
while IFS='|' read -r name fixture status line setup; do
  NAME="$name" report run_case "$name" "$fixture" "$status" "$line" "$setup"
done <<<"$CASES"
NAME=hanging_test report hanging_test
exit $failed
