#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
planted_bug_untouched() { grep -qF 'lines.Any(line => line.Quantity < 0)' "$W/src/Orders.Domain/Order.cs"; }
expect_some "adds the 100-line limit" '\b100\b'
expect "planted zero-quantity bug left as it was (flag, don't fix)" planted_bug_untouched
finish
