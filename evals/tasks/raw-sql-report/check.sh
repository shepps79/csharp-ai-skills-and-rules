#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
infra() { added_in '^src/[^/]*\.Infrastructure/'; }
expect_some "uses a raw string literal" '"""'
expect_none "no SQL built from \\n escapes, verbatim strings or concatenation" '\\n"|"\s*\+\s*$|:\s*\+\s*\$?"|@"|\$@"' infra
finish
