---
title: field-crypto cloud KMS envelope — live-test seam
status: draft — operator lock required
tags: [security, external-system, infra]
slug: live-seam-kms-envelope
---

# SPEC — `@caisson/field-crypto` cloud KMS envelope live-test seam

**Status: draft — operator lock required.** A DRAFT for operator review; it does NOT authorize building. Closes the last `needs-external` live-transport row (`docs/state/readiness-and-backlog.md:165`, `:371`) the same way ADR-0201 closed the WORM/OpenRouter rows — one gated `live/` proof + one `infra/` provisioner + one `test:live` script, no product-code change.

- **Package:** `packages/field-crypto` (`LicenseRef-Caisson-Commercial`, kernel-tier). No dependency-tier change — `@aws-sdk/client-kms ^3.1075.0` is already a hard `dependencies` entry (`packages/field-crypto/package.json:24`), so no availability probe is needed, only a creds/env gate.
- **Prior art:** ADR-0045 (envelope + KMS seam), ADR-0171 (AWS KMS + DB wrapped-key store adapter), ADR-0197 (per-tenant CMK / crypto-shred blast-radius fix), ADR-0055 (crypto-shred erasure primitive), ADR-0201 (the live-transport convention this follows).

## Goal (WHAT + WHY)

The KMS envelope path — `createAwsKmsClient` → `KmsKeyProvider` → `TenantFieldCrypto.encryptField/decryptField` → `cryptoShred` — is **fully implemented but never once exercised against real AWS KMS**. Every unit/conformance test injects a fake transport (`kms-aws.test.ts`, `kms-conformance.test.ts`, `kms.test.ts` all run through a fake `KmsSendable` or `LocalKmsClient`; `packages/field-crypto/package.json:21` scopes `test` to `bun test ./src`). This slice adds ONE gated live proof that drives the real stack top-to-bottom against a freshly minted, throwaway AWS CMK: envelope encrypt/decrypt through a real wrapped DEK, per-tenant CMK create + isolation, and a real crypto-shred with independent post-shred verification — the legs no fake backend can vouch for. It is the first live exercise of the ADR-0197 blast-radius fix, whose regression is a tenant-data-destruction class.

## Why now / trigger

- `docs/state/readiness-and-backlog.md:165` still lists `field-crypto cloud KMS envelope | cloud KMS account + CMK + awsKmsClient() body + @aws-sdk/client-kms | ADR-0045` as an open `needs-external` row, and `:371` groups it (`… OSCAL push · cloud KMS`) as one of the last "by-design seams (needs external infra — DEPLOY-class)" with the note "operator sequences relative to commerce."
- The blocking prerequisites are now met: the AWS account exists and is live-proven (`caisson-worm` S3 WORM bucket, us-east-1, ADR-0201), the scoped-prover-IAM pattern is established (`infra/worm/provision.ts:139-171`), and the `live/` + `test.skipIf` convention is repo-standard (`packages/audit-worm/live/`, `packages/ai-kit/live/`). ADR-0201 explicitly states "any FUTURE transport keeps the same rule" — this is that transport.
- The `@aws-sdk/client-kms` dep is already installed, so the only remaining gap is an account-side CMK + a gated proof file. Nothing about the adapter design is in question (ADR-0197 already accepted); this is coverage, not redesign.

## Non-goals

- **No `createKey`/`createAlias` op is added to the `KmsClient` port** (`packages/field-crypto/src/kms-port.ts:13-29`). Provisioning a tenant's CMK is an infra-time decision, not a driver responsibility; the port stays the 3-op crypto surface (`generateDataKey`/`decryptDataKey`/`scheduleKeyDeletion`). The live test mints its throwaway CMK by reaching AROUND the adapter with the raw SDK — precedented by the S3 live test reaching around `S3ArtifactStore` with raw `ListObjectVersionsCommand`/`DeleteObjectCommand` (`packages/audit-worm/live/store.s3.live.test.ts:124-139`). This is a **proof-only surface, not an adapter surface** — see Risk 1.
- **No product-code change.** No edit to `kms-aws.ts`, `kms.ts`, `crypto.ts`, `crypto-shred.ts`, or any `src/` file. The default suite, CI (secret-free runners), and the published tarball never see the `live/` dir (src-exported package, exports map points only at `./src`/`./dist`; `packages/field-crypto/package.json:11-17`).
- **No live test of the empty-`keyId` refusal.** The fail-closed refusal (ADR-0197; `kms-aws.ts:114-120`) is already covered by `kms-aws.test.ts` fake-transport; live-attempting it is pointless (and would need a shared default CMK to even reach).
- **No COMPLIANCE-mode / GCP / Azure / Vault live coverage.** AWS only (the account we have). The port stays provider-neutral (ADR-0043); other drivers are drop-in and out of scope.
- **No production tenant CMK lifecycle / rotation policy** beyond the single provisioner step in Fork B — real per-customer CMK provisioning is a first-customer concern.

