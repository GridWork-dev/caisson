## docs/build-state.md rework — research brief

### 1. What build-state.md currently is

**Structure** (573 lines, frontmatter `updated: 2026-07-05` / `status: live`, no `grounds:` key):

- **Lines 1–~316: a stacked, append-only banner timeline.** 24 `> **…**` blockquote banners (`docs/build-state.md:8-315`), each a dated snapshot ("CURRENT STATE (2026-07-05)", "PRIOR STATE (2026-07-03)", "EXECUTION WAVE + DEPLOY BLOCK DONE (2026-07-02-LATE)", …) stacked newest-first, each ending "Historical banners below are a timeline, not current state." Nothing is ever deleted — every session's wrap prepends a new banner. This is the same pattern the SoT-hierarchy in CLAUDE.md itself uses ("Cadence" section), just longer-lived here.
- **Lines 317–357: static reference tables** — status legend, phase status P0–P7.
- **Lines 358–459: "Per-package reality check"** — 6 markdown tables (`src / tests / loc` triples) across base+foundations, Wave-0 substrate, Stage-2 new packages, Stream C/D hardening, edition packages, apps+services. **This is the one section with hand-typed counts that drift.**
- **Lines 460–509: "Honest gaps"** — a numbered list, and item 4 (`docs/build-state.md:487-506`) is itself a **prose correction of stale table numbers** for `ai-config`/`ai-kit`/`ai-evals` written after the table rows above went stale — i.e. the doc already has a precedent of "prose patches the table without editing the table."
- **Lines 510–561: "What's genuinely next."**
- **Lines 562–573: routing pointers to other docs (no duplication).**

**Staleness beyond the 3 known ledger ids** — spot-checked 9 more table rows against disk truth (`packages/<pkg>/src`, non-test `.ts` files / test files / LOC):

| Package                              | Table claims (src/test/loc) | Disk truth       | Drift                                                                                                                          |
| ------------------------------------ | --------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `field-crypto`                       | 13/9/1319                   | 15/11/2868       | stale (~2x LOC)                                                                                                                |
| `compliance`                         | 16/11/2871                  | 26/21/4721       | stale (~1.6x LOC, +10 src files)                                                                                               |
| `local-ai`                           | 14/9/2209                   | 18/13/3063       | stale                                                                                                                          |
| `audit-worm`                         | 7/6/1302                    | 8/7/1646         | stale                                                                                                                          |
| `guardrails`                         | 4/2/520                     | 6/4/882          | stale                                                                                                                          |
| `ai-kit`                             | 3/2/358                     | 7/7/1424         | **badly stale** — but the correct number (1,424 LOC/7 files/92 tests) is already sitting in prose 90 lines below at `:495-500` |
| `local-store`                        | 8/7/1043                    | 8/7/1001         | minor                                                                                                                          |
| `agent-kernel`                       | 8/7/1101                    | 9/8/1148         | minor                                                                                                                          |
| `license-verify` / `prompt-registry` | 4/2/272, 4/2/582            | 4/2/301, 4/2/603 | minor                                                                                                                          |

So the "3 known ids" are the tip of a much broader problem: **every hand-typed count in the per-package tables drifts as soon as a package gets touched**, and the doc's own fix mechanism (append a prose correction under "Honest gaps" rather than edit the table) compounds the drift rather than resolving it.

### 2. The 3 staleness facts — claimed vs fresh disk-truth

Computation commands (all read-only, run from repo root; git status confirmed **zero uncommitted churn** in `packages/agent-dev` or `apps/agent-dev` — committed state = current disk state, no need to special-case the concurrent inspector build):

