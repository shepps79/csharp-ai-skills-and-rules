#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"

no_swashbuckle() { git -C "$W" add -A >/dev/null; ! git -C "$W" grep -qi 'swashbuckle\|AddSwaggerGen' -- '*.cs' '*.csproj' '*.props'; }  # not .claude/: skills mention Swagger

expect_some "uses the built-in OpenAPI document (dotnet.md)" '\b(AddOpenApi|MapOpenApi)\s*\('
expect "no Swashbuckle (dotnet.md)" no_swashbuckle
finish