## Current state (real files)

- `packages/field-crypto/src/kms-port.ts:13-29` — the `KmsClient` port: `generateDataKey(keyId)`, `decryptDataKey(keyId, wrapped)`, `scheduleKeyDeletion(keyId)`. Every op is scoped by `keyId`; **there is no `createKey` op**. A live test cannot "pass a tenantId" — it must supply a real, already-existing AWS `KeyId`/ARN/alias as the scope.
- `packages/field-crypto/src/kms-aws.ts:62-129` — `createAwsKmsClient(config)` over `@aws-sdk/client-kms` (`GenerateDataKeyCommand`/`DecryptCommand`/`ScheduleKeyDeletionCommand`). `cmkFor(keyId)` (`:73-74`) targets the per-call scope, falling back to `config.keyId` only when the scope is empty. Binds `EncryptionContext {"caisson:field-crypto:scope": keyId}` (`:57-59`). `scheduleKeyDeletion` **throws `ValidationError` on an empty `keyId`** (`:114-120`, the ADR-0197 fail-closed). `pendingWindowInDays` defaults to 7 (AWS minimum, `:67`). Config accepts an injectable `client?: KmsSendable` for tests (`:48-50`).
- `packages/field-crypto/src/kms.ts:124-178` — `KmsKeyProvider`: `provision(tenantId)` → `generateDataKey` + persist via a `WrappedKeyStore` (`InMemoryWrappedKeyStore` at `:43-68`); `keyFor(tenantId, v)` → `decryptDataKey`; `scheduleKeyDeletion(tenantId)` returns the highest version at shred time. `:187-272` is `LocalKmsClient` (the CI double); `:284-289` re-exports `awsKmsClient = createAwsKmsClient`.
- `packages/field-crypto/src/crypto.ts:11-64` — `TenantFieldCrypto.encryptField/decryptField` (the full envelope API over any `FieldKeyProvider`, binds tenant∥version∥column as GCM AAD).
- `packages/field-crypto/src/crypto-shred.ts:67-85` — `cryptoShred(provider, request)`: `.strict()`-validates, calls `provider.scheduleKeyDeletion(keyScopeId)`, mints the metadata-only `erasure.crypto-shred` audit payload.
- Existing tests never touch AWS: `kms-aws.test.ts` (fake `KmsSendable`), `kms-conformance.test.ts` (a **stateful fake** AWS backend), `kms.test.ts` (`LocalKmsClient`). The envelope-through-a-real-wrapped-DEK leg is uncovered.
- `packages/field-crypto/package.json` — `@aws-sdk/client-kms ^3.1075.0` hard dep (`:24`); scripts are `build`/`lint`/`test` only, **no `test:live`** (`:18-22`).
- Pattern to mirror: `packages/audit-worm/live/store.s3.live.test.ts` (gate `HAVE_CREDS` at `:27-29`, per-run `randomUUID()` segment `:36`, 30s timeout, best-effort raw-SDK cleanup leg `:120-148`) + `infra/worm/provision.ts` (idempotent one-shot, `printProverPolicy()` PRINTS a scoped least-privilege IAM policy `:139-171`, prover creds stay separate from product creds). Gate convention: `packages/ai-kit/live/embed.live.test.ts:35` gates on a **surface-specific** secret (`OPENROUTER_API_KEY`), not a generic flag.
- `docs/state/readiness-and-backlog.md:211` — `Field KMS (alt): KMS_KEY_ID + cloud KMS creds` as the optional alternative to `MASTER_FIELD_KEY`/`FIELD_CRYPTO_SALT`.

