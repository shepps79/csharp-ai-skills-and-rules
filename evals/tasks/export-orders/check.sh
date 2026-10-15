#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
expect_some "streams with IAsyncEnumerable<T>" 'IAsyncEnumerable<'
expect_none "no blocking on tasks (.Result/.Wait()/GetAwaiter().GetResult())" '\.Result\b|\.Wait\(\s*\)|GetAwaiter\(\)\.GetResult\(\)'
expect_none "no async void" '\basync\s+void\b'
finish
