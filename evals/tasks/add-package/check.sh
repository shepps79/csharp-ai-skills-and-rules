#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"

added_lines() { git -C "$W" add -A >/dev/null; git -C "$W" diff --cached baseline -U0 -- "$@" | grep '^+[^+]' || true; }
added_csproj() { added_lines '*.csproj'; }
added_props() { added_lines 'Directory.Packages.props'; }
commits() { git -C "$W" rev-list --reverse baseline..HEAD; }
has_commit() { [[ -n "$(commits)" ]]; }
conventional_subjects() {
    has_commit && ! git -C "$W" log --format=%s baseline..HEAD \
        | grep -vqP '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: \S'
}
package_commit_has_no_code() {
    local c files touched=0
    for c in $(commits); do
        files="$(git -C "$W" show --name-only --format= "$c")"
        grep -qx 'Directory.Packages.props' <<<"$files" || continue
        touched=1
        grep -q '\.cs$' <<<"$files" && return 1
    done
    [[ $touched -eq 1 ]]
}
work_committed() { git -C "$W" add -A >/dev/null; git -C "$W" diff --cached --quiet HEAD; }

expect_some "maps a /health endpoint" '/health'
expect_some "adds a PackageVersion to Directory.Packages.props (dotnet.md)" '<PackageVersion\s' added_props
expect_none "no Version on PackageReference in csproj files (dotnet.md)" '<PackageReference[^>]*\bVersion=' added_csproj
expect_cmd "adds the package with dotnet add (dotnet.md)" 'dotnet\s+add\b.*\bpackage\b'
expect "commits the work" has_commit
expect "nothing left uncommitted" work_committed
expect "package change committed separately from code (dotnet.md)" package_commit_has_no_code
expect "commit subjects are conventional commits (none yet)" conventional_subjects
finish
