# SPEC — `@caisson/audit-harness` pipeline completion + audit driver

**Status: DRAFT — awaiting operator lock (proposed ADR-0188, amends ADR-0134).** No code lands until locked (ADR-0133 §4).

- **Slice:** LIFT slice 1 (build-now; serves the parallel whole-repo audit phase).
- **Target:** internal `@caisson/audit-harness` (private, unsold) + a Caisson-local audit skill.
- **Type:** internal hardening + enablement. **Not** a registry module.
- **Tags:** `ai` `security`.

## Goal (WHAT + WHY)

`@caisson/audit-harness` was built + unit-tested (Stream B, ADR-0150/0134) but **never run
against the real repo** — it is a pure reconciliation/escalation library whose producer
half doesn't exist, and it carries **one correctness bug that will silently corrupt any
real run.** The operator wants a whole-repo multi-model audit driven by this harness. This
SPEC (a) fixes the must-fix bug, (b) adds the small in-package enablers, and (c) wires the
external dispatcher + Challenger driver + orchestration skill that AGENTS.md explicitly
deferred outside the package. This unblocks the parallel audit phase.

## Scope

**Package fixes (in `packages/audit-harness`, correctness — small):**

- **MUST-FIX:** `reconcile(previous, current, scope)` — add a `scope: string[]` (domains
  actually audited this run); only findings whose `domain ∈ scope` are eligible for the
  new/closed transition. Everything out of scope passes through unchanged. Today a
  domain-by-domain run silently marks every open finding in _unaudited_ domains as fixed.
  Update `cli.ts` to require `--domains`; update tests.
- `enumerateSurface(domain, root?)` — resolve `AuditDomain.globs` to a real file list
  (reuse the `Bun.Glob` already in `scope-guard.ts`).
- `selectValidateCandidates(ledger)` — `severity==="high" && status==="open"` filter.
- `checkScope` CLI subcommand (declared domains + `git diff --name-only` → findings JSON).
- `summarize(ledger)` + report CLI subcommand (counts by domain × severity × status; list
  open-high) for post-run legibility.

**New layer (OUTSIDE the package — AGENTS.md boundary: belongs in a skill/script):**

- A default PAL-`challenge`-backed `Challenger` adapter wiring `mcp__pal__challenge` →
  the `Challenger` port, so `validateHighRisk` has a real driver.
- A dispatcher: per `AUDIT_DOMAINS` entry, enumerate surface → fan out to the domain's
  checker(s) (agent dispatch for `gw-security-auditor`; shell/CLI for `standards-gate` /
  `tooling/design-critic`) → normalize to `RawFinding[]`.
- A whole-repo audit orchestration skill: enumerate → dispatch → normalize → `reconcile()`
  with correct `scope` → `/validate` over open-high → emit report + write ledger.

**Out (defer to slice 2):** producer-side de-dup/corroboration merge across models
(rank #6 in the recon); sub-domain chunking schema.

## Forks (operator must lock — see SLICE-PLAN.md F4)

- **F4a** reconcile scope API: explicit required `--domains` vs infer from `current`'s
  distinct domains. **Rec:** explicit required `--domains` (fail-loud; inference silently
  under-scopes if a domain produced zero findings this run).
- **F4b** Dispatcher/Challenger home: in-package vs external skill/script. **Rec:**
  external (honor ADR-0134 "no checker implementations in-package" + AGENTS.md boundary) —
  package stays a pure library; the skill owns model calls + dispatch.

## Tasks (for PLAN)

1. `reconcile()` scope param + `cli.ts --domains` + updated tests (the must-fix, first).
2. `enumerateSurface` + `selectValidateCandidates` + tests.
3. `checkScope` + report CLI subcommands + tests.
4. External PAL-`challenge` `Challenger` adapter (skill script).
5. Dispatcher + orchestration skill under `claude/playbooks/manual/` (or Caisson-local).
6. Dry-run against the real repo (one domain) → verify no cross-domain false-close.

## Verify (goal-backward)

- Scope test: a single-domain `current` fed to `reconcile()` leaves other domains'
  open findings untouched (the bug is gone) — **must pass**.
- `validateHighRisk` runs the PAL challenger twice, defaults-to-refuted on tie/throw.
- A real one-domain dry run produces a legible report + a valid ledger round-trip.
- `bun run check` green.

## Effort: S (package fixes) + M (external driver/skill). Value: HIGH (unblocks audit phase).
