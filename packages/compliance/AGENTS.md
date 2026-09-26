# AGENTS — @caisson-sh/compliance

Agent-facing authoring/usage contract. What a generation agent or a developer wiring the compliance
kit must know. This package is a COMPOSITION of base packages (ADR-0003) — it never forks them and
never re-implements the kernel integrity algebra; it imports DOWN onto `@caisson-sh/audit-worm`,
`@caisson-sh/field-crypto`, `@caisson-sh/tenancy-rls`, over `@caisson-sh/kernel`.

## Invariants (do not violate)

- **Down-only, never up.** This package depends on base/primitive packages; a base package NEVER
  imports back into `@caisson-sh/compliance` (ADR-0003). `bunx depcruise packages apps tooling` must stay
  at zero base→composition / composition→composition edges. Evidence generation meters nothing —
  there is NO `@caisson-sh/credits` dependency.
- **Crypto boundary == RLS boundary.** Encrypted SEC/HIPAA writes go through `withTenantCrypto`, which
  nests the field-crypto context INSIDE `withTenant` — never encrypt outside the tenant RLS scope
  (fail-closed, ADR-0005).
- **Flag-never-guess.** The evidence-pack generator REFUSES to produce a pack when any control's
  evidence is `unresolved` — it throws with the BLOCKED report and writes nothing (ADR-0058). A
  `flagged` control needs a recorded resolution reason. Output copy is readiness/posture, NEVER
  "compliant/certified".
- **Deterministic + signed.** The canonical manifest body excludes the timestamp + signature (injected
  at the edge), is `canonicalize`d, and the archive is byte-stable (fixed mtimes, sorted entries). The
  signature is a per-tenant detached Ed25519 over `canonicalize(manifest) ∥ anchor.tipHash`
  (ADR-0056). Compare signatures with `timingSafeEqual`, never `===`.
- **Clean-room control catalog.** SOC2-TSC + HIPAA + EU AI Act high-risk controls are ALL
  own-authored + golden-pinned; NEVER ingest/copy/transform SCF CC-BY-ND JSON. Any new framework stays
  clean-room authored.
- **No live cloud on the CI path.** S3 Object-Lock, KMS, and the RFC-3161 timestamp authority
  are all behind ports, test-doubled. The live transport is the only un-exercised path.

## Operational telemetry vs the evidentiary record (ADR-0075)

`src/observe.ts` emits `evidence.generated` + `erasure.crypto-shred` as OPERATIONAL events through the
base `EventSink` port — mutable, drop-able ops telemetry carrying only opaque ids + posture counts + a
content digest (never PII, ciphertext, or a secret). The AUTHORITATIVE, immutable record lives in the
WORM audit chain (`@caisson-sh/audit-worm`) and is NEVER routed through the sink — the two write paths are
strictly separate. The clock is injected at the edge so emitted timestamps are deterministic.

## Golden (ADR-0013)

`src/__golden__/` pins the canonical evidence-pack body + the BLOCKED case + the framework catalogs +
the deterministic signature. Update only via `BLESS=1 bun test` — a change there is a format/contract
break and must land as a reviewed diff. Goldens are matched with `BLESS` unset on every run.

## Dependencies

Down-only (ADR-0003): `@caisson-sh/audit-worm` + `@caisson-sh/field-crypto` + `@caisson-sh/tenancy-rls` +
`@caisson-sh/kernel`. Never `@caisson-sh/credits` (evidence meters nothing). Never depends "up" on another
composition package.
