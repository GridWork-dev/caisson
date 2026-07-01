# AGENTS — @caisson/audit-harness

Agent-facing authoring/usage contract (ADR-0134). What a generation agent or a downstream
integration must know to use the harness correctly.

## Invariants (do not violate)

- **Non-blocking, always.** Nothing in this package throws to gate a commit or CI job. The CLI
  (`src/cli.ts`) always exits 0. `validateHighRisk` never rejects — every challenger failure mode
  (throw, reject, `null`) collapses to a killed/refuted finding, never a propagated exception.
- **Stable id is derived, never hand-assigned.** `id = sha256(domain ∷ subject ∷
normalized-title)[:16]` via `stableId()`/`withId()`. Never construct a `Finding.id` by hand — a
  reworded title with the same `stableId()` inputs must stay the same finding.
- **`reconcile()` is pure — no IO.** It takes the previous ledger + fresh raw findings and returns
  the merged ledger + per-id classes. Reading/writing `audit-ledger.toml` is the CLI's job, not
  `reconcile()`'s.
- **`majorityKills` defaults to killed.** A tie, a `null` verdict, or either pass returning
  `refuted: true` all kill the finding. Only `[{refuted:false}, {refuted:false}, ...]` (every
  verdict present and explicitly `refuted: false`) survives.
- **Only `severity: "high"` findings are `/validate`-eligible.** Routine `info`/`warn` findings are
  unaffected by the escalation spine — don't wire `validateHighRisk` into the reconcile path itself.
- **This package does not touch `tooling/design-critic`.** It is a standalone, generalized copy —
  never import from or mutate `design-critic`'s ledger/module. Adopting the harness in place of
  `design-critic` is a separate, future integration (ADR-0134 Downstream), not implied here.

## Wiring the real `Challenger`

The port is one method: `challenge(finding: Finding): Promise<{refuted: boolean} | null>`. The
production driver is **PAL `challenge` → OpenRouter** (per the GridWork operator-level cross-vendor
convention) — wire it in the calling CLI/skill, not inside this package. Tests use a fake
`Challenger` (see `src/validate.test.ts`) so the suite never makes a live call.

## Out of scope (this package)

No checker implementations (the `checkers` field in `AUDIT_DOMAINS` is a name, not code). No
scheduling/CI wiring for the scope guard. No registry `manifest.ts` — this is internal, unsold
tooling (`package.json` is already `"private": true`).