## Design

Three files change: a new `infra/kms/provision.ts`, a new `packages/field-crypto/live/kms.live.test.ts`, and one `test:live` line in `package.json`. The proof follows the ADR-0201 convention exactly, with **three deliberate departures dictated by KMS's shape**:

**(A) The test self-provisions its own per-run throwaway CMK via the raw SDK.** Unlike S3 (one persistent bucket + disposable per-run object keys) or OpenRouter (no provisioning), a CMK is _itself_ the destructible resource under test — `scheduleKeyDeletion` is a one-way action on the specific key it targets, and no `createKey` op exists on the port (a Non-goal, above). So the test calls `CreateKeyCommand` + `CreateAliasCommand` (with inline `Tags` on `CreateKey`) directly to mint a fresh, tagged, per-run CMK, uses it AS the tenant `keyId` scope, then drives the three real port ops against it — mirroring how the S3 test reaches around its adapter with raw commands for setup/verification.

**(B) No lifecycle reaper in `infra/kms/provision.ts`.** AWS's own 7-day pending-deletion window IS the self-cleanup: the shred leg schedules deletion of the proof CMK, which then auto-purges. Unlike S3 objects (which need a lifecycle rule, `infra/worm/provision.ts:114-137`), no reaper step is required.

**(C) The cost note states the real near-$0 marginal cost** — not a naive "$1/mo through the pending window" (factually wrong: billing stops the instant `ScheduleKeyDeletion` succeeds). See the Cost section.

### The live proof — 7 legs (`packages/field-crypto/live/kms.live.test.ts`)

