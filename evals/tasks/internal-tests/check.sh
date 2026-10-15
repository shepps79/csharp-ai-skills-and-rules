#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"

no_internals_visible_to() { git -C "$W" add -A >/dev/null; ! git -C "$W" grep -q 'InternalsVisibleTo' -- '*.cs' '*.csproj' '*.props' '*.targets'; }

expect_some "adds tests" '\[(Fact|Theory)\]' added_tests
expect_some "tests exercise the ORD- number format" 'ORD-' added_tests
expect "no InternalsVisibleTo (testing.md)" no_internals_visible_to
finish
