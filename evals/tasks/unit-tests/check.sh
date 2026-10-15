#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"

# Test code wherever it lives, so tests misplaced outside src/ are still graded.
any_tests() { added_in '(^|/)[^/]*Tests/'; }

# Every added line in test projects, .cs and .csproj alike.
added_test_files() { git -C "$W" add -A >/dev/null; git -C "$W" diff --cached baseline -U0 -- 'src/*Tests/*' | grep '^+[^+]' || true; }
test_names() { any_tests | grep -oP 'public\s+(async\s+Task|Task|void)\s+\K\w+(?=\s*\()' || true; }
names_follow_convention() { ! test_names | grep -vqP '^[A-Z][A-Za-z0-9]*_[A-Z][A-Za-z0-9]*(_[A-Z][A-Za-z0-9]*)?$'; }
classes_sealed() { ! any_tests | grep -P '\bclass\s+\w+' | grep -vqP '\b(sealed|static|abstract)\b'; }
memberdata_uses_theorydatarow() { ! any_tests | grep -q 'MemberData' || any_tests | grep -q 'TheoryDataRow'; }

expect_some "adds tests" '\[(Fact|Theory)\]' any_tests
expect_some "covers GetOrderUseCase" 'GetOrderUseCase' any_tests
expect "test names follow Method_Expected_Scenario (testing.md)" names_follow_convention
expect "test classes are sealed (testing.md)" classes_sealed
expect_some "passes TestContext.Current.CancellationToken (testing.md)" 'TestContext\.Current\.CancellationToken' any_tests
expect_none "no CancellationToken.None or default token (testing.md)" 'CancellationToken\.None|,\s*default\s*\)' any_tests
expect_some "mocks outbound ports with Moq (testing.md)" 'Mock<I\w+>' any_tests
expect_none "no logger mocks, Testcontainers or NSubstitute in unit tests (testing.md, tension 3)" 'Mock<ILogger|Testcontainers|NSubstitute|Substitute\.For' added_test_files
expect_none "no logic in tests (testing.md)" ':\s*(if|for|foreach|while|switch)\s*\(' any_tests
expect_none "no section separator comments (testing.md)" '//\s*(─|-{3,}|={3,})' any_tests
expect "MemberData uses TheoryDataRow (testing.md)" memberdata_uses_theorydatarow
expect_some "asserts with AwesomeAssertions (testing.md)" '\.Should\(\)' any_tests
finish
