#!/usr/bin/env bash
# Greenfield scaffold checks: tree, csproj files and added code. Project roles are found by name suffix.
source "$(dirname "$0")/../../lib.sh"; W="$1"
cd "$W" || exit 1
git add -A >/dev/null

mapfile -t csprojs < <(git ls-files '*.csproj')
named() { printf '%s\n' "${csprojs[@]}" | grep -E "/[^/]*\.($1)\.csproj$" || true; }
refs() { [[ -n "$1" ]] && grep -o 'Include="[^"]*\.csproj"' $1 | sed -E 's/.*[\\/]([^\\/]+)\.csproj"/\1/'; }
pkgs() { [[ -n "$1" ]] && grep -ho '<PackageReference Include="[^"]*"' $1 | cut -d'"' -f2; }
tests="$(named '[A-Za-z]*Tests')" domain="$(named Domain)" app="$(named Application)"
infra="$(named Infrastructure)" api="$(named 'Api|WebApi|Web|Presentation')"
unit="$(named UnitTests)" integration="$(named IntegrationTests)"
prod=$(printf '%s\n' "${csprojs[@]}" | grep -vE 'Tests\.csproj$' || true)

has_projects() { [[ ${#csprojs[@]} -gt 0 && -n "${csprojs[0]}" ]]; }
one_solution() { [[ $(compgen -G "*.sln*" | wc -l) -eq 1 ]]; }
flat_layout() { has_projects && ! printf '%s\n' "${csprojs[@]}" | grep -vqE '^src/([^/]+)/\1\.csproj$'; }
cpm() { has_projects && grep -qs '<ManagePackageVersionsCentrally>true<' Directory.Packages.props && ! grep -qE '<PackageReference[^>]*Version=' "${csprojs[@]}"; }
each_csproj() { has_projects || return 1; local p; for p in "${csprojs[@]}"; do grep -qE "$1" "$p" || return 1; done; }
net10() { each_csproj 'net10\.0' || grep -qs '<TargetFramework>net10\.0<' Directory.Build.props; }
layers() { [[ -n "$domain" && -n "$app" && -n "$infra" && -n "$api" ]]; }
domain_refs_nothing() { [[ -n "$domain" && -z "$(refs "$domain")" ]]; }
app_refs_domain_only() { [[ -n "$app" ]] && ! refs "$app" | grep -vqE '\.Domain$'; }
nothing_refs_api() { [[ -z "$prod" ]] || ! refs "$prod" | grep -qE '\.(Api|WebApi|Web|Presentation)$'; }
domain_pure() {
    [[ -n "$domain" ]] && ! pkgs "$domain" | grep -qE 'EntityFrameworkCore|AspNetCore|Npgsql' \
        && ! grep -rqsE '^using Microsoft\.(EntityFrameworkCore|AspNetCore)' "$(dirname "$domain")" --include='*.cs'
}
app_no_db() { [[ -n "$app" ]] && ! pkgs "$app" | grep -qE 'EntityFrameworkCore|Npgsql|Dapper'; }
test_stack() {
    [[ -n "$tests" ]] && pkgs "$tests" | grep -qx 'xunit.v3' && pkgs "$tests" | grep -qx 'AwesomeAssertions' \
        && ! pkgs "$tests" | grep -qxE 'xunit|NUnit|MSTest.*|FluentAssertions|Shouldly|NSubstitute|FakeItEasy'
}
unit_uses_moq() { [[ -n "$unit" ]] && pkgs "$unit" | grep -qx Moq && ! pkgs "$unit" | grep -qi testcontainers; }
integration_testcontainers() { [[ -n "$integration" ]] && pkgs "$integration" | grep -qx 'Testcontainers.PostgreSql'; }
functional_lib() {
    has_projects && grep -qs CSharpFunctionalExtensions "${csprojs[@]}" \
        && ! grep -qsE 'LanguageExt|OneOf|FluentResults|ErrorOr' "${csprojs[@]}"
}
no_swashbuckle() { ! grep -qs Swashbuckle "${csprojs[@]}" Directory.Packages.props; }
no_internals_visible_to() { ! git grep -qE 'InternalsVisibleTo' -- '*.cs' '*.csproj' '*.props'; }
test_token() { ! git grep -qE 'CancellationToken\.None' -- 'src/*Tests/*.cs'; }

expect "creates projects" has_projects
expect "single solution file at the root (no rule yet)" one_solution
expect "flat src/<Project>/<Project>.csproj layout (testing.md)" flat_layout
expect "central package management, no versions in csproj (dotnet.md)" cpm
expect "TreatWarningsAsErrors in every csproj (dotnet.md)" each_csproj '<TreatWarningsAsErrors>true<'
expect "targets net10.0 (AGENTS.md)" net10
expect "Domain, Application, Infrastructure and Api projects (hexagonal)" layers
expect "Domain references no projects (hexagonal)" domain_refs_nothing
expect "Application references only Domain (hexagonal)" app_refs_domain_only
expect "no production project references the Api (hexagonal)" nothing_refs_api
expect "no EF/AspNetCore in Domain (hexagonal)" domain_pure
expect "no database packages in Application (hexagonal)" app_no_db
expect "xUnit v3 + AwesomeAssertions only (testing.md)" test_stack
expect "UnitTests project mocks with Moq, no Testcontainers (testing.md)" unit_uses_moq
expect "IntegrationTests project uses Testcontainers.PostgreSql (testing.md)" integration_testcontainers
expect "CSharpFunctionalExtensions only (dotnet-functional.md)" functional_lib
expect "no Swashbuckle (dotnet.md)" no_swashbuckle
expect "no InternalsVisibleTo (testing.md)" no_internals_visible_to
expect "tests pass TestContext.Current.CancellationToken (testing.md)" test_token
expect_none "no branching on IsSuccess/IsFailure/HasValue (dotnet-functional.md)" '(if|while)\s*\(.*\.(IsSuccess|IsFailure|HasValue|HasNoValue)\b|\.(IsSuccess|IsFailure|HasValue|HasNoValue)\s*(\?|$)|\b(IsSuccess|IsFailure|HasValue|HasNoValue)\s*:'
expect_none "no this-parameter extension methods (csharp14-idioms)" '\(\s*this\s+[A-Za-z_]'
expect_none "no loops in production code (dotnet-functional.md)" ':\s*(for|foreach|while)\s*\('
finish
