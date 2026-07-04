# @caisson/compliance

The Compliance edition — the hero (ADR-0040). A buyer seeds a tenant, writes encrypted SEC/HIPAA
fields under a tenant-scoped crypto boundary, locks an append-only artifact into WORM storage with a
SHA-256 audit-chain anchor, and emits a deterministic, signed control→evidence pack that validates
against a golden fixture — and that REFUSES to generate when any control's evidence is missing (flag,
never guess). A COMPOSITION of base packages, never a fork (ADR-0003).

- **Kind / tier:** edition · paid · `LicenseRef-Caisson-Commercial`

## Install

```bash
bun add @caisson/compliance
```

## Usage

```ts
import {
  soc2Tsc,
  generateEvidencePack,
  signEvidencePack,
  withTenantCrypto,
} from "@caisson/compliance";

// controls + chainAnchor come from running the declarative evidence collectors against your tenant.
const pack = generateEvidencePack({
  tenantId,
  framework: soc2Tsc,
  chainAnchor,
  controls,
  now: new Date(),
});
const signature = await signEvidencePack(signer, pack.manifest);

// Tenant writes to encrypted fields run inside the crypto + RLS boundary together.
await withTenantCrypto(db, accountId, keyProvider, async (tx) => {
  /* ... */
});
```

## Surface

- **Control model** — `defineControl` / `defineFramework` typed builders + own-authored `soc2Tsc` /
  `hipaaSecurity` / `euAiAct` packs, all clean-room (no SCF ingest).
- **Evidence engine** — declarative collectors (`rlsForceCollector` / `chainVerifyCollector` /
  `wormRetentionCollector`) → the typed canonical pack format → `generateEvidencePack` (deterministic,
  byte-stable, flag-never-guess) → `signEvidencePack` (per-tenant detached Ed25519) → an OSCAL export
  step a buyer opts into separately.
- **Composition + assembly** — `withTenantCrypto` (crypto nested inside the RLS scope, fail-closed) +
  `assembleComplianceMigrations` (ordered, checksum-ledgered cross-package migrations).
- **Bundled primitives** — `@caisson/alerting` and `@caisson/retention-runner` are composed into the
  edition via `createComplianceEdition` and re-exported from this package's barrel.
- **Operational telemetry** — `emitEvidenceGenerated` / `emitErasureCryptoShred` through the base
  `EventSink` port; the evidentiary record stays in the WORM chain.

## Dependencies

Down-only (ADR-0003): `@caisson/audit-worm` + `@caisson/field-crypto` + `@caisson/tenancy-rls` +
`@caisson/alerting` + `@caisson/retention-runner` + `@caisson/kernel`. Evidence is FREE in v1 — no
`@caisson/credits`. All three framework catalogs — SOC2-TSC, HIPAA-Security, and the EU AI Act
high-risk set — are authored + golden-pinned.

## Golden

`src/__golden__/` pins the canonical evidence-pack body, the BLOCKED case, the framework catalogs, and
the deterministic signature (ADR-0013); update only via `BLESS=1 bun test`.
