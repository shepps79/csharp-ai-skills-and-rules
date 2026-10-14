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

# gate <workdir>: build (warnings as errors), format, unit tests, and compiler config untouched.
gate() {
    local w="$1"
    (
        cd "$w" || exit 1
        git diff --quiet baseline -- .editorconfig Directory.Build.props global.json \
            || { echo "FAIL compiler config modified"; exit 1; }
        dotnet build -warnaserror -v q -nologo || { echo "FAIL build"; exit 1; }
        dotnet format --verify-no-changes --no-restore || { echo "FAIL format"; exit 1; }
        dotnet test --no-build --filter-not-trait Category=Integration || { echo "FAIL test"; exit 1; }
        echo "PASS gate"
    )
}

# --- check.sh helpers. A check script sets W (workdir), calls expect_* and ends with `finish`. ---

_fails=0

# added_cs <path-regex>: "file: line" for every line the agent added to a matching .cs file,
# committed or not.
added_cs() {
    git -C "$W" add -A >/dev/null
    git -C "$W" diff --cached baseline -U0 -- '*.cs' \
        | awk -v re="$1" '/^\+\+\+ /{f=substr($0,7); next} /^\+/ && f ~ re {print f": "substr($0,2)}'
}

# Production code only: anything under src/ that isn't a test project.
added_prod() { added_cs '^src/' | grep -v '^src/[^/]*Tests/' || true; }

expect_none() { # <name> <regex> — no added production line may match
    local hits; hits="$(added_prod | grep -E -- "$2" || true)"
    if [[ -z "$hits" ]]; then echo "PASS $1"; else echo "FAIL $1"; echo "$hits" | head -5 | sed 's/^/    /'; _fails=$((_fails+1)); fi
}

expect_some() { # <name> <regex> — at least one added production line must match
    if added_prod | grep -qE -- "$2"; then echo "PASS $1"; else echo "FAIL $1 (no added line matches /$2/)"; _fails=$((_fails+1)); fi
}

expect() { # <name> <command...> — the command must succeed
    local name="$1"; shift
    if "$@"; then echo "PASS $name"; else echo "FAIL $name"; _fails=$((_fails+1)); fi
}

finish() { [[ $_fails -eq 0 ]]; exit $?; }
