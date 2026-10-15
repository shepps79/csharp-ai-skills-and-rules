#!/usr/bin/env bash
# Checks the LLM judge against hand-labelled samples before its verdicts are trusted. Costs tokens.
# Each tasks/<task>/calibration/<sample>/ holds:
#   patch             optional, applied on top of the prepared fixture (may be a symlink to selftest/*.patch)
#   transcript.jsonl  optional, stream-json transcript the judge reads
#   expected.json     {"<item id>": true|false, ...} — the human label for every rubric item
# Usage: evals/calibrate.sh [task...]   Env: EVAL_JUDGE_MODEL, EVAL_JUDGE_EFFORT, CAL_REPS (1)
set -uo pipefail
source "$(dirname "$0")/lib.sh"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
agree=0 disagree=0
tasks=("$@"); [[ ${#tasks[@]} -eq 0 ]] && tasks=($(cd "$EVALS/tasks" && ls -d */rubric.md 2>/dev/null | xargs -rn1 dirname))
for task in "${tasks[@]}"; do
    for sample in "$EVALS/tasks/$task"/calibration/*/; do
        name="$task/$(basename "$sample")"
        for rep in $(seq 1 "${CAL_REPS:-1}"); do
            w="$tmp/$task-$(basename "$sample")-$rep" r="$w.run"
            mkdir -p "$r"
            prepare "$task" none "$w" >/dev/null || { echo "  FAIL $name: prepare"; disagree=$((disagree+1)); continue; }
            [[ -f "$sample/patch" ]] && git -C "$w" apply --whitespace=nowarn "$sample/patch"
            [[ -f "$sample/transcript.jsonl" ]] && cp "$sample/transcript.jsonl" "$r/"
            python3 "$EVALS/judge.py" "$EVALS/tasks/$task" "$w" "$r" >/dev/null
            while read -r id want got evidence; do
                if [[ "$want" == "$got" ]]; then agree=$((agree+1));
                else disagree=$((disagree+1)); echo "  DISAGREE $name item $id: expected $want, judge $got — $evidence"; fi
            done < <(jq -r --slurpfile exp "$sample/expected.json" \
                '.items[]? | "\(.id) \($exp[0][.id|tostring]) \(.pass) \(.evidence|gsub("\n";" ")|.[0:120])"' "$r/judge.json")
            jq -e '.items' "$r/judge.json" >/dev/null 2>&1 || { echo "  FAIL $name: judge error"; disagree=$((disagree+1)); }
        done
    done
done
echo "calibration: $agree agree, $disagree disagree"
exit $((disagree > 0))
