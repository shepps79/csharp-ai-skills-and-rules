# Shared helpers for run.sh, selftest.sh and tasks/*/check.sh. Source it; don't execute it.

EVALS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$EVALS")"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 MSBUILDDISABLENODEREUSE=1

# prepare <task> <variant> <dest>: fixture + compiler templates + variant rules + task fixture.patch,
# committed and tagged `baseline` so graders only ever see the agent's changes.
# A task with a `skeleton` marker file starts greenfield: templates only, no fixture.
prepare() {
    local task="$1" variant="$2" dest="$3"
    mkdir -p "$dest"
    [[ -f "$EVALS/tasks/$task/skeleton" ]] || cp -r "$EVALS/fixture/." "$dest/"
    cp -r "$EVALS/templates/." "$dest/"
    case "$variant" in
        none) ;;
        current)
            for f in AGENTS.md CLAUDE.md; do [[ -f "$REPO/$f" ]] && cp "$REPO/$f" "$dest/"; done
            for d in rules skills; do
                [[ -d "$REPO/.claude/$d" ]] && mkdir -p "$dest/.claude" && cp -r "$REPO/.claude/$d" "$dest/.claude/"
            done ;;
        *)
            [[ -d "$EVALS/variants/$variant" ]] || { echo "unknown variant: $variant" >&2; return 1; }
            cp -r "$EVALS/variants/$variant/." "$dest/" ;;
    esac
    (
        cd "$dest" || exit 1
        git init -q -b main
        git config user.email eval@example.com
        git config user.name eval
        [[ -f "$EVALS/tasks/$task/fixture.patch" ]] && git apply "$EVALS/tasks/$task/fixture.patch"
        git add -A && git commit -qm "chore: baseline" && git tag baseline
        if compgen -G "*.sln*" >/dev/null; then dotnet restore -v q >/dev/null; fi
    )
}

# gate <workdir>: compiler config not weakened, then build (warnings as errors), format, unit tests.
gate() {
    local w="$1"
    (
        cd "$w" || exit 1
        git add -A >/dev/null
        git diff --quiet baseline -- .editorconfig || { echo "FAIL .editorconfig modified"; exit 1; }
        [[ -z "$(git ls-files '*.editorconfig' ':!:.editorconfig')" ]] || { echo "FAIL nested .editorconfig added"; exit 1; }
        grep -q '<EnforceCodeStyleInBuild>true<' Directory.Build.props && grep -q '<GenerateDocumentationFile>true<' Directory.Build.props \
            || { echo "FAIL Directory.Build.props weakened"; exit 1; }
        # Build the solution wherever the agent put it; whether it sits at the root is a task check.
        local sln; sln="$(git ls-files '*.sln' '*.slnx' | awk -F/ '{print NF, $0}' | sort -n | head -1 | cut -d' ' -f2)"
        [[ -n "$sln" ]] || { echo "FAIL no solution file"; exit 1; }
        cd "$(dirname "$sln")" || exit 1
        dotnet build -warnaserror -v q -nologo || { echo "FAIL build"; exit 1; }
        dotnet format --verify-no-changes --no-restore || { echo "FAIL format"; exit 1; }
        # The filter syntax differs between Microsoft.Testing.Platform and VSTest.
        local filter=(--filter "Category!=Integration")
        # Exit code 8 = "zero tests ran", i.e. a project holding only integration tests.
        grep -qs Microsoft.Testing.Platform global.json "$w/global.json" && filter=(--filter-not-trait Category=Integration --ignore-exit-code 8)
        dotnet test --no-build "${filter[@]}" || { echo "FAIL test"; exit 1; }
        echo "PASS gate"
    )
}

# --- check.sh helpers. check.sh <workdir> <rundir>: sets W and R, calls expect_* and ends with `finish`. ---
# Regexes are Perl-compatible (grep -P).

_fails=0

# added_cs <path-regex>: "file: line" for every line the agent added to a matching .cs file,
# committed or not.
added_cs() {
    git -C "$W" add -A >/dev/null
    git -C "$W" diff --cached baseline -U0 -- '*.cs' \
        | awk -v re="$1" '/^\+\+\+ /{f=substr($0,7); next} /^\+/ && f ~ re {print f": "substr($0,2)}'
}

# Production code only: anything under src/ that isn't a test project.
added_prod() { added_cs '^src/' | grep -vP '(^|/)[^/]*Tests/' || true; }
# Test code wherever it lives, so a misplaced tests/ folder is still graded as tests.
added_tests() { added_cs '(^|/)[^/]*Tests/' || true; }
# added_in <path-regex>: added .cs lines under a path, e.g. added_in '^src/[^/]*\.Domain/'.
added_in() { added_cs "$1" || true; }

# changed_files: every path changed since baseline, committed or not.
changed_files() { git -C "$W" add -A >/dev/null; git -C "$W" diff --cached --name-only baseline; }

expect_none() { # <name> <regex> [source fn, default added_prod] — no added line may match
    local hits; hits="$("${3:-added_prod}" | grep -P -- "$2" || true)"
    if [[ -z "$hits" ]]; then echo "PASS $1"; else echo "FAIL $1"; echo "$hits" | head -5 | sed 's/^/    /'; _fails=$((_fails+1)); fi
}

expect_some() { # <name> <regex> [source fn, default added_prod] — at least one added line must match
    if "${3:-added_prod}" | grep -qP -- "$2"; then echo "PASS $1"; else echo "FAIL $1 (no added line matches /$2/)"; _fails=$((_fails+1)); fi
}

expect() { # <name> <command...> — the command must succeed
    local name="$1"; shift
    if "$@"; then echo "PASS $name"; else echo "FAIL $name"; _fails=$((_fails+1)); fi
}

finish() { [[ $_fails -eq 0 ]]; exit $?; }

# --- transcript helpers over $R/transcript.jsonl (claude -p stream-json) ---

_tool_uses() { jq -c 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use")' "${R}/transcript.jsonl" 2>/dev/null; }
bash_cmds() { _tool_uses | jq -r 'select(.name=="Bash") | .input.command'; }
final_text() { jq -r 'select(.type=="result") | .result // empty' "${R}/transcript.jsonl" 2>/dev/null; }
skills_fired() { _tool_uses | jq -r 'select(.name=="Skill") | .input.skill // .input.command // empty' | sort -u | paste -sd'|' -; }

# verified_after_edit: 1 if `dotnet build`/`dotnet test` ran after the last file edit, 0 if not, empty if nothing was edited.
verified_after_edit() {
    _tool_uses | jq -rs '
        def verify: .name == "Bash" and (.input.command | test("dotnet\\s+(build|test)"));
        # Shell writes (heredoc redirects, sed -i, tee) count as edits too.
        def edit: (.name | IN("Edit","Write","MultiEdit","NotebookEdit"))
            or (.name == "Bash" and (verify | not) and (.input.command | test(">\\s*[^&\\s]|\\bsed\\s+-i|\\btee\\b")));
        (to_entries | map(select(.value | edit)) | last | .key) as $edit
        | if $edit == null then "" else
            (to_entries | map(select(.key > $edit and (.value | verify))) | if length > 0 then 1 else 0 end)
          end'
}

expect_cmd() { # <name> <regex> — some Bash command the agent ran must match
    if bash_cmds | grep -qP -- "$2"; then echo "PASS $1"; else echo "FAIL $1 (no command matches /$2/)"; _fails=$((_fails+1)); fi
}
