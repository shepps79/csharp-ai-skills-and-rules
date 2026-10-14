#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"
expect_some "adds a POST endpoint" 'MapPost\s*\('
expect_some "resolves the Result with Match" '\bMatch\s*\('
expect_none "no branching on IsSuccess/IsFailure/HasValue" '(if|while)\s*\(.*\.(IsSuccess|IsFailure|HasValue|HasNoValue)\b|\.(IsSuccess|IsFailure|HasValue|HasNoValue)\s*(\?|$)|\b(IsSuccess|IsFailure|HasValue|HasNoValue)\s*:'
finish
