#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"
expect_some "uses an extension block" '\bextension\s*(<[^>]*>)?\s*\('
expect_none "no this-parameter extension methods" '\(\s*this\s+[A-Za-z_]'
expect_none "no loops in production code" ':\s*(for|foreach|while)\s*\('
finish