```bash
# ai-evals
find packages/ai-evals/src -name "*.ts" ! -name "*.test.ts" | wc -l        # → 12 src files
find packages/ai-evals/src -name "*.ts" ! -name "*.test.ts" -exec wc -l {} + | tail -1   # → 1323 src LOC
find packages/ai-evals/src -name "*.test.ts" | wc -l                       # → 7 test files
grep -rEc "^\s*(test|it)\(" packages/ai-evals/src --include=*.test.ts | awk -F: '{s+=$2} END{print s}'  # → 79 test() blocks

# ai-meter
find packages/ai-meter/src -name "*.ts" ! -name "*.test.ts" -exec wc -l {} +   # → 7 files / 1339 src LOC
find packages/ai-meter/src -name "*.test.ts" | wc -l                          # → 4 test files
grep -rEc "^\s*(test|it)\(" packages/ai-meter/src --include=*.test.ts         # → 49 test() blocks total

# agent-dev
git status --porcelain packages/agent-dev apps/agent-dev   # → empty (clean, safe to use disk truth)
find packages/agent-dev/src -name "*.ts" ! -name "*.test.ts" -exec wc -l {} +  # → 7 files / 890 src LOC
find packages/agent-dev/src -name "*.test.ts" | wc -l                          # → 6 test files
grep -rEc "^\s*(test|it)\(" packages/agent-dev/src --include=*.test.ts        # → 27 test() blocks total
```

