# KICKOFF — queued-engineering close (CAISSON-191 + CAISSON-176 + dts-drift + tracker truth)

**Lane:** solo worktree `/home/gw/lab/caisson-wt-eng`, branch `fix/queued-eng-close` (cut from
`main` @ `45707a1a`). One PR (ADR-0328 wave convention), conventional commits, atomic per item.
**Open the PR and leave it unmerged — the coordinator session merges on green.** Linear:
CAISSON-191 + CAISSON-176 move In Progress → In Review at PR-open.

Grill-locked ship rule (operator, 2026-08-09): **the PR opens only with everything green. If the
guardrails wiring stalls, CAISSON-176 is PULLED from the PR and re-preserved as WIP on its own
branch — a PR with red tests never opens.**

## Item 1 — CAISSON-191: deploy-worker.yml dies silently (small, do first)

Two failed dispatch runs 2026-08-09 (31340131203, 31340167627) while the identical tree deployed
cleanly by hand (`registry/worker/deploy.sh` → Worker `b5a09cc0`, parity OK).

1. **Loud capture** in `registry/worker/deploy.sh`: the failure mode is
   `deploy_out="$(bunx wrangler deploy 2>&1)"` under `set -euo pipefail` — on failure the
   assignment aborts the script and the captured output is never printed. Replace with
   print-before-exit (`if ! deploy_out=$(…); then printf '%s\n' "$deploy_out"; exit 1; fi`) or
   drop the capture for `tee`. Same treatment for any sibling capture in the script.
2. **Pin the bunx resolution** in `.github/workflows/deploy-worker.yml`: the 35ms death after
   "Tasks: 5 successful" smells like shim resolution — `wrangler@4.106.0` is a devDependency of
   the `registry` workspace and its shim lands at `registry/node_modules/.bin/wrangler`, NOT
   hoisted to root. Add a debug step (`bunx wrangler --version` from `registry/worker`) to a
   test dispatch, then pin whatever differs (e.g. call `registry/node_modules/.bin/wrangler`
   directly).
3. **Validate the `ref` input**: a bare sha is not a valid `actions/checkout` ref (branch/tag
   only; blank = main) — run 31340131203 died there and the failure was easy to misread. Reject
   bare shas with a clear error early in the workflow.

Proof: a dispatch of `deploy-worker.yml` (blank ref = main) goes green end-to-end OR fails LOUDLY
with wrangler's actual output visible in the log. A real deploy off main is fine — the Worker is
already at main's index; redeploying same-bytes is a no-op with a receipt. Full issue text:
CAISSON-191.

## Item 2 — CAISSON-176: guardrails DoS hardening, finish the wiring (medium)

Seed WIP exists: commit `d7089924` on `origin/fix/guardrails-dos-hardening` — helpers implemented
GREEN (bounded work ceilings, ReDoS screen, strict moderator-verdict parser, bounded PII
substitution; +643/−13 across 11 files in `packages/guardrails/src/`), but the guard-core /
guard-browser CALL-SITE WIRING is not done — **9 tests red by design on that branch.**

- **Cherry-pick ONLY `d7089924`** onto this branch. Do NOT rebase or merge the seed branch — it
  is 17 commits behind main and its other 5 commits are stale Wave-B-era work already re-landed
  via #402. Expect conflicts with #402's `./browser` entries; resolve toward main's structure.
- Finish the wiring: guard-core + guard-browser call sites adopt the bounded helpers (5s DoS
  ceiling + the verdict-swallowing sink named in the issue title). The 9 red tests define done.
- Full package green: `bun test packages/guardrails` + typecheck. Guardrails is a sold
  commercial package — changeset required (minor or patch per the actual surface change; prose
  without ADR citations).
- After this lands, the coordinator deletes `origin/fix/guardrails-dos-hardening` at wrap —
  note in the PR body that the seed branch is fully consumed.

## Item 3 — dts-drift: emit harness, then re-land fail-closed (medium)

