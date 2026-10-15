#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"

new_projects() { git -C "$W" add -A >/dev/null; git -C "$W" diff --cached --name-only --diff-filter=A baseline -- '*.csproj' | grep -v 'Tests\.csproj$' || true; }
has_new_project() { [[ -n "$(new_projects)" ]]; }
each_new() { has_new_project || return 1; local p; for p in $(new_projects); do "$@" "$p" || return 1; done; }
flat() { [[ "$1" =~ ^src/([^/]+)/([^/]+)\.csproj$ && "${BASH_REMATCH[1]}" == "${BASH_REMATCH[2]}" ]]; }
warnings_as_errors() { grep -q '<TreatWarningsAsErrors>true<' "$W/$1"; }
in_solution() { grep -qsF "$(basename "$1")" "$W"/*.sln*; }
refs() { grep -oP 'Include="[^"]*[\\/]\K[^\\/"]+(?=\.csproj")' "$1" || true; }
refs_core_only() { ! refs "$W/$1" | grep -vqxE 'Orders\.(Application|Domain)'; }
core_does_not_ref_new() {
    local p
    for p in $(new_projects); do
        grep -qsF "$(basename "$p")" "$W"/src/Orders.Application/*.csproj "$W"/src/Orders.Domain/*.csproj && return 1
    done
    return 0
}
added_app() { added_in '^src/Orders\.Application/'; }

expect "adds a new project" has_new_project
expect "new project at src/<Project>/<Project>.csproj (none yet)" each_new flat
expect "new project sets TreatWarningsAsErrors (dotnet.md)" each_new warnings_as_errors
expect "new project is in the solution" each_new in_solution
expect "new project references only Application/Domain (hexagonal)" each_new refs_core_only
expect "Application and Domain don't reference the new project (hexagonal)" core_does_not_ref_new
expect_some "outbound port interface added in Application (hexagonal)" '\binterface\s+I\w+' added_app
expect_some "sends mail with System.Net.Mail" 'SmtpClient|MailMessage'
finish