| Finding id         | Package   | Doc claim (`build-state.md`)                                                                        | Fresh disk truth                                                                    | Verdict                                                                                                                                                |
| ------------------ | --------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0d5291a4f6b0edd2` | ai-evals  | table row: `6 / 1 / 800`, "thin test coverage (1 file)" (originally at :397, now shifted to `:433`) | **12 src files / 1323 src LOC / 7 test files / 79 test() blocks** (1014 test LOC)   | confirmed 6x-plus understated on test-file count; the doc's own "Honest gaps" §4 (`:501-506`) already states the correct 79/7/1323 figures in prose    |
| `3aa54d2918b1a7e2` | agent-dev | table row: `7 / 3 / 761` (originally `:404`, now `:440`)                                            | src count matches (7/761 ✓) but **test files 6, not 3** — 27 `test()`/`it()` blocks | test-file count doubled since the row was written (tool-exec-wiring + tenant-isolation + content tests added)                                          |
| `f5d1a436c274c942` | ai-meter  | table row: `6 / 3 / 957` (originally `:396`, now `:432`)                                            | **7 src files / 1339 src LOC / 4 test files** (49 test() blocks, 1235 test LOC)     | file count +1, LOC +40%, test files +1 — stale relative to the shipped `dedup.ts` MinHash/LSH module (matches the doc's own prose mention at `:85-90`) |

Note: the ledger's cited subject line numbers (`:396/397/404`) no longer match current content — banner insertions above the table have shifted everything down by ~35 lines since the ledger entries were filed. That's itself a symptom of stacked-timeline-above-static-table structure: **line-number references into this doc rot on every banner append**, independent of the count drift.

### 3. The shape fork

**(a) Collapse the stacked timeline into frontmatter-dated per-section form**

Keep the doc's current two-part shape (narrative history + reference tables) but replace the 24 accreting blockquote banners with one "Current state" section carrying `updated:` in its own local dateline, and fold prior banners into a compact changelog list (one line per wave, not a paragraph). The per-package tables are left exactly as-is — hand-typed.

- Effort: **low** (a day; mechanical squash of banners, no new tooling).
- Drift-resistance: **none for the count problem** — the table cells are still hand-typed prose, so the ai-evals/ai-meter/agent-dev class of drift recurs on the very next package touch. It only fixes the _narrative bloat_ (573→~350 lines) and the line-number-rot symptom (fewer things above the table to shift line numbers).
- Sot-checkable grounds relationship: **no** — nothing here is machine-derivable; `grounds:` freshness (check #2) would only assert the doc's `updated:` date is ≥ the last commit touching e.g. `packages/ai-meter/`, which catches "doc wasn't touched since the package changed" but not "the doc was touched and the count is still wrong." Cheap to add, weak guarantee.

**(b) Full rewrite: generated-table (machine-refreshable counts) + prose split**

Split the doc in two: a short hand-written prose file (what each package _does_, edition membership, "honest gaps" narrative — this is the part that needs judgment and won't yield to automation) plus a **generated** counts table (src files / test files / src LOC / test LOC / test-block count) produced by a small script reading `packages/*/src` + `apps/*` + `services/*` directly, run via a `bun run build-state:counts` (or folded into `sot-check.ts` as a 7th check).

- Effort: **medium** (half-day–day: one glob+wc+regex script per the `ai-meter`/`ai-evals` commands above, generalized over all package dirs; wire it as a generated markdown fragment `docs/build-state.counts.md` included/pasted into the doc, or embedded between HTML-comment markers the script rewrites in place).
- Drift-resistance: **high** — the count cell can never go stale because it's regenerated from `find`+`wc`+`grep` every time the script runs; a CI/pre-commit/`bun run sot` invocation makes drift structurally impossible for the _count_ columns. The prose "Owns"/"Reality" columns still drift (that's inherent — no tool can auto-summarize "what changed" faithfully), but that's a much smaller, lower-stakes surface than raw counts.
- Sot-checkable grounds relationship: **yes, and cheaply, given `sot-check.ts`'s existing shape.** Check #1 (`checkAdrCeilingParity`, `tooling/scripts/sot-check.ts:181`) is the exact template: gather N candidate values from N sources, assert they agree, flag `drift` + emit an `EditSuggestion` (file/line/new-value) via `--update`. A `checkPackageCountParity` would: (1) regex-extract the `N / M / L` cell per package row from `docs/build-state.md` (same `lineNumberAt`-style helper already in the file, `tooling/scripts/sot-check.ts:38`), (2) compute fresh disk truth via `find`+`wc` per package dir (pure function over a `readdirSync`-gathered file list, mirroring the impure-gatherer/pure-checker split the file already enforces throughout), (3) diff, report `stale` cells as `EditSuggestion{file: "docs/build-state.md", line, suggestion: "N / M / L"}`. This is a same-shaped, same-effort addition to the existing 6-check file — no new architecture needed, just a 7th `gather*`/`check*` pair following the file's own pattern.

**Recommendation: (b), scoped down** — do the generated-counts split, but _don't_ also try to templatize the "Reality"/"Owns"/"Honest gaps" prose; that's genuinely narrative and machine generation there would produce worse writing than a human. Confidence: **high** — (a) provably does not fix the actual 3 accepted findings (their root cause is "hand-typed count, no regeneration"), while (b)'s generated-table piece is a near-zero-marginal-cost addition given `sot-check.ts` already has the exact gather/check/suggest scaffold built and proven (ADR ceiling parity, frontmatter freshness). The narrative-timeline bloat (24 banners) is a real but separate problem — worth a light (a)-style banner-squash in the same pass, but it's cosmetic, not a drift-correctness fix.

### 4. The house frontmatter convention (sampled)

`docs/state/outstanding-work.md:1-8`, `docs/deploy/STATE.md:1-8`, `docs/state/decisions-and-forks.md:1-6`, `docs/state/opportunity-backlog.md:1-4`:

```yaml
---
updated: 2026-07-05
status: live # or: archived
grounds: # optional — omit = "not checked" (sot-check.ts:265-266)
  - docs/build-state.md
  - docs/state/launch-runbook.md
adr_ceiling: 0250 # optional, only on decisions-and-forks.md
---
```

Enforced by `checkDocFreshness` (`tooling/scripts/sot-check.ts:267-300`): parse the tolerant house frontmatter (`parseFrontmatter`, no YAML dep, `:63-...`), and for every `grounds:` path assert its last-commit date ≤ the doc's `updated:` date — else flag `stale`; a `grounds:` path that no longer exists flags `dead-pointer`. **`build-state.md`'s own frontmatter (`:1-4`) has `updated`/`status` but no `grounds:` list — it is currently outside check #2's coverage entirely** ("missing grounds key = not checked"). Adding a `grounds:` list (its own package dirs, or nothing sensible since it grounds on ~50 package trees) wouldn't help much here anyway — freshness (was the doc touched after the code) is a weaker guarantee than count-parity (is the printed number right), which is why fork (b)'s generated-table check is the higher-leverage add over just wiring up `grounds:`.

### 5. Recommendation

Ship fork **(b)**: extract the per-package `src/tests/loc` table generation into a `checkPackageCountParity` 7th check in `tooling/scripts/sot-check.ts` (same gather/check/edit-suggestion shape as the ADR-ceiling check), point it at all `packages/*`, `apps/*`, `services/*` dirs, and let `--update` emit the corrected cell values. Do a lightweight banner squash (fork a's mechanical part) in the same PR since it's nearly free once you're editing the file, but don't invest further in (a) as a standalone fix — it doesn't touch the actual drift mechanism the 3 accepted findings named. Confidence: high.
