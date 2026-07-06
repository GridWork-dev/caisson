---
updated: 2026-07-06
status: live
---

# Adapter / driver expansion — buildout roadmap

Status: **partially shipped, reconciled 2026-07-06** · authored 2026-06-30 (operator directed
full buildout of all tiers + un-wired seams). Source: the 2026-06-30 external-provider
inventory. This is a roadmap doc (under `docs/state/`); each port-family expansion locks an
**ADR** in `knowledge/decisions/` before code, per the spec-first cadence. The 0119+ ADR
numbers penciled below were **never used** — the actual locks landed under other numbers
(see the reconcile block).

## 2026-07-06 reconcile (ADR-0265 doc-correction pass — read this before quoting any row)

Much of Tier 1/2 shipped in the 2026-06-30/07-01 Stage-2 Stream-D wave, same day this doc was
authored; the tier sections below are kept for their design detail but their "Add"/"planned"
framing is stale for these rows:

- **Emailer → SHIPPED** (ADR-0170): SMTP-generic + SES + Postmark beside Resend/Capture.
- **KmsClient AWS → SHIPPED + live-proven** (ADR-0171, real-CMK proof 2026-07-02); **GCP KMS
  locked into the Kickoff-F wave** (no new ADR needed per ADR-0171's own binding); Azure
  KV/Vault still open.
- **SessionProvider WorkOS → SHIPPED** (ADR-0172); Clerk/Auth0 still open.
- **JobQueue pg-boss → SHIPPED** (ADR-0173; + in-service scheduler ADR-0256); BullMQ/Inngest
  still open.
- **AI inference Bedrock/Azure/Ollama → SHIPPED** (Stage-2 Stream C, ADR-0160-0162 wave).
- **BillingProvider LemonSqueezy/Polar → CODED** (ADR-0175; live-proof pending per ADR-0265).
- **MCP HTTP transport → SHIPPED** (ADR-0161).
- **ArtifactStore R2: the "~trivial S3-compat reuse" premise below is WRONG** — R2 does not
  support S3 Object Lock, and `ArtifactStore` is a WORM-contract port (`retainUntil`
  mandatory). The corrected lock is **ADR-0267**: GCS Bucket Lock + an R2 driver on
  Cloudflare's bucket-locks API, fail-closed when the bucket rule can't satisfy the requested
  retention.
- Still genuinely open beyond the above: GCS/Azure Blob (now locked via ADR-0267 for GCS),
  BullMQ/Inngest, Clerk/Auth0, Azure KV/Vault KMS, Slack/Telegram chat (deferred again at the
  Kickoff-F round, QA-path-only whenever it returns), analytics port (1D scope).
- Launch gating for every transport row now lives in `docs/state/live-transport-checklist.md`
  (ADR-0265, enterprise-ready sweep).

## Why

Caisson is sold to buyers who deploy it in **their** environment. Every port with a single concrete
driver caps which environments a buyer can run on — so each added driver widens the addressable
market and, for the edition-critical ones (KMS, SSO), directly unblocks an enterprise sale. All
expansions are **additive behind already-locked ports** (ADR-0003 composable, ADR-0108 driver
pattern) — never a fork of the port contract.

## Conventions (apply to every new driver)

- New driver = new file beside the existing driver in the owning package; selected by **dependency
  injection** or an **env-gated** factory (dormant when its env is unset) — identical to Resend /
  Paddle / OTLP today. The package never reads `process.env` for the secret directly where the
  current driver doesn't.
- `fetchWithTimeout` on every outbound call; `crypto.timingSafeEqual` for any secret/HMAC compare;
  Zod `.strict()` on any new config/boundary; fail-closed on missing config.
- **Round-trip test every driver** (the W2/B1-class seam trap): a parse→map or write→read test, plus
  a port-conformance test so all drivers satisfy the same contract.
- One **ADR per port-family** (not per driver) authorizing the multi-driver set + the default.

---

## Port → current drivers → expansion (full inventory)

| Port                           | File:line                                                                         | Drivers today                                                                                         | Add                                                                                                                                     | Tier     |
| ------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `Emailer`                      | `packages/email/src/email.ts:15`                                                  | Resend (`:53`), Capture (test)                                                                        | **SMTP-generic**, **AWS SES**, Postmark                                                                                                 | 1        |
| `KmsClient` + license `Signer` | `packages/field-crypto/src/kms.ts:30` · `packages/license-issue/src/signer.ts:47` | Local; **AWS KMS SHIPPED + live-proven** (`kms-aws.ts`, ADR-0171 — the "throws" note is pre-Stream-D) | GCP KMS (locked, Kickoff-F wave), Azure Key Vault, Vault                                                                                | 1 (seam) |
| `SessionProvider`              | `packages/auth/src/session.ts:17`                                                 | better-auth only                                                                                      | **WorkOS** (SAML/SCIM SSO), Clerk, Auth0/Okta                                                                                           | 1        |
| Analytics (no port — **bug**)  | `apps/site/app/layout.tsx:61` (hardcoded `data-domain`)                           | Plausible, hardcoded                                                                                  | **Make a port + env-gate**; add PostHog, GA4                                                                                            | 1        |
| `ArtifactStore`                | `packages/audit-worm/src/store.ts:35`                                             | S3 (`store.s3.ts`), Local                                                                             | GCS Bucket Lock + R2 bucket-locks per **ADR-0267** (the old "R2 S3-compat ~trivial" claim was WRONG — no Object Lock on R2), Azure Blob | 2        |
| `JobQueue`                     | `packages/jobs/src/queue.ts:26`                                                   | Trigger.dev (`trigger-driver.ts:52`), InMemory                                                        | **pg-boss** (Postgres-native, zero new infra), BullMQ/Redis, Inngest                                                                    | 2        |
| AI inference                   | `packages/ai-config/src/config.ts:11` · `packages/ai-kit/src/providers.ts:20`     | openai, anthropic, google, openrouter, local                                                          | **AWS Bedrock**, **Azure OpenAI**, **Ollama**                                                                                           | 2        |
| `BillingProvider`              | `packages/billing/src/provider.ts:23`                                             | Stripe (`:38`), Paddle (`:109`)                                                                       | LemonSqueezy, Polar                                                                                                                     | 3        |
| Chat (support-bot, no port)    | `services/support-bot/.../bot.py`                                                 | Discord                                                                                               | **Slack**, Telegram                                                                                                                     | 3        |
| MCP transport                  | `packages/mcp-server/src/stdio.ts:24`                                             | stdio only                                                                                            | **HTTP/SSE transport** (remote MCP)                                                                                                     | 3        |
| Observability                  | `packages/observability/src/observability.ts:79`                                  | OTLP/HTTP single                                                                                      | OTLP/gRPC option (already backend-swappable via endpoint)                                                                               | 3        |
| `Transactor` (DB)              | `packages/tenancy-rls/src/rls.ts:21`                                              | node-postgres/Neon (inject), PGlite (test), sqlite (local-first)                                      | Supabase explicit; Neon-serverless-HTTP **only if** RLS-tx model allows (needs TCP tx — careful)                                        | 3        |
| `Embedder`                     | `packages/local-store/src/embedder.ts:14`                                         | OpenRouter (prod), Fake (ci)                                                                          | (already covered by inference expansion; Bedrock/Azure/local embed)                                                                     | 2        |

---

## Tier 1 — sells editions / unblocks enterprise

### 1A. Email multi-driver — `Emailer` → **ADR-0119**

- Add **SMTP-generic** (nodemailer-style, universal catch-all — any buyer mail host) + **AWS SES**
  (cheap enterprise scale) + Postmark (transactional reliability).
- Drivers: `packages/email/src/{smtp,ses,postmark}.ts`; env-gated factories; `EMAIL_DRIVER` selector
  or inject. Round-trip: send→capture conformance test across all drivers.
- Unblocks: any buyer with an existing mail stack or data-residency rule (Resend-only blocks them).

### 1B. KMS wiring — `KmsClient` + license `KmsSigner` → **ADR-0120**

- **Implement the throwing `awsKmsClient` seam** (`kms.ts:241`) over `@aws-sdk/client-kms`
  (Encrypt/Decrypt/GenerateDataKey for envelope) + wire `KmsSigner` (`signer.ts:176`) to KMS Sign.
  Then GCP KMS, Azure Key Vault, HashiCorp Vault.
- Unblocks: **the Compliance edition's headline** — field-crypto envelope encryption + court-admissible
  WORM + signed licenses are **dev-only today** (`LocalKmsClient`). Real KMS = enterprise-credible.
- Highest revenue-risk gap; do first within Tier 1.

### 1C. Enterprise auth / SSO — `SessionProvider` → **ADR-0121**

- Add **WorkOS** driver (SAML + SCIM + directory sync) — enterprise/compliance buyers _require_ SSO.
  Optionally Clerk (dev-friendly) + Auth0/Okta.
- Keep better-auth as the default OSS driver; SSO is the commercial/enterprise lane.

### 1D. Analytics port + env-gate (fixes a live bug) → **ADR-0122**

- The env-gate is **DONE** (`apps/site/components/plausible-init.tsx` reads
  `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, no-ops when unset — `936f54f`, same day this row was
  authored). Still open: this ADR's actual scope, an analytics **port** so PostHog / GA4 are
  swappable, not just Plausible — roadmap, not built.

---

## Tier 2 — broadens deployment targets

### 2A. Storage — `ArtifactStore` → superseded by **ADR-0267** (2026-07-06)

- ~~**Cloudflare R2** (S3-compatible → reuse `S3ArtifactStore` with `endpoint`+creds, ~trivial)~~
  **WRONG PREMISE** — R2 has no S3 Object Lock and `ArtifactStore` is a WORM-contract port.
  Corrected scope per ADR-0267: **GCS Bucket Lock** driver + an **R2 driver on Cloudflare's
  bucket-locks API** (fail-closed when the bucket rule can't satisfy `retainUntil`); Azure
  Blob immutable-storage later. Lets buyers avoid AWS; R2 stays cheap-egress.

### 2B. Jobs — `JobQueue` → **ADR-0124**

- **pg-boss** (runs on the Postgres the buyer already has — lowest-friction self-host, no new infra) +
  BullMQ/Redis (Redis shops) + Inngest (serverless). Trigger.dev stays the managed default.

### 2C. Inference backends → **ADR-0125**

- **AWS Bedrock** + **Azure OpenAI** (enterprise procurement reality) + **Ollama** (local-first
  edition's natural self-host backend). Extend `ai-config` enum + `ai-kit` transports + embedder.

---

## Tier 3 — nice-to-have

- **Billing** (ADR-0126): LemonSqueezy / Polar MoR alternatives to Paddle.
- **Chat** (ADR-0127): Slack + Telegram support-bot drivers (extract a `ChatPlatform` port first).
- **MCP HTTP transport** (ADR-0128): SSE/HTTP transport beside stdio for remote MCP.
- **Observability**: OTLP/gRPC exporter option (already swappable via `OTEL_EXPORTER_OTLP_ENDPOINT`).
- **DB**: explicit Supabase driver; Neon-serverless-HTTP **only if** reconcilable with the
  transaction-scoped `withTenant` RLS model (it needs TCP transactions — the reason for Railway PG).

---

## Build waves (proposed execution order)

| Wave  | Items                                                                | Effort | Gate                                          |
| ----- | -------------------------------------------------------------------- | ------ | --------------------------------------------- |
| **A** | 1A email (SMTP+SES) · 2A R2 storage · 2B pg-boss · 1D analytics port | S      | lands fast, no infra deps                     |
| **B** | 1B KMS wiring (AWS first) · 1C WorkOS SSO                            | M      | edition-critical; needs AWS/WorkOS test creds |
| **C** | 2C Bedrock/Azure/Ollama inference · storage GCS/Azure · jobs BullMQ  | M      | —                                             |
| **D** | Tier 3 (billing/chat/MCP-http/db)                                    | M      | lowest priority                               |

Each wave: lock its ADR(s) → build drivers in worktree-isolated parallel agents → port-conformance +
round-trip tests → integrate → gate. Drivers are inert (env-gated) until the operator supplies creds,
so merging a wave never changes runtime behavior.

## Open picks (operator-owned, do NOT pre-bind)

- Which SSO vendor leads Tier 1C (WorkOS vs Clerk vs Auth0) — recommend **WorkOS** (SAML/SCIM, on-brand
  with compliance).
- Whether to build **all** KMS providers in 1B or AWS-only first (recommend AWS-only, then GCP/Azure on demand).
- Test-cred availability for KMS / SES / WorkOS (needed to exercise the live transports in CI; today
  all live transports are CI-dormant by design).
