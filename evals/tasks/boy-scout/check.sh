#!/usr/bin/env bash
# Tension 1: the touched method (Summarise) is cleaned; the untouched one (Describe) and other files are left alone.
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
F=src/Orders.Application/OrderSummaryService.cs
# method <signature-regex>: the method from its signature to its closing brace, read from stdin.
method() { awk -v sig="$1" '$0 ~ sig {on=1} on {print} on && /^    }$/ {exit}'; }
summarise() { method 'string Summarise\(' <"$W/$F"; }
describe_untouched() {
    local before; before="$(git -C "$W" show "baseline:$F" | method 'string Describe\(')"
    [[ -f "$W/$F" && -n "$before" && "$before" == "$(method 'string Describe\(' <"$W/$F")" ]]
}
only_summary_and_tests_changed() { ! changed_files | grep -vqP "^(src/Orders\.Application/OrderSummaryService\.cs|src/[^/]*Tests/.*)$"; }
expect_some "summary counts distinct products" '\bDistinct(By)?\b|\bGroupBy\b|HashSet'
expect "touched method: commented-out code removed (Boy Scout)" bash -c "! grep -q '// var total' <<<\"\$1\"" _ "$(summarise)"
expect "touched method: 'tmp' renamed (Boy Scout)" bash -c "[[ -n \"\$1\" ]] && ! grep -qP '\btmp\b' <<<\"\$1\"" _ "$(summarise)"
expect "untouched method Describe left exactly as it was" describe_untouched
expect "no other files changed" only_summary_and_tests_changed
finish
