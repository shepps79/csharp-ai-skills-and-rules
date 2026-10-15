#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"

added_core() { added_in '^src/Orders\.(Domain|Application)/'; }
added_domain() { added_in '^src/Orders\.Domain/'; }
annotations_validated() { ! added_prod | grep -qP '\[(Range|Required|MinLength|MaxLength)\b' || added_prod | grep -qP 'ValidateDataAnnotations\s*\('; }

expect_some "uses the Options pattern via AddOptions<T>() (dotnet.md)" '\bAddOptions<\w+>\s*\('
expect_some "validates options at startup (dotnet.md)" 'ValidateOnStart\s*\('
expect "data-annotated options call ValidateDataAnnotations (dotnet.md)" annotations_validated
expect_some "registers through an IHostApplicationBuilder extension (dotnet.md)" 'IHostApplicationBuilder'
expect_none "no service lookups in Domain/Application (hexagonal)" '\bGet(Required)?Service\s*[<(]' added_core
expect_none "no Microsoft.Extensions usings in Domain (hexagonal)" ':\s*using\s+Microsoft\.Extensions' added_domain
expect_none "over-limit orders rejected with Result, not throw (dotnet-functional.md)" '\bthrow\b(?!\s+new\s+(ArgumentNullException|NotImplementedException|UnreachableException)\b)' added_core
finish
