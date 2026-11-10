# ORIGIN — Reason2

Independent GitHub repo. Copied from Reason, then extended. Does **not** require the Reason package at runtime.

## Vendored (written into this tree)

| File | Role |
|------|------|
| `src/population.js` | Organon population helpers |
| `src/baseline/*` | Classic five-slot defaults |

## From Reason (kept / evolved)

Claim loop, select, mutate, arm, ledger paths, standalone harness.

## New in Reason2

| File | Role |
|------|------|
| `src/claim/diff.js` | Diff themes |
| `src/claim/locus.js` | Locus plan/refine |
| `src/claim/config.js` | Persistable knobs |
| `src/claim/gate.js` | Tip holdout promote/reject |
| `bin/ab-compare.js` | Same-B A/B |
| `bin/replay-event.js` | Event replay |
| R± decay / caps in `ledger.js` | Anti-bloat |
