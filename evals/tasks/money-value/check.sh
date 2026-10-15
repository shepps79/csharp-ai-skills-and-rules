#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
# OrderLine is already a readonly record struct; only a newly introduced value type counts.
expect_some "new small value type is a readonly record struct" 'readonly\s+record\s+struct\s+(?!OrderLine\b)\w+\s*\('
expect_none "money value is not a class or reference record" '\b(class|record|record\s+class)\s+(Money|Price|Amount|CurrencyAmount)\b'
finish
