#!/usr/bin/env bash
# Proves the deterministic parts of the harness without calling a model:
#   1. the fixture builds clean with templates/ (warnings as errors, format, tests);
#   2. every task's check passes its pass.patch (which must also clear the gate),
#      and fails on both its fail.patch and an empty diff (no always-green graders).
# Usage: evals/selftest.sh [task...]
set -uo pipefail
source "$(dirname "$0")/lib.sh"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
failures=0
report() { if [[ "$1" == ok ]]; then echo "  ok   $2"; else echo "  FAIL $2"; failures=$((failures+1)); fi; }

echo "fixture"
prepare "" none "$tmp/fixture" && gate "$tmp/fixture" >"$tmp/fixture.log" 2>&1 \
    && report ok "builds clean with templates/" || { report bad "builds clean with templates/ (see below)"; tail -30 "$tmp/fixture.log"; }

tasks=("$@"); [[ ${#tasks[@]} -eq 0 ]] && tasks=($(ls "$EVALS/tasks"))
for task in "${tasks[@]}"; do
    echo "$task"
    check="$EVALS/tasks/$task/check.sh"
    for sample in pass fail empty; do
        w="$tmp/$task-$sample"
        prepare "$task" none "$w" || { report bad "$sample: prepare"; continue; }
        if [[ "$sample" != empty ]]; then
            git -C "$w" apply --whitespace=nowarn "$EVALS/tasks/$task/selftest/$sample.patch" || { report bad "$sample: patch does not apply"; continue; }
        fi
        "$check" "$w" >"$w.log" 2>&1; status=$?
        case "$sample" in
            pass)
                [[ $status -eq 0 ]] && report ok "check passes pass.patch" || { report bad "check passes pass.patch"; cat "$w.log"; }
                gate "$w" >"$w.gate.log" 2>&1 && report ok "pass.patch clears the gate" || { report bad "pass.patch clears the gate"; tail -20 "$w.gate.log"; } ;;
            *)
                [[ $status -ne 0 ]] && report ok "check fails $sample" || { report bad "check fails $sample"; cat "$w.log"; } ;;
        esac
    done
done

[[ $failures -eq 0 ]] && echo "selftest: all ok" || echo "selftest: $failures failure(s)"
exit $((failures > 0))
