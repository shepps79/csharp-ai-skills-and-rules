#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
core() { added_in '^src/[^/]*\.(Domain|Application)/'; }
expect_some "Domain/Application uses Result" '\bResult\b' core
expect_none "no exceptions for expected failures in Domain/Application" '\bthrow\b(?!.*\b(ArgumentNullException|ArgumentOutOfRangeException|NotImplementedException|UnreachableException)\b)' core
expect_none "no branching on IsSuccess/IsFailure/HasValue" '(if|while)\s*\(.*\.(IsSuccess|IsFailure|HasValue|HasNoValue)\b|\.(IsSuccess|IsFailure|HasValue|HasNoValue)\s*(\?|$)|\b(IsSuccess|IsFailure|HasValue|HasNoValue)\s*:'
finish
