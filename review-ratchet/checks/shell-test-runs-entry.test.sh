#!/usr/bin/env bash
set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/shell-test-runs-entry.mjs"
FIXTURES="$(cd "$(dirname "$0")/../fixtures/substituted-policy" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Each row is name|reader|line. A reader of - means the line runs the script and the check must pass it.
CASES="$(cat <<'EOF'
builtin_source|source|builtin source "$SCRIPT"
env_unset_grep|grep|POLICY="$(env -u HOME grep -m1 '^set -' "$SCRIPT")"
env_assignment_awk|awk|LC_ALL=C env LANG=C awk 1 "$SCRIPT"
escaped_cat|cat|\cat "$SCRIPT"
quoted_sed|sed|"sed" -n 1p "$SCRIPT"
absolute_head|head|/usr/bin/head -1 "$SCRIPT"
if_grep|grep|if grep -q errexit "$SCRIPT"; then :; fi
negated_grep|grep|! grep -q errexit "$SCRIPT"
timeout_signal_tail|tail|timeout -s KILL 5 tail -1 "$SCRIPT"
nice_nohup_cat|cat|nice -n 5 nohup cat "$SCRIPT"
time_cut|cut|time -p cut -c1 "$SCRIPT"
command_bash_runs|-|command bash "$SCRIPT"
env_assignment_bash_runs|-|env CACHE_ROOT=/tmp/cache bash "$SCRIPT"
timeout_bash_runs|-|timeout 5 bash "$SCRIPT"
if_bash_runs|-|if bash "$SCRIPT"; then :; fi
EOF
)"

check_line() {
  local reader="$1" line="$2" dir output status
  dir="$(mktemp -d "$WORK/case.XXXXXX")"
  printf '%s\n' 'SCRIPT="$(dirname "$0")/build.sh"' "$line" >"$dir/build.test.sh"
  output="$(node "$CHECK" "$dir")"
  status=$?
  echo "$output"
  if [[ "$reader" == - ]]; then
    [[ "$status" == 0 ]]
  else
    [[ "$status" == 1 && "$output" == *"build.test.sh:2: reads the text of build.sh with $reader;"* ]]
  fi
}

prefixed_fixture_is_rejected() {
  local output status
  output="$(node "$CHECK" "$FIXTURES/prefixed")"
  status=$?
  echo "$output"
  [[ "$status" == 1 && "$output" == *"scripts/build.test.sh:5: reads the text of build.sh with sed;"*"scripts/build.test.sh:6: reads the text of build.sh with grep;"* ]]
}

failed=0
report() {
  local name="$1"
  shift
  if "$@" >"$WORK/$name.log" 2>&1; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    sed 's/^/  /' "$WORK/$name.log"
    failed=1
  fi
}

while IFS='|' read -r name reader line; do
  report "$name" check_line "$reader" "$line"
done <<<"$CASES"
report prefixed_fixture_is_rejected prefixed_fixture_is_rejected
exit $failed
