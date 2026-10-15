#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
expect_some "uses a switch expression" '\bswitch\s*$|\w\s+switch\b'
expect_none "a discard switch arm throws NotImplementedException" ':\s+_\s*=>(?!\s*throw new NotImplementedException)'
expect_none "property patterns nested at most one level" '\{[^{}]*\b\w+\s*:\s*\{'
finish
