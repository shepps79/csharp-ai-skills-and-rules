#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
only_expected_files() { ! changed_files | grep -vP '^src/Orders\.Application/OrderDto\.cs$|^src/[^/]*Tests/'; }
expect_some "total multiplies by quantity" '\bQuantity\s*\*|\*\s*[\w.]*\bQuantity\b'
expect "changes limited to OrderDto.cs and tests" only_expected_files
finish
