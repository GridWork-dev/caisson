# ADR-0253 — build-state.md rework: generated per-package counts + a 7th sot count-parity check + banner squash

**Status:** accepted · 2026-07-06 (Kickoff-E picker round 2, independent-build-wave session).
Closes the trigger named by open audit-ledger findings `3aa54d29` / `0d5291a4` / `f5d1a436`
(agent-dev test count · ai-evals coverage · ai-meter file/LOC — all accepted-stale with this
rework as their fix). Extends the SOT-expansion doc set (PR #126) and the `bun run sot` advisory
tool. Append-only; supersede with a later ADR, never edit. **Tags:** none (docs + tooling).

## Decision

1. **The per-package `src / tests / loc` counts in `docs/build-state.md` become
   machine-regenerated.** A 7th check in `tooling/scripts/sot-check.ts` —
   `checkPackageCountParity` — gathers disk truth per `packages/*` / `apps/*` / `services/*`
   (non-test source files, test files, LOC), diffs the doc's table cells, flags `stale`, and
   emits `EditSuggestion`s under `--update`, following the file's existing
   gather/check/suggestion shape (the ADR-ceiling-parity check is the template). Research found
   the 3 ledger findings are the tip: 9 more rows were stale on spot-check (ai-kit ~4× off),
   because every hand-typed count drifts on the next package touch — the fix is the mechanism,
   not the cells.
2. **The stacked banner timeline is squashed**: the 24 accreting `> **…**` blockquote banners
   collapse into one "Current state" section + a compact one-line-per-wave changelog. This also
   stops the line-number rot that invalidated the ledger's own `:396/:404` citations.
3. **Prose stays hand-written.** The "Owns"/"Reality"/"Honest gaps" narrative is judgment, not
   automation — no generation there. Rejected: banner-squash-only (provably does not fix the
   drift mechanism the 3 findings named); generated-counts-without-squash (keeps the rot).

## Consequences

- All count cells refresh off disk truth in the rework itself; the prose correction under
  "Honest gaps" item 4 (patching stale table numbers in prose) is retired — the table is the
  truth again.
- `docs/build-state.md` gains the house frontmatter and enters `bun run sot` coverage; a green
  sot run now asserts count parity, so the ledger's 3 accepted findings close with a structural
  guarantee, not a one-time fix.
