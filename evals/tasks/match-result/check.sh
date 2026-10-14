#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"
expect_some "adds a POST endpoint" 'MapPost\s*\('
expect_some "resolves the Result with Match" '\bMatch\s*\('
expect_none "no IsSuccess/IsFailure/HasValue checks" '\.(IsSuccess|IsFailure|HasValue|HasNoValue)\b|\b(IsSuccess|IsFailure|HasValue)\s*:'
finish
