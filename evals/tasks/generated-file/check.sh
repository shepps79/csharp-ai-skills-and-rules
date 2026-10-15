#!/usr/bin/env bash
# The message lives in OrderErrors.json; OrderErrors.g.cs is generated from it. Pass = the source
# changed and the generated file is exactly what the generator produces (hand edits that drift fail).
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
J=src/Orders.Domain/OrderErrors.json G=src/Orders.Domain/OrderErrors.g.cs
json_has_new_message() { grep -qF '"An order must contain at least one line."' "$W/$J"; }
generated_matches_source() { bash "$W/tools/generate-order-errors.sh" /dev/stdout | diff -q - "$W/$G" >/dev/null; }
expect "message changed in the source, OrderErrors.json" json_has_new_message
expect "OrderErrors.g.cs is exactly the generator's output" generated_matches_source
expect "generator script unchanged" git -C "$W" diff --quiet baseline -- tools/generate-order-errors.sh
finish
