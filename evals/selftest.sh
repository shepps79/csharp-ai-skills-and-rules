#!/usr/bin/env bash
# Proves the deterministic parts of the harness without calling a model:
#   1. the fixture builds clean with templates/ (warnings as errors, format, tests);
#   2. every task's check.sh passes its pass sample (which must also clear the gate),
#      and fails on both its fail sample and an empty diff (no always-green graders);
#   3. every rubric.md has calibration samples labelling each item, with at least one
#      all-pass and one failing label (run evals/calibrate.sh to test the judge itself).
# A sample is selftest/<pass|fail>.patch (applied) or selftest/<pass|fail>.sh (run in the
# workdir, for setups a patch can't express such as commits), plus an optional
# selftest/<pass|fail>.transcript.jsonl for transcript checks.
# Usage: evals/selftest.sh [task...]
set -uo pipefail
source "$(dirname "$0")/lib.sh"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
failures=0
report() { if [[ "$1" == ok ]]; then echo "  ok   $2"; else echo "  FAIL $2"; failures=$((failures+1)); fi; }

apply_sample() { # <task-dir> <sample> <workdir> <rundir>
    local t="$1" s="$2" w="$3" r="$4"
    mkdir -p "$r"
    [[ -f "$t/selftest/$s.transcript.jsonl" ]] && cp "$t/selftest/$s.transcript.jsonl" "$r/transcript.jsonl"
    if [[ -f "$t/selftest/$s.patch" ]]; then git -C "$w" apply --whitespace=nowarn "$t/selftest/$s.patch"
    elif [[ -f "$t/selftest/$s.sh" ]]; then (cd "$w" && bash "$t/selftest/$s.sh" >/dev/null)
    else true; fi
}

echo "fixture"
prepare "" none "$tmp/fixture" && gate "$tmp/fixture" >"$tmp/fixture.log" 2>&1 \
    && report ok "builds clean with templates/" || { report bad "builds clean with templates/ (see below)"; tail -30 "$tmp/fixture.log"; }

tasks=("$@"); [[ ${#tasks[@]} -eq 0 ]] && tasks=($(ls "$EVALS/tasks"))
for task in "${tasks[@]}"; do
    echo "$task"
    t="$EVALS/tasks/$task"
    [[ -f "$t/prompt.md" && -f "$t/rules.txt" ]] || report bad "has prompt.md and rules.txt"
    [[ -x "$t/check.sh" || -f "$t/rubric.md" ]] || report bad "has check.sh or rubric.md"

    if [[ -x "$t/check.sh" ]]; then
        for sample in pass fail empty; do
            w="$tmp/$task-$sample" r="$tmp/$task-$sample.run"
            prepare "$task" none "$w" || { report bad "$sample: prepare"; continue; }
            if [[ "$sample" != empty ]]; then
                apply_sample "$t" "$sample" "$w" "$r" || { report bad "$sample: sample does not apply"; continue; }
            else mkdir -p "$r"; fi
            "$t/check.sh" "$w" "$r" >"$w.log" 2>&1; status=$?
            case "$sample" in
                pass)
                    [[ $status -eq 0 ]] && report ok "check passes pass sample" || { report bad "check passes pass sample"; cat "$w.log"; }
                    gate "$w" >"$w.gate.log" 2>&1 && report ok "pass sample clears the gate" || { report bad "pass sample clears the gate"; tail -20 "$w.gate.log"; } ;;
                *)
                    [[ $status -ne 0 ]] && report ok "check fails $sample" || { report bad "check fails $sample"; cat "$w.log"; } ;;
            esac
        done
    fi

    if [[ -f "$t/rubric.md" ]]; then
        ids="$(grep -oP '^\d+(?=\.\s)' "$t/rubric.md" | sort -n | paste -sd, -)"
        labels=("$t"/calibration/*/expected.json)
        if [[ ! -f "${labels[0]}" || ${#labels[@]} -lt 2 ]]; then report bad "rubric has at least 2 calibration samples"; continue; fi
        bad=0 all_pass=0 some_fail=0
        for e in "${labels[@]}"; do
            [[ "$(jq -r 'keys | map(tonumber) | sort | join(",")' "$e")" == "$ids" ]] || { bad=1; echo "    $e does not label items $ids"; }
            jq -e 'all(.[]; . == true)' "$e" >/dev/null && all_pass=1
            jq -e 'any(.[]; . == false)' "$e" >/dev/null && some_fail=1
        done
        [[ $bad -eq 0 && $all_pass -eq 1 && $some_fail -eq 1 ]] \
            && report ok "rubric calibration samples label every item (all-pass + failing)" \
            || report bad "rubric calibration samples label every item (all-pass + failing)"
    fi
done

[[ $failures -eq 0 ]] && echo "selftest: all ok" || echo "selftest: $failures failure(s)"
exit $((failures > 0))
