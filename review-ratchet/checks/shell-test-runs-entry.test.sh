#!/usr/bin/env bash
set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/shell-test-runs-entry.mjs"
FIXTURES="$(cd "$(dirname "$0")/../fixtures/substituted-policy" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Each row is name|expected|line. expected is the command or carrier the finding names, - when the check must pass, or ? followed by the refusal it must exit 2 with.
CASES="$(cat <<'EOF'
plain_sed|sed|sed -n 1p "$SCRIPT"
command_sed|sed|command sed -n 1p "$SCRIPT"
env_split_sed|sed|env -S sed -n 1p "$SCRIPT"
env_split_quoted_grep|grep|env -S 'grep -m1' '^set -' "$SCRIPT"
env_split_bash_option|bash|env -S 'bash -e' "$SCRIPT"
env_unknown_option|env|env --split-string=sed "$SCRIPT"
cat_reads|cat|cat "$SCRIPT"
redirect_reads|a redirect|while read -r l; do :; done <"$SCRIPT"
here_string_reads|a here-string|xargs cat <<<"$SCRIPT"
source_reads|source|source "$SCRIPT"
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
reader_before_bash|sed|sed -n 1p bash "$SCRIPT"
bash_option|bash|bash -e "$SCRIPT"
bash_c_argument|bash|bash -c 'cat "$1"' _ "$SCRIPT"
echo_is_denied_too|echo|echo "$SCRIPT"
alias_variable|sed|COPY="$SCRIPT"; sed -n 1p "$COPY"
indirect_name|cat|NAME=SCRIPT; cat "${!NAME}"
array_element|cat|PATHS=("$SCRIPT"); cat "${PATHS[0]}"
literal_path|cat|cat "$(dirname "$0")/build.sh"
glob_path|cat|cat "$(dirname "$0")"/build.s?
brace_path|cat|cat "$(dirname "$0")"/build.{sh,txt}
ansi_c_path|cat|cat "$(dirname "$0")"/$'build\x2esh'
dynamic_path|?cannot tell whether ${NAME}.sh names|cat "$(dirname "$0")/${NAME}.sh"
dynamic_target|?cannot tell which script $NAME.sh names|OTHER="$(dirname "$0")/$NAME.sh"
function_named_bash|?redefines bash|bash() { cat "$1"; }
stub_named_bash|?names a file called bash|printf 'cat "$1"\n' >"$WORK/bin/bash"
finding_outranks_stub|sed|node() { :; }; sed -n 1p "$SCRIPT"
unterminated_quote|?cannot parse the test: unterminated "|cat "$SCRIPT
direct_run|-|"$SCRIPT" --verbose
sh_run|-|sh "$SCRIPT"
subshell_run|-|( bash "$SCRIPT" )
command_bash_runs|-|command bash "$SCRIPT"
env_split_bash_runs|-|env -S bash "$SCRIPT"
env_assignment_bash_runs|-|env CACHE_ROOT=/tmp/cache bash "$SCRIPT"
timeout_bash_runs|-|timeout 5 bash "$SCRIPT"
if_bash_runs|-|if CACHE_ROOT=/tmp/cache bash "$SCRIPT"; then :; fi
export_name|-|export SCRIPT
comment_mentions|-|bash "$SCRIPT" # not cat "$SCRIPT"
EOF
)"

expect() {
  local expected="$1" line="$2" dir output status
  shift 2
  dir="$(mktemp -d "$WORK/case.XXXXXX")"
  printf '%s\n' 'SCRIPT="$(dirname "$0")/build.sh"' "$@" >"$dir/build.test.sh"
  output="$(node "$CHECK" "$dir" 2>&1)"
  status=$?
  echo "$output"
  case "$expected" in
    -) [[ "$status" == 0 && "$output" == *"0 finding(s) in 1 shell test(s)"* ]] ;;
    \?*) [[ "$status" == 2 && "$output" == *"${expected#\?}"* ]] ;;
    *) [[ "$status" == 1 && "$output" == *"build.test.sh:$line: uses build.sh with $expected;"* ]] ;;
  esac
}

here_document_reads() { expect "a here-document" 3 'bash <<EOF' 'source $SCRIPT' 'EOF'; }
continued_line_reads() { expect sed 3 'sed -n 1p \' '  "$SCRIPT"'; }
continued_line_runs() { expect - 0 "CACHE_ROOT=/tmp/cache \\" '  bash "$SCRIPT"'; }
read_after_here_document() { expect sed 5 "cat <<'EOF'" 'text' 'EOF' 'sed -n 1p "$SCRIPT"'; }

historical_fixture_is_rejected() {
  local output status
  output="$(node "$CHECK" "$FIXTURES/$1")"
  status=$?
  echo "$output"
  [[ "$status" == 1 && "$output" == *"scripts/build.test.sh:5: uses build.sh with sed;"*"scripts/build.test.sh:6: uses build.sh with grep;"*"2 finding(s) in 1 shell test(s)"* ]]
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

while IFS='|' read -r name expected line; do
  report "$name" expect "$expected" 2 "$line"
done <<<"$CASES"
report here_document_reads here_document_reads
report continued_line_reads continued_line_reads
report continued_line_runs continued_line_runs
report read_after_here_document read_after_here_document
for fixture in violation prefixed split-string; do
  report "${fixture}_fixture_is_rejected" historical_fixture_is_rejected "$fixture"
done
exit $failed
