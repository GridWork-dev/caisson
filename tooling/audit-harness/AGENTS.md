# AGENTS — @caisson-sh/audit-harness

Agent-facing authoring/usage contract (ADR-0134 · v2: ADR-0233). What a generation agent or a
downstream integration must know to use the harness correctly.

## Invariants (do not violate)

- **Non-blocking to a merge, always.** Nothing here gates a commit or CI job by design. The CLI
  (`src/cli.ts`) exits 0 on the advisory paths; `validateHighRisk` never rejects — every challenger
  failure mode (throw, reject, `null`) collapses to a killed/refuted finding. `reconcile()` DOES
  throw on caller inconsistency (out-of-scope domain, id collision, out-of-universe domain) and
  `deriveDomains()` throws on an unclassifiable tree unit — these are fail-loud consistency guards,
  not merge gates; a driver treats them as bugs to fix, not findings to ship.
- **Domains are DERIVED, never hand-listed (ADR-0233).** `deriveDomains(root)` emits one domain per
  tree unit (`packages/*`, `apps/*`, `services/*`, registry units, `tooling/*`, `infra/*`, workflows,
  generator templates, docs-content, scripts, the synthetic oss-mirror). `coverage-gate.test.ts`
  proves every tree unit maps to exactly one domain — an unclaimed dir fails the gate. Never
  re-introduce a hand-typed `AUDIT_DOMAINS` list; that was the v1 under-scan.
- **Stable id is derived + dimension-keyed, never hand-assigned.** `id = sha256(domain ∷ dimension ∷
subject ∷ normalized-title)[:16]` via `stableId()`/`withId()`. The `dimension` input keeps a
  security finding and a customer-facing finding on the same file+title distinct. Never construct a
  `Finding.id` by hand — a reworded title with the same inputs must stay the same finding.
- **`reconcile()` is pure — no IO.** It takes the previous ledger + fresh raw findings (+ optional
  scope and derived-domain universe) and returns the merged ledger + per-id classes. Reading/writing
  the ledger is the CLI's job, not `reconcile()`'s. It fails loud on an id collision (never silently
  drops one of two colliding findings — the v1 round-5 name-collision class).
- **`majorityKills` defaults to killed.** A tie, a `null` verdict, or either pass returning
  `refuted: true` all kill the finding. Only `[{refuted:false}, {refuted:false}, ...]` (every
  verdict present and explicitly `refuted: false`) survives.
- **Only `severity: "high"` findings are `/validate`-eligible.** Routine `info`/`warn` findings are
  unaffected by the escalation spine — don't wire `validateHighRisk` into the reconcile path itself.
- **`tooling/design-critic` is RETIRED (ADR-0411)** — the package is deleted and its 729-finding
  ledger is archived verbatim at `outputs/archive/audit/design-critic-findings-2026-08-18.toml`.
  This harness is the only ledger now; visual/Nielsen findings land under dimension **D8**. Do NOT
  attempt to import, re-key, or backfill the archived rows: its stable ids are a three-field hash
  (`workflow ∷ surface ∷ title`) and this package's are four-field, so no id survives the move.

## Wiring the real `Challenger`

The port is one method: `challenge(finding: Finding): Promise<{refuted: boolean} | null>`. The
production driver is **PAL `challenge` → OpenRouter** (per the GridWork operator-level cross-vendor
convention) — wire it in the calling CLI/skill, not inside this package. Tests use a fake
`Challenger` (see `src/validate.test.ts`) so the suite never makes a live call.

## Out of scope (this package)

No checker implementations (the `checker` field in `./dimensions.ts` is a lane name, not code). No
dispatch, no loop, no completeness critic, no finder prompts — those live in the driver
(`outputs/archive/specs/lift-phase/AUDIT-RUNBOOK.md`). The package adds only pure pieces: `deriveDomains`,
`applicableDimensions`, the coverage ledger shape (`serializeCoverage`/`isRoundDry`), and the
dimension-keyed id. No scheduling/CI wiring for the scope guard. No registry `manifest.ts` — this is
internal, unsold tooling (`package.json` is already `"private": true`).
