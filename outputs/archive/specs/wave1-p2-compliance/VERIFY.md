# VERIFY — Wave 1 · P2: Compliance edition (goal-backward)

Act 4. Re-asks the SPEC's stated Goal against the merged diff + tests — not a task checklist. Assessed
by reading source + test files (CI already green on main, PR#11/#12 — no re-run of `bun run check`).

## Goal restated

Ship the Compliance hero: a buyer seeds a tenant, writes encrypted SEC/HIPAA fields under a
tenant-scoped crypto boundary, locks an append-only artifact version into WORM with a SHA-256
audit-chain anchor, and emits a **deterministic, signed, control→evidence pack** that **validates
against a golden fixture** — and that **refuses to generate** when any control's evidence is missing.

## Did the code achieve the goal? — PASS (in-scope) / live transports unexercised by design

| Goal / exit-gate claim                                                                                      | Evidence (path:line)                                                                                                                                                                                                                   | Verdict |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Encrypted SEC/HIPAA field under a tenant-scoped crypto boundary (boundary == RLS boundary)                  | `with-tenant-crypto.ts:43` nests `withFieldCryptoContext(derivedContext)` INSIDE `withTenant`; `with-tenant-crypto.integration.test.ts:128,137` proves either half missing → fail-closed, 0 rows                                       | ✅      |
| Row-bound `encryptField(…,rowId)` round-trips; cross-row relocate fails AEAD auth (TM-E, closes Wave-0 TM2) | `encrypt-field.ts:45` 4-tuple AAD via `aad.ts:25`; `encrypt-field.test.ts:30,36,44,50` round-trip + cross-row/column/tenant all throw                                                                                                  | ✅      |
| Append-only locked version: immutable + UPDATE/DELETE refused under `SET ROLE app`                          | `version-store.ts` + `0002_versions.sql:62` withheld GRANT + REVOKE + belt trigger + FORCE RLS; `version-store.integration.test.ts:183` (app denied) + `:203` (superuser RAISE)                                                        | ✅      |
| WORM SHA-256 anchor catches tamper / truncation / wholesale rewrite                                         | `chain-store.ts:264` length-keyed write-once anchor + `verifyChain`; `chain-store.integration.test.ts:96,108,121` interior tamper→`brokenAt`, tail-truncation, same-length rewrite all caught                                          | ✅      |
| `app` role append-only by withheld GRANT; no-fork belt (UNIQUE+23505); anchor never overwritten (TM-D/H/I)  | `0001_audit_chain.sql:35` SELECT/INSERT only; `chain-store.integration.test.ts:140,158,173` app denied UPDATE/DELETE, truncate-re-append→`ConflictError`, fork→23505                                                                   | ✅      |
| Crypto-shred renders a subject's ciphertext unrecoverable while `verifyChain` still passes                  | `crypto-shred.ts:67` (chained PII = ciphertext, KEK destroyed); `crypto-shred.test.ts:30` shred→decrypt throws, chain still verifies; `:83` selective, `:146` irreversible                                                             | ✅      |
| Evidence pack validates against its golden; canonical body byte-stable, timestamp+signature excluded        | `pack-format.ts:176` `.strict()` body (no ts/sig), derived counts/readiness, posture-copy refine; `generate.ts:425` `canonicalize` body + deterministic ZIP; `generate.test.ts:156` matchGolden `evidence-pack.manifest` (BLESS unset) | ✅      |
| BLOCKED-case golden: an unresolved flag throws with NO partial pack (flag-never-guess, TM-K)                | `generate.ts:362` phase-1 scan → `EvidencePackBlockedError` before any assembly (no fs touch); `generate.test.ts:196,225` throws + matchGolden `evidence-pack.blocked`                                                                 | ✅      |
| Per-tenant Ed25519 detached signature over `canonicalize(manifest) ∥ tipHash`, distinct from license key    | `sign.ts:67,96,210` `#secretKey` private, `safeEqualFixed` compare; `sign.test.ts` (read) deterministic golden key; RFC-3161 countersign test-doubled                                                                                  | ✅      |
| Clean-room SOC2-TSC + HIPAA catalogs; SCF never ingested; EU-AI-Act = reserved empty slot (TM-J)            | `soc2-tsc.ts:1` own-authored prose, `crosswalk[].reference` = bare IDs only; `eu-ai-act.ts:43` `ReservedFramework` (no `defineFramework`, `golden:null`)                                                                               | ✅      |
| `apps/compliance` runs the full leg end to end on the composed migration set                                | `leg.test.ts:31` four exit checks + `allChecksPassed` + manifest golden; `harness.ts:78` real `assembleComplianceMigrations()`; route `app/api/leg/route.ts:14` wires the same harness                                                 | ✅      |
| Down-only graph proven; manifests + golden dir + AGENTS.md ship through `tooling/`                          | `.dependency-cruiser.cjs:53` `down-only-no-base-to-edition` (audit-worm/field-crypto ∈ BASE, compliance ∈ EDITION); `manifest.ts` both pkgs; AGENTS.md/README present both                                                             | ✅      |

## Acknowledged seams (by design — recorded, NOT failures; per SPEC §Scope + ADR-0054)

- **Live S3 Object-Lock** — `S3ArtifactStore` (`store.s3.ts`) is fully written over `@aws-sdk/client-s3`
  (conditional `IfNoneMatch:'*'` 412→`ArtifactExistsError`, `ObjectLockMode`+`RetainUntilDate`) but
  every test injects an `S3Sendable` stub (`store.s3.test.ts`) — a real `S3Client` is the only
  un-exercised path. COMPLIANCE-mode is reachable in tests only via a `NODE_ENV=production` toggle, never a live bucket.
- **Live AWS KMS** — `KmsKeyProvider` runs `LocalKmsClient`; `awsKmsClient` is a documented seam, no live deletion.
- **RFC-3161 TSA** — `StubTimestampAuthority` deterministically countersigns; the live DER-over-`fetchWithTimeout` POST is un-wired (`sign.ts:149`).
- **OSCAL SAR/POA&M export (T15)** — `toOscalBundle` is a pure, deterministic, seam-tested mapper, but
  `OscalExportTransport.deliver` is never invoked and there is **no call site in the leg or app** —
  genuinely un-wired (`oscal-export.ts:427`, `// P7:`).
- **Buyer-KMS Sign + DSSE/Sigstore/Rekor** — documented un-wired premium-provenance seams (`sign.ts:24`).

## Verdict: PASS on the SPEC's in-scope exit gate (every acceptance criterion met against the

test-doubled substrate, BLESS unset, no live cloud in CI) — **PARTIAL on production-transport
readiness**: the hero's WORM/KMS/TSA/OSCAL value rests on live transports that ship as typed,
seam-tested ports but are unexercised by design. The merged code does what the SPEC scoped; wiring the
live seams (P7/DEPLOY) is the residual, and is queued in SWEEP. No VERIFY-fail — proceed to SHIP-trail close.
