#!/usr/bin/env bash
# Runs each task <reps> times under a rule-set variant and grades the results.
# Usage: evals/run.sh <variant> <reps> [task...]
#   variant: none | current | <dir under evals/variants/>
# Env: EVAL_MODEL (sonnet), EVAL_EFFORT (model default), EVAL_BUDGET USD per run (3),
#      EVAL_JOBS parallel runs (3), EVAL_KEEP=1 keeps the temp workdirs.
# Output: evals/results/<utc-stamp>-<variant>/{results.csv,summary.md,runs/}
set -uo pipefail
source "$(dirname "$0")/lib.sh"

EVAL_MODEL="${EVAL_MODEL:-sonnet}" EVAL_EFFORT="${EVAL_EFFORT:-}" EVAL_BUDGET="${EVAL_BUDGET:-3}"

run_one() { # <variant> <task> <rep> <outdir> <tmpdir>
    local variant="$1" task="$2" rep="$3" out="$4" tmp="$5"
    local w="$tmp/$task-$rep" r="$out/runs/$task-$rep"
    mkdir -p "$r"
    prepare "$task" "$variant" "$w" >"$r/prepare.log" 2>&1 || { echo "prepare failed: $task-$rep" >&2; return; }

    local effort=(); [[ -n "$EVAL_EFFORT" ]] && effort=(--effort "$EVAL_EFFORT")
    local start=$SECONDS
    # Project settings only: no user CLAUDE.md, hooks, plugins or MCP servers leak in.
    (cd "$w" && claude -p "$(cat "$EVALS/tasks/$task/prompt.md")" \
        --model "$EVAL_MODEL" "${effort[@]}" \
        --setting-sources project --strict-mcp-config --no-session-persistence \
        --output-format stream-json --verbose --max-budget-usd "$EVAL_BUDGET" \
        --permission-mode acceptEdits \
        --allowedTools Read Edit Write Glob Grep "Bash(dotnet *)" "Bash(git *)" "Bash(ls *)" \
            "Bash(cat *)" "Bash(find *)" "Bash(grep *)" "Bash(head *)" "Bash(tail *)" "Bash(mkdir *)" \
        </dev/null >"$r/transcript.jsonl" 2>"$r/stderr.log")
    local duration=$((SECONDS - start))

    git -C "$w" add -A && git -C "$w" diff --cached baseline >"$r/diff.patch"
    local gate_ok=0 check_ok=0
    gate "$w" >"$r/gate.log" 2>&1 && gate_ok=1
    "$EVALS/tasks/$task/check.sh" "$w" >"$r/check.log" 2>&1 && check_ok=1

    local result cost turns failed
    result="$(grep '"type":"result"' "$r/transcript.jsonl" | tail -1)"
    cost="$(jq -r '.total_cost_usd // ""' <<<"$result" 2>/dev/null)"
    turns="$(jq -r '.num_turns // ""' <<<"$result" 2>/dev/null)"
    failed="$( (grep -h '^FAIL' "$r/check.log" "$r/gate.log" || true) | sed 's/^FAIL //' | paste -sd';' -)"
    local kind=fixture; [[ -f "$EVALS/tasks/$task/skeleton" ]] && kind=skeleton
    echo "$variant,$task,$rep,$EVAL_MODEL,$EVAL_EFFORT,$gate_ok,$check_ok,$((gate_ok && check_ok)),\"$failed\",$cost,$turns,$duration,$kind" >"$r/row.csv"
    [[ "${EVAL_KEEP:-0}" == 1 ]] || rm -rf "$w"
    echo "done $task-$rep: gate=$gate_ok check=$check_ok cost=$cost"
}

if [[ "${1:-}" == --one ]]; then shift; run_one "$@"; exit; fi

[[ $# -ge 2 ]] || { sed -n '2,8p' "$0"; exit 2; }
variant="$1" reps="$2"; shift 2
tasks=("$@"); [[ ${#tasks[@]} -eq 0 ]] && tasks=($(ls "$EVALS/tasks"))
out="$EVALS/results/$(date -u +%Y%m%dT%H%M%SZ)-$variant"
tmp="$(mktemp -d)"
[[ "${EVAL_KEEP:-0}" == 1 ]] && echo "workdirs kept in $tmp" || trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

# xargs appends "<task> <rep>" to the fixed args: $1=variant $2=out $3=tmp $4=task $5=rep.
for task in "${tasks[@]}"; do for rep in $(seq 1 "$reps"); do echo "$task $rep"; done; done \
    | xargs -P "${EVAL_JOBS:-3}" -L1 bash -c '"$0" --one "$1" "$4" "$5" "$2" "$3"' "$0" "$variant" "$out" "$tmp"

{
    echo "variant,task,rep,model,effort,gate,check,pass,failed_checks,cost_usd,turns,duration_s,kind"
    cat "$out"/runs/*/row.csv 2>/dev/null
} >"$out/results.csv"
"$EVALS/report.sh" "$out/results.csv" >"$out/summary.md"
cat "$out/summary.md"
