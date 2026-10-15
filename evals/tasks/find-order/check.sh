#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
core() { added_in '^src/[^/]*\.(Domain|Application)/'; }
no_new_packages() { ! git -C "$W" diff --cached baseline -- Directory.Packages.props | grep -q '^+.*PackageVersion'; }
expect_some "models absence with Maybe<T>" 'Maybe<'
expect_none "no nullable returns or return null in Domain/Application" 'Task<\w+\?>|\b\w+\?\s+\w+\s*\(|\breturn\s+null\b' core
expect "no new packages (CSharpFunctionalExtensions only)" no_new_packages
finish
