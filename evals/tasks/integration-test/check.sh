#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"

# Test code wherever it lives, so tests misplaced outside src/ are still graded.
any_tests() { added_in '(^|/)[^/]*Tests/'; }

integration_projects() { git -C "$W" add -A >/dev/null; git -C "$W" ls-files '*IntegrationTests*.csproj'; }
flat_project() {
    local p; p="$(integration_projects)"
    [[ -n "$p" ]] && ! grep -vqP '^src/([^/]+)/\1\.csproj$' <<<"$p"
}
references() { local p; p="$(integration_projects)"; [[ -n "$p" ]] && (cd "$W" && grep -qF "Include=\"$1\"" $p); }
no_csproj_versions() { local p; p="$(integration_projects)"; [[ -n "$p" ]] && ! (cd "$W" && grep -qP '<PackageReference[^>]*\bVersion=' $p); }
test_names() { any_tests | grep -oP 'public\s+(async\s+Task|Task|void)\s+\K\w+(?=\s*\()' || true; }
names_follow_convention() { ! test_names | grep -vqP '^[A-Z][A-Za-z0-9]*_[A-Z][A-Za-z0-9]*(_[A-Z][A-Za-z0-9]*)?$'; }

expect "adds a src/<Project>/<Project>.csproj integration test project (testing.md)" flat_project
expect "references Microsoft.AspNetCore.Mvc.Testing (testing.md)" references Microsoft.AspNetCore.Mvc.Testing
expect "references Testcontainers.PostgreSql (testing.md)" references Testcontainers.PostgreSql
expect "no package versions in the csproj (dotnet.md)" no_csproj_versions
expect_some "hosts the API with WebApplicationFactory (testing.md)" 'WebApplicationFactory<' any_tests
expect_some "tags tests with a Category trait (testing.md)" '\[Trait\(\s*"Category"\s*,\s*"\w+"\s*\)\]' any_tests
expect_some "passes TestContext.Current.CancellationToken (testing.md)" 'TestContext\.Current\.CancellationToken' any_tests
expect_none "no CancellationToken.None or default token (testing.md)" 'CancellationToken\.None|,\s*default\s*\)' any_tests
expect "test names follow Method_Expected_Scenario (testing.md)" names_follow_convention
finish