Gate (mirrors `store.s3.live.test.ts:27-29`'s `HAVE_CREDS` shape, but keyed on a **KMS-specific opt-in** per the ai-kit convention so WORM's AWS creds sitting in env don't accidentally fire it):

```ts
const OPT_IN = process.env.CAISSON_KMS_LIVE ?? "";
const HAVE_CREDS =
  OPT_IN.length > 0 && (process.env.AWS_ACCESS_KEY_ID ?? "").length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const REGION = process.env.AWS_REGION ?? "us-east-1";
const TIMEOUT = 60_000; // several sequential AWS calls per leg
const PURPOSE = "caisson-field-crypto-live-proof";
const RUN = randomUUID(); // tag every proof key, never collide across re-runs
```

1. Raw `CreateKeyCommand({ Tags: [{TagKey:"Purpose",TagValue:PURPOSE},{TagKey:"Run",TagValue:RUN}] })` + `CreateAliasCommand` → a fresh per-run CMK (CMK-A); capture its `KeyId`. No explicit `Policy` — `CreateKey` applies AWS's default account-root/IAM-governed key policy, which is exactly what the scoped prover IAM policy governs.
2. `const kms = createAwsKmsClient({ keyId: cmkA, region: REGION });` wrapping `new KmsKeyProvider(kms, new InMemoryWrappedKeyStore())`. CMK-A's id doubles as the tenant scope AND the default fallback (the provider passes the scope as the per-call `keyId`, so `cmkFor` uses it directly).
3. `provider.provision(cmkA)` → real `GenerateDataKeyCommand` against the live key (returns version 1).
4. `new TenantFieldCrypto(provider).encryptField(cmkA, secret, col)` then `decryptField(...)` round-trips through the REAL wrapped DEK — **the envelope encrypt/decrypt proof no unit test covers** (`kms-conformance.test.ts`'s AWS path uses a stateful fake backend).
5. Mint a second per-run CMK (CMK-B) the same way; `provider.provision(cmkB)`; assert a value encrypted under CMK-A does NOT decrypt under CMK-B — cross-tenant isolation against the real service (mirrors `kms.test.ts` against `LocalKmsClient`), doubly bound by distinct CMKs AND the per-scope `EncryptionContext`.
6. `cryptoShred(provider, { keyScopeId: cmkA, tenantId, subjectId, reason: "gdpr-art17", occurredAt })` → real `ScheduleKeyDeletionCommand` (PendingWindowInDays 7). Then independently verify via raw `DescribeKeyCommand`: `KeyState === "PendingDeletion"` with a `DeletionDate` set — the shred confirmed OUTSIDE the adapter under test.
7. Post-shred, re-attempt `provider.keyFor(cmkA, 1)` / `decryptField` → assert it throws (AWS `Decrypt` fails on a key pending deletion) — **the crypto-shred unrecoverability proof, LIVE.** This leg is inherently destructive; AWS's pending-deletion window is the self-cleanup, so no reaper is needed.

`afterAll`: best-effort `ScheduleKeyDeletionCommand` on any still-Enabled proof CMK (CMK-B) — mirrors the S3 test's best-effort cleanup (`store.s3.live.test.ts:120-148`); a missed one is auditable by the `Purpose` tag via CloudTrail and bills $0 once scheduled.

### The provisioner (`infra/kms/provision.ts`)

An idempotent Bun one-shot mirroring `infra/worm/provision.ts` (outside the package gates). Its default job (Fork B, Option 2 recommended) is **`printProverPolicy()` only** — print, never create, the scoped tag-based-ABAC IAM policy for a dedicated prover principal:

```jsonc
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "KmsProofCreate",
      "Effect": "Allow",
      "Action": ["kms:CreateKey", "kms:TagResource"],
      "Resource": "*", // no ARN exists yet at CreateKey time
      "Condition": {
        "StringEquals": {
          "aws:RequestTag/Purpose": "caisson-field-crypto-live-proof",
        },
      },
    },
    {
      "Sid": "KmsProofOps",
      "Effect": "Allow",
      "Action": [
        "kms:CreateAlias",
        "kms:GenerateDataKey",
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:ScheduleKeyDeletion",
        "kms:CancelKeyDeletion",
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ResourceTag/Purpose": "caisson-field-crypto-live-proof",
        },
      },
    },
  ],
}
```

(`kms:CreateKey` targets `Resource:"*"` because the key ARN does not exist yet — authorized instead by `aws:RequestTag/Purpose`; subsequent ops condition on `kms:ResourceTag/Purpose`, AWS's documented tag-authorization pattern.) Prover creds stay separate from product creds (ADR-0201). If Fork B locks Option 1, the script ALSO ensures one persistent production default CMK (`KMS_KEY_ID`, `EnableKeyRotation`) — see Fork B.

## Open forks (operator locks; do NOT pre-bind)

**Fork A — prover principal identity.** ADR-0201 requires prover creds separate from product creds; open question is whether KMS reuses the WORM prover identity or gets its own.

- _Option A1 — one shared "live-proof prover" principal_ carrying both the WORM S3 statements (`infra/worm/provision.ts:139-171`) and the KMS statements above. One identity for all live proofs; both are proof-only and both stay separate from product creds. **Trade-off:** a single prover key with a broader (but still tag-scoped, least-privilege) surface.
- _Option A2 — a dedicated KMS prover principal, separate from the WORM prover._ Tighter blast radius per identity. **Trade-off:** a second prover credential to mint, store in `~/.gridwork/env`, and rotate.
- **Recommendation: A1** (confidence: medium). Both provers are tag-scoped, proof-only, and already outside product creds; one identity is fewer secrets to manage for zero real security loss (each statement is `Purpose`-tag-conditioned). Choose A2 only if you want per-surface key revocation.

**Fork B — persistent production default CMK.** Does `infra/kms/provision.ts` create the long-lived production default CMK now, or only print the prover policy?

- _Option B1 — provision one persistent default CMK now_ (`KMS_KEY_ID`, `EnableKeyRotation` on) + print the policy. Closes the `docs/state/readiness-and-backlog.md:211` `Field KMS (alt)` config row in the same motion; mirrors how WORM's provisioner created its persistent bucket. **Trade-off:** the CMK sits idle at ~$1/mo with no production tenant consuming it yet, and the provision step then needs AWS creds (so Task 1's verify becomes a typecheck, not a creds-free print).
- _Option B2 — print-only; the test fully self-provisions its throwaway CMKs; defer the production default CMK to first-customer provisioning._ The live proof needs no persistent resource (Design departure A). Row 211 stays open (a real-customer-time concern). **Trade-off:** `KMS_KEY_ID` production config is not closed by this slice.
- **Recommendation: B2** (confidence: medium). No production field-crypto tenant exists, so a persistent CMK is a speculative idle resource (YAGNI); the proof is complete without it and the provisioner stays a creds-free policy printer. B1 is defensible if you want row 211 closed now — $1/mo is trivial. The env gate is a KMS-specific opt-in either way (`CAISSON_KMS_LIVE` under B2, or `CAISSON_KMS_LIVE_DEFAULT_KEY_ID` pointing at the persistent CMK under B1).

## Tasks (atomic, each with a verify command)

1. **`infra/kms/provision.ts`** (new, ~90–120 LOC, mirrors `infra/worm/provision.ts`) — `printProverPolicy()` emitting the tag-scoped ABAC JSON above; if Fork B=B1, also an idempotent `ensureDefaultCmk()` (CreateKey by alias-lookup + `EnableKeyRotation`). No lifecycle reaper (Design departure B). **Verify (B2, creds-free print path):** `bun infra/kms/provision.ts` exits 0 and prints valid policy JSON — `bun infra/kms/provision.ts | grep -q 'caisson-field-crypto-live-proof'`. (B1: `bunx tsc --noEmit -p infra/tsconfig.json` typecheck, since the CreateKey path needs AWS creds.)
2. **`packages/field-crypto/live/kms.live.test.ts`** (new) + **`packages/field-crypto/package.json`** gains `"test:live": "bun test ./live"` (the identical string `audit-worm`/`ai-kit`/`local-ai` use). The 7-leg proof from Design, self-skipping via `test.skipIf(!HAVE_CREDS)`. **Verify (CI-safe, creds-free skip path):** `bun run --cwd packages/field-crypto test:live` exits 0 with every leg SKIPPED. **Verify (operator, real proof):** `CAISSON_KMS_LIVE=1 AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… bun run --cwd packages/field-crypto test:live` — all 7 legs green, then `aws kms describe-key` shows the proof CMK `PendingDeletion`.
3. **Changeset** naming `@caisson/field-crypto` (patch) — the changeset gate fails on any changed `packages/*` without a naming changeset (test-only or not; `apps`/`services`/`infra` are exempt but `packages/field-crypto/package.json` is not). **Verify:** `bunx changeset status --since=origin/main`.

## Verification (goal-backward)

Re-ask the Goal: _is the KMS envelope path proven against real AWS KMS, end-to-end, with no product-code change?_

- The live proof drives `createAwsKmsClient` → `KmsKeyProvider.provision`/`keyFor` → `TenantFieldCrypto.encryptField/decryptField` → `cryptoShred` against a real, freshly minted CMK, and a value round-trips through a REAL wrapped DEK (leg 4) — the leg no fake backend covers.
- Per-tenant CMK create + cross-CMK isolation hold against the live service (legs 1, 5); the crypto-shred is confirmed via an independent raw `DescribeKeyCommand` (`KeyState === "PendingDeletion"`, leg 6) and post-shred decrypt throws (leg 7) — the first LIVE exercise of the ADR-0197 blast-radius fix.
- No `src/` file changed; `bun test ./src` and CI stay green and creds-free (every leg skips without `CAISSON_KMS_LIVE`); `bun run check` green inside `packages/field-crypto`; no new dep, no license-tier change.
- `docs/state/readiness-and-backlog.md:165` (`needs-external`) and `:371` (live-testing group) can be reconciled from "un-exercised by design" to "proven live," matching the WORM/OpenRouter reconciliation ADR-0201 performed.

## Risks

1. **The port has no create-key op — the live test necessarily reaches around the adapter** (raw `CreateKeyCommand`/`CreateAliasCommand`/`DescribeKeyCommand`), exactly as the S3 live test reaches around `S3ArtifactStore` for raw `ListObjectVersions`/`Delete`. Call this out as a **proof-only surface, not an adapter gap** — the port stays the 3-op crypto surface; do NOT "fix" it by adding `createKey`.
2. **Key sprawl.** Every run mints a real CMK (CreateKey has AWS-side effect even though billing stops at ScheduleKeyDeletion). Repeated `test:live` runs create keys visible for the 7-day pending window, then auto-purge. Mitigation: every proof key carries `Purpose=caisson-field-crypto-live-proof` + `Run=<uuid>` tags for CloudTrail auditing; the `afterAll` schedules deletion of the surviving CMK-B.
3. **Real security weight.** This is the FIRST live proof of ADR-0197's per-tenant-CMK fix; a regression (`scheduleKeyDeletion` silently falling back to a shared default CMK) is a tenant-data-destruction class per that ADR's own framing — hence the `security` + `external-system` tags fire the standard SHIP audits, not a coverage checkbox.
4. **Prover creds are a distinct provisioning step.** The WORM AWS IAM user does not carry the KMS actions; this needs a scoped prover principal (Fork A) with the tag-conditioned policy — confirm the operator mints it before the real proof runs, separate from product creds (ADR-0201).

## Cost note (verified)

**~~$0.00 marginal cost per live run.** AWS KMS bills $1/month per customer-managed key, **prorated hourly, and $0 during the 7–30 day pending-deletion window** — the charge stops the instant `ScheduleKeyDeletion` succeeds and resumes only if deletion is cancelled (https://aws.amazon.com/kms/pricing/; https://cloudburn.io/blog/aws-kms-pricing, 2026-03-08; https://docs.aws.amazon.com/kms/latest/cryptographic-details/key-deletion.html). Each proof CMK is Enabled only for the few seconds/minutes before the shred leg schedules its deletion → a fraction of an hour's proration, well under $0.01. Plus ~6–10 symmetric API calls per run ($0.03 / 10,000, no free tier for CMKs) → negligible. **Total per run rounds to $0.00** — NOT the naive "~~$0.23 for the 7-day pending window," which is factually wrong (billing halts at ScheduleKeyDeletion). Under Fork B=B1, the one persistent default CMK is the only recurring charge (~$1/mo).

## ADR interactions

- **ADR-0045** (envelope + KMS seam) — **realizes.** The readiness row (`:165`) cites ADR-0045; this live-proves the by-design seam it declared. No change to the lock.
- **ADR-0197** (per-tenant CMK; `scheduleKeyDeletion` refuses empty `keyId`) — **realizes (first live exercise).** Legs 5–7 are the first live proof of the blast-radius fix. Coverage only; the invariant is unchanged.
- **ADR-0201** (live-transports go-live convention: `live/` dir + `test:live` + `test.skipIf` + scoped prover policy + prover-creds-separate) — **extends.** Adds cloud KMS as a fourth live transport under the identical convention; ADR-0201 already provides for this ("any FUTURE transport keeps the same rule"). No supersession.
- **ADR-0171** (AWS KMS + DB wrapped-key store adapter) — **realizes.** The adapter this proves live.
- **ADR-0055** (crypto-shred erasure-by-key-destruction + row-level AAD) — **realizes.** Leg 7 proves irreversibility against real AWS. (This is the sole crypto-shred ADR; the canonical field-crypto lineage is `0006 → 0043 → 0055`, `docs/adr-index.md`.)
- **ADR-0043** (KMS opt-in tier, provider-neutral) — **touches, no change.** The proof is AWS-specific; the `KmsClient` port stays neutral (GCP/Azure/Vault remain drop-in).
- **ADR-0006** (field-crypto compliance data layer / append-only wrapped-DEK store) — **touches, no change.** The shred leaves the append-only wrapped-DEK rows in place; the erasure acts on the KEK (the CMK), not the store rows.
- **No existing ADR requires superseding** — this slice is purely additive (one `live/` file + one `infra/` script + one `package.json` line). The absence of a `createKey` port op is intentional (Risk 1), not a gap this SPEC repairs.
- **New ADR to file on lock:** the next free number (0218 at drafting; renumber at merge if `main` advances, per the ADR-0088 convention) recording the KMS live-transport go-live + the Fork A/B locks — the natural successor to ADR-0201.

## Effort / Value

Effort: **S** (~0.3–0.5 day) — one gated test file, one provisioner mirroring an existing one, one script line, one changeset; no product-code change. Value: **MEDIUM-HIGH** — closes the last field-crypto `needs-external` seam and gives the compliance edition's GDPR-Art.17 crypto-shred upsell its first real-infra proof, with a tenant-data-destruction-class regression under it.
