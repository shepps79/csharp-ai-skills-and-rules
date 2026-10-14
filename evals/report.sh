#!/usr/bin/env bash
# Markdown summary of one or more results.csv files: pass rate per task x variant.
# A task passes for a variant when >= 80% of its reps pass gate + check (4/5, or 3/3).
# Usage: evals/report.sh evals/results/*/results.csv
exec python3 - "$@" <<'EOF'
import csv, sys
from collections import Counter, defaultdict

rows = [r for path in sys.argv[1:] for r in csv.DictReader(open(path))]
if not rows:
    sys.exit("no rows")
variants = sorted({r["variant"] for r in rows})
tasks = sorted({r["task"] for r in rows})
cell = defaultdict(list)
for r in rows:
    cell[r["task"], r["variant"]].append(r)

def verdict(rs):
    passed = sum(r["pass"] == "1" for r in rs)
    return f"{passed}/{len(rs)} {'✅' if passed >= 0.8 * len(rs) else '❌'}"

print("# Eval summary\n")
for v in variants:
    vr = [r for r in rows if r["variant"] == v]
    costs = [float(r["cost_usd"]) for r in vr if r["cost_usd"]]
    print(f"- `{v}`: model {vr[0]['model']}, effort {vr[0]['effort'] or 'default'}, "
          f"{len(vr)} runs, ${sum(costs):.2f} total")
kind = {r["task"]: r.get("kind") or "fixture" for r in rows}
for k, title in (("fixture", "Fixture tasks"), ("skeleton", "Skeleton (greenfield) tasks")):
    ks = [t for t in tasks if kind[t] == k]
    if not ks:
        continue
    print(f"\n## {title}\n")
    print("| Task | " + " | ".join(variants) + " |")
    print("|---|" + "---|" * len(variants))
    for t in ks:
        print(f"| {t} | " + " | ".join(verdict(cell[t, v]) if cell[t, v] else "—" for v in variants) + " |")

print("\n## Failed checks\n")
for t in tasks:
    for v in variants:
        counts = Counter(c for r in cell[t, v] for c in r["failed_checks"].split(";") if c)
        if counts:
            print(f"- {t} / `{v}`: " + "; ".join(f"{c} ×{n}" for c, n in counts.most_common()))
EOF