Lane A's fail-closed flip (reverted at reconcile, 2026-08-09) was red-by-construction: in a fresh
checkout, `ui`, `ui-pro`, `verify-pack`, and `access-review` cannot emit `.d.ts` because their
workspace deps' declarations don't exist unbuilt — so fail-closed dies on harness incapability,
not real drift.

- Give the harness the capability first: a dependency build step (scoped `turbo run build` for
  the drift set's workspace deps — or tsc project references if cheaper) in BOTH the local
  script path (`tooling/scripts/dts-drift-check.ts`) and the workflow
  (`.github/workflows/tsc-native-dts-drift.yml`, which runs the script at line ~94).
- THEN re-land the fail-closed semantics (lane A's shape is in PR #412's reverted diff — recover
  with `git log --all -- tooling/scripts/dts-drift-check.ts`): emit failure = FAIL, not skip.
- Proof: `bun tooling/scripts/dts-drift-check.ts` exits 0 from a clean checkout with zero
  skips on those 4 packages; the script's own test
  (`tooling/scripts/dts-drift-check.test.ts`) updated to pin fail-closed.
- If the harness turns out to need >~an hour of yak-shaving (e.g. build graph surprises), STOP,
  keep main's skip-tolerant gate, and report — do not land a flaky gate. (Fail-closed CI flips
  need harness capability first — this exact class burned lane A.)

## Item 4 — tracker truth sweep (small, last)

- `docs/state/outstanding-work.md` "Open after the v2026.07.30 train": the poke-mirror paragraph
  ("~15 other `*-logic.ts` mirrors remain…") is STALE — zero `*-logic.ts` files exist under
  `apps/` (verified 2026-08-09; retirement completed via #394/#396/#402, 27/28 pokes import
  `@caisson/*` directly, the 28th is the registry lookup table). Rewrite the bullet to record
  completion, or move it to Recently closed per the file's conventions.
- While in there: correct any other line this lane's items falsify (e.g. if item 3 lands, the
  dts-drift follow-up sentence in the 2026-08-09 Recently-closed row gets a completion note —
  amend by appending, never rewrite history rows' meaning).

## Verification (whole lane, before PR)

```sh
bun install
bun test packages/guardrails                    # item 2 done-check
bun tooling/scripts/dts-drift-check.ts          # item 3 done-check (exit 0, no skips on the 4)
bunx turbo run typecheck test build --continue=never
bun run sot                                     # BEFORE the PR (project memory)
```

Gotchas under load (project memory): PGlite suites flake under parallel load — confirm red with
`--concurrency=1`; bun's 5s per-package test timeout is the flake class. Prettier runs pre-commit —
run `bunx prettier --write` on touched docs before committing.

## Hard don'ts

- No red-test PR (grill rule above). No scope creep past the four items.
- No registry `ledger.jsonl` writes, no tags, no deploys (the CAISSON-191 proof dispatch deploys
  same-bytes off main — that specific act is sanctioned; nothing else).
- No force-push; the seed branch is read-only input.

## Addendum (coordinator, post-launch) — item 2 detail

CAISSON-176's Linear description carries the authoritative red-test inventory — read it in
full. The 9 unwired sites, verbatim: `assertBoundedGuardText` at guardInput/guardOutput entry
(the measured 4.4–5.0s / 100KB DoS) · `parseModerationResult` around `Moderator.moderate()`
returns · `assertSafeModeratorRegexes` on `policy.cheapDeny` · the tenant-mismatch ConfigError
check before moderation and any sink.emit · `emitBlock` currently swallowing a throwing sink's
GuardrailError (telemetry masking a security verdict — the top-ranked item) · the abandoned
browser `guardOutput` split (finish the BrowserGuardPolicy overload or revert the
browser-safety subset edit). Changeset: minor (new public exports + new RangeError behavior).
Convention: guardrails is a fail-closed security seam → the SHIP audit before the PR opens runs
the security-audit lane (fable-grade), not just code review. Full inventory:
`outputs/audit/STATUS-caisson-2026-08-06.md` Phase 2.
