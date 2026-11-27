#!/usr/bin/env bash
# Tests for scripts/check_no_pile.py, run on a throwaway repository with synthetic data only.
set -uo pipefail
src="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$work"
git init -q -b main && git config user.email t@example.invalid && git config user.name test
mkdir -p scripts tests/fixtures docs
cp "$src/scripts/check_no_pile.py" "$src/scripts/check_no_pile.sh" scripts/
cp "$src"/tests/fixtures/*.json tests/fixtures/
echo "# ok" > README.md
git add -A && git commit -qm base
base="$(git rev-parse HEAD)"

failures=0
expect() { # expect <0|1> <description> <command...>
  local want="$1" desc="$2"; shift 2
  "$@" >/dev/null 2>&1; local got=$?
  [[ $got -ne 0 ]] && got=1
  if [[ $got -eq $want ]]; then echo "ok   - $desc"; else echo "FAIL - $desc (exit $got)"; failures=$((failures+1)); fi
}
stage() { mkdir -p "$(dirname "$1")"; printf '%s' "$2" > "$1"; git add -f "$1"; }
reset_stage() { git reset -q --hard "$base"; git clean -qfdx; }

expect 0 "albero pulito, fixture esenti" bash scripts/check_no_pile.sh --tree
stage data/x.json '{}';                                  expect 1 "file sotto data/" bash scripts/check_no_pile.sh; reset_stage
stage site/p.json '[{"type":"memorized","expected_ids":[]}]'; expect 1 "memorized anche con expected_ids vuoto" bash scripts/check_no_pile.sh; reset_stage
stage site/p.jsonl '{"type":"memorized"}';               expect 1 "memorized in .jsonl" bash scripts/check_no_pile.sh; reset_stage
stage site/c.json '[{"type":"control","expected_ids":[1]}]'; expect 0 "solo controlli" bash scripts/check_no_pile.sh; reset_stage
stage registro.csv 'a,b';                                expect 1 "esportazione CSV" bash scripts/check_no_pile.sh; reset_stage
stage docs/r.md "$(printf '```estratto\n%0300d\n```\n' 0)"; expect 1 "blocco estratto lungo in docs/" bash scripts/check_no_pile.sh; reset_stage

# The hook must read the staged content, not the working tree.
stage site/s.json '[{"type":"memorized"}]'; printf '[]' > site/s.json
expect 1 "contenuto in stage, non nel working tree" bash scripts/check_no_pile.sh; reset_stage

# A file added and removed inside a range must be caught by --range, not by --tree.
stage data/y.json '{}'; git commit -qm add; git rm -q data/y.json; git commit -qm remove
expect 0 "--tree non vede file rimossi" bash scripts/check_no_pile.sh --tree
expect 1 "--range vede file aggiunti e poi rimossi" bash scripts/check_no_pile.sh --range "$base..HEAD"
reset_stage

echo "fallimenti: $failures"
exit $(( failures > 0 ))
