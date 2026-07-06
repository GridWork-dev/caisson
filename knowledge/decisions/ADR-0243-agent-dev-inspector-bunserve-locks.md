# ADR-0243 — Agentic-Dev inspector: Bun.serve shell (Fork A = A1) + `LocalStore.list()` (Fork B = B1); build queued

**Status:** accepted · 2026-07-05 (Kickoff-A picker round, SOT-expansion session). Locks the two
operator forks of `outputs/specs/deferred-respec/SPEC-agent-dev-inspector.md` so the build is
lock-and-go. **Narrowly supersedes ADR-0044** for this one surface (see Decision 1 — the
supersession ADR-0044 §Binding requires for a non-Next edition web surface). Realizes read-only
consumption of ADR-0186 (agent-runner); respects ADR-0073 (fail-closed `tenantDbPath`). The SPEC's
former "keep deferred" stance is retired: it predated **ADR-0237 rider 2** (FULL V1-live posture —
the Agentic-Dev labeled-roadmap exception is gone), so the "GA promotion" trigger is read as fired.
Append-only; supersede with a later ADR, never edit. **Tags:** none at lock (docs-only); the build
session carries the SPEC's own `security` tag (localhost bind + tenant boundary audit at SHIP).

## Decision

1. **Fork A = A1 — `Bun.serve` localhost script** (`apps/agent-dev/src/inspector.ts`), not a
   Next.js route group. Zero new dependencies; matches the plain Bun/tsc shape `apps/agent-dev`
   already is. **This clause is the ADR-0044-superseding record**: ADR-0044's "edition reference
   apps + web surfaces scaffold on Next.js App Router" stays binding everywhere else; this one
   deviation is authorized because the surface is localhost-only (`127.0.0.1` bind, SPEC-forbidden
   otherwise), read-only, non-sellable, and never a deployed artifact. A2 (Next route group) was
   rejected: it would add `next` as the edition's first framework dependency purely for a deferred
   dev tool, with no buyer template app to host the route group.
2. **Fork B = B1 — additive `LocalStore.list({ limit, offset })`** on
   `packages/local-store/src/store.ts` (`SELECT doc_id, text FROM docs ORDER BY rowid DESC`,
   clamped limit). Keeps the SQL inside the package that owns the schema; ships through the
   standards gate with a patch changeset (`@caisson/local-store` is Apache-2.0 base). B2 (direct
   `SELECT` from the app) was rejected: it couples the app to the store's internal schema and
   breaks silently on drift.
3. **Build is QUEUED, not authorized for the SOT-expansion session** (docs-tree kickoff). The
   next code-tree session that picks it up executes the SPEC's Tasks 1–7 as written, with both
   forks resolved by this ADR (Task 7's lock-ADR requirement is satisfied here — the build files
   no second ADR).

## Consequences

- `apps/agent-dev/README.md` + `src/index.ts` module-header "optional Next.js inspector" framing
  is corrected to cite this ADR at build time (SPEC Task 5), including the ADR-0044 deviation note.
- The two backlog lines mis-citing "ADR-0082 §4" as the deferral record get corrected at build
  time (SPEC Task 6).
- The inspector renders **no** guardrail/spend/tool-exec-history columns — the edition produces
  none of that data; wiring those packages remains separate ADR-worthy work.
