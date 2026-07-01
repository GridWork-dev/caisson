# ADR-0188 — audit-harness pipeline completion: scoped reconcile + external audit driver

**Status:** accepted · 2026-07-01 (LIFT slice-1 kickoff, operator-locked fork F4) · **amends ADR-0134**
(cross-domain audit/validate harness), relates **ADR-0150** (Stream-B scaffold), the AGENTS.md
"no checker implementations in-package" boundary, and the repo Bun-runtime invariant (ADR-0002).
Append-only; supersede with a later ADR, never edit. **Tags:** `ai`, `security`.

## Context

`@caisson/audit-harness` was built + unit-tested in Stream B (ADR-0150/0134) but **never run against the
real repo** — it is a pure reconciliation/escalation library whose producer half doesn't exist, and it
carries **one must-fix correctness bug**: `reconcile(previous, current)` marks EVERY previously-open
finding not present in `current` as `fixed`. A real audit runs domain-by-domain (security, rls-tenancy,
design-ui, …), so any single-domain run silently false-closes every open finding in the domains it did
NOT audit this run. The operator wants a whole-repo multi-model audit driven by this harness, which
requires the bug fixed, small in-package enablers, and the external dispatcher/Challenger the package
deliberately does not own.

## Decision

**F4a — reconcile scope is an explicit required argument (fail-loud), not inferred.**
`reconcile(previous, current, scope)` takes `scope: readonly string[]` = the domains actually audited
this run. Only a previous finding whose `domain ∈ scope` is eligible for the open→`fixed` (closed)
transition; every out-of-scope previous finding **passes through unchanged**. Scope is NOT inferred from
`current`'s distinct domains — inference silently under-scopes a domain that was audited but produced
zero findings (its stale findings would wrongly stay open). `cli.ts` requires `--domains`. A `current`
finding whose domain ∉ `scope` is a caller inconsistency and **throws** (fail-loud).

**F4b — the dispatcher + Challenger driver live OUTSIDE the package, in a Caisson-local skill.**
The package stays a pure library (ports only, no model calls, no dispatch, no checker implementations —
honoring ADR-0134 + the AGENTS.md boundary). The default PAL-`challenge`-backed `Challenger` adapter,
the per-domain dispatcher (enumerate surface → fan out to the domain's checkers → normalize to
`RawFinding[]`), and the whole-repo orchestration all live in a skill/script.

**In-package enablers (small, pure):** `enumerateSurface(domain, root?)` (resolve `AuditDomain.globs`
via the `Bun.Glob` already in `scope-guard.ts`), `selectValidateCandidates(ledger)`
(`severity==="high" && status==="open"`), a `checkScope` CLI subcommand, and `summarize(ledger)` + a
report subcommand for post-run legibility.

## Consequences

- The silent cross-domain false-close is gone; a domain-by-domain audit reconciles correctly against one
  ledger. This is a **correctness fix**, not a preference — every prior single-domain run would have
  corrupted the ledger.
- The harness stays a pure, unsold internal library; model calls + dispatch are a skill concern, so the
  open↔commercial + AGENTS.md boundaries hold.
- Callers of `reconcile()` MUST now pass `scope` — a breaking signature change, contained to `cli.ts` and
  the (not-yet-existing) skill; the package is private/unsold so there is no external consumer.
- Producer-side cross-model de-dup/corroboration merge + sub-domain chunking are explicitly **deferred to
  slice 2** (SLICE-PLAN.md).

<!-- ponytail: scope is the whole fix — out-of-scope previous findings pass through untouched; everything else is enabler wiring. -->
