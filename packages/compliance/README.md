# @caisson/compliance

The Compliance edition — the hero (ADR-0040). A buyer seeds a tenant, writes encrypted SEC/HIPAA
fields under a tenant-scoped crypto boundary, locks an append-only artifact into WORM storage with a
SHA-256 audit-chain anchor, and emits a deterministic, signed control→evidence pack that validates
against a golden fixture — and that REFUSES to generate when any control's evidence is missing (flag,
never guess). A COMPOSITION of base packages, never a fork (ADR-0003).

- **Kind / tier:** edition · paid · `LicenseRef-Caisson-Commercial` (ADR-0050)
- **Key ADRs:** 0005 (RLS == crypto boundary) · 0006 (audit chain) · 0051–0058 (WORM mode, chain +
  version persistence, WORM store, field-crypto P2, evidence signing, control model, pack format) ·
  0075 (EventSink ops mirror)
- **Seeds (rebuild-clean):** patterns only — Wardfile / gridwork-core / PUBLIC tessera. No pro-private
  code.

## Surface

- **Control model** — `defineControl` / `defineFramework` typed builders + own-authored `soc2Tsc` /
  `hipaaSecurity` packs + the reserved `euAiAct` slot (clean-room; no SCF ingest).
- **Evidence engine** — declarative collectors (`rlsForceCollector` / `chainVerifyCollector` /
  `wormRetentionCollector`) → the typed canonical pack format → `generateEvidencePack` (deterministic,
  byte-stable, flag-never-guess) → `signEvidencePack` (per-tenant detached Ed25519) → the un-wired
  OSCAL export seam.
- **Composition + assembly** — `withTenantCrypto` (crypto nested inside the RLS scope, fail-closed) +
  `assembleComplianceMigrations` (ordered, checksum-ledgered cross-package migrations).
- **Operational telemetry** — `emitEvidenceGenerated` / `emitErasureCryptoShred` through the base
  `EventSink` port; the evidentiary record stays in the WORM chain (ADR-0075).

## Dependencies

Down-only (ADR-0003): `@caisson/audit-worm` + `@caisson/field-crypto` + `@caisson/tenancy-rls` +
`@caisson/kernel`. Evidence is FREE in v1 — no `@caisson/credits`. All three framework catalogs —
SOC2-TSC, HIPAA-Security, and the EU AI Act high-risk set — are authored + golden-pinned
(`eu-ai-act.manifest.ts` carries `golden: "src/__golden__"`).

## Golden

`src/__golden__/` pins the canonical evidence-pack body, the BLOCKED case, the framework catalogs, and
the deterministic signature (ADR-0013); update only via `BLESS=1 bun test`.
