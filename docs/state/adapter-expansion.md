---
updated: 2026-08-09
status: live
---

# Adapter / driver expansion — buildout roadmap

Status: **partially shipped, reconciled 2026-07-07** · authored 2026-06-30 (operator directed
full buildout of all tiers + un-wired seams). Source: the 2026-06-30 external-provider
inventory. This is a roadmap doc (under `docs/state/`); each port-family expansion locks an
**ADR** in `knowledge/decisions/` before code, per the spec-first cadence. The 0119+ ADR
numbers penciled below were **never used** — the actual locks landed under other numbers
(see the reconcile block).

**2026-07-07 (ADR-0287):** analytics port, Clerk auth, BullMQ jobs, and the Slack `ChatPlatform`
driver all shipped — folded into the inventory table below. Current ship state for every port:
`docs/state/compatibility-matrix.md`.

**2026-07-06 (ADR-0265 doc-correction pass):** most Tier 1/2 rows below shipped in the
2026-06-30/07-01 Stage-2 wave, same day this doc was authored. The `ArtifactStore` R2 "~trivial
S3-compat reuse" premise below is WRONG (R2 has no S3 Object Lock) — corrected by ADR-0267 (GCS
Bucket Lock + R2 bucket-locks API). Launch gating per transport: `docs/ops/live-transport-checklist.md`.

**Kickoff-F wave (2026-07-06)** shipped ArtifactStore GCS+R2 (ADR-0267), GCP KMS (ADR-0171),
Drizzle/Prisma bridges (ADR-0266), groq/mistral/together AI lanes, 3 emitter targets, and deploy
templates (ADR-0268) — folded into the inventory table below.

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

| Port                           | File:line                                                                         | Drivers today                                                                                                   | Add                                                                                                                                     | Tier     |
| ------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `Emailer`                      | `packages/email/src/email.ts:15`                                                  | Resend (`:53`), Capture (test)                                                                                  | **SMTP-generic**, **AWS SES**, Postmark                                                                                                 | 1        |
| `KmsClient` + license `Signer` | `packages/field-crypto/src/kms.ts:30` · `packages/license-issue/src/signer.ts:47` | Local; **AWS, GCP, and Azure Key Vault SHIPPED** (AWS live-proven; Azure is the hosted-site production backend) | HashiCorp Vault                                                                                                                         | 1 (seam) |
| `SessionProvider`              | `packages/auth/src/session.ts:17`                                                 | better-auth; **WorkOS** SSO + **Clerk** session-verification (`org-controls/src/{workos,clerk}.ts`)             | Auth0/Okta                                                                                                                              | 1        |
| `ArtifactStore`                | `packages/audit-worm/src/store.ts:35`                                             | S3 (`store.s3.ts`), Local                                                                                       | GCS Bucket Lock + R2 bucket-locks per **ADR-0267** (the old "R2 S3-compat ~trivial" claim was WRONG — no Object Lock on R2), Azure Blob | 2        |
| `JobQueue`                     | `packages/jobs/src/queue.ts:26`                                                   | Trigger.dev (`trigger-driver.ts:52`), pg-boss, **BullMQ** (`bullmq.ts`, ADR-0287), InMemory                     | Inngest                                                                                                                                 | 2        |
| AI inference                   | `packages/ai-config/src/config.ts:11` · `packages/ai-kit/src/providers.ts:20`     | openai, anthropic, google, openrouter, local                                                                    | **AWS Bedrock**, **Azure OpenAI**, **Ollama**                                                                                           | 2        |
| `BillingProvider`              | `packages/billing/src/provider.ts:23`                                             | Stripe (`:38`), Paddle (`:109`)                                                                                 | LemonSqueezy, Polar                                                                                                                     | 3        |
| `ChatPlatform` (support-bot)   | `services/support-bot/.../escalation.py:44`                                       | Discord (`bot.py`), **Slack** (`chat_slack.py`, ADR-0287) — escalation-notify only, config-selected             | Telegram; a Slack-native slash-command/listener surface                                                                                 | 3        |
| MCP transport                  | `packages/mcp-server/src/stdio.ts:24`                                             | stdio only                                                                                                      | **HTTP/SSE transport** (remote MCP)                                                                                                     | 3        |
| Observability                  | `packages/observability/src/observability.ts:79`                                  | OTLP/HTTP single                                                                                                | OTLP/gRPC option (already backend-swappable via endpoint)                                                                               | 3        |
| `Transactor` (DB)              | `packages/tenancy-rls/src/rls.ts:21`                                              | node-postgres/Neon (inject), PGlite (test), sqlite (local-first)                                                | Supabase explicit; Neon-serverless-HTTP **only if** RLS-tx model allows (needs TCP tx — careful)                                        | 3        |
| `Embedder`                     | `packages/local-store/src/embedder.ts:14`                                         | OpenRouter (prod), Fake (ci)                                                                                    | (already covered by inference expansion; Bedrock/Azure/local embed)                                                                     | 2        |

---

## Tier 1 — sells editions / unblocks enterprise

### 1A. Email multi-driver — `Emailer` → **ADR-0119**

_(Real lock: **ADR-0170**, not the `0119` pencil in this heading — see
`docs/state/decisions-and-forks.md`'s ADR-0119 clarification note for the unrelated board placeholder.)_

- Add **SMTP-generic** (nodemailer-style, universal catch-all — any buyer mail host) + **AWS SES**
  (cheap enterprise scale) + Postmark (transactional reliability).
- Drivers: `packages/email/src/{smtp,ses,postmark}.ts`; env-gated factories; `EMAIL_DRIVER` selector
  or inject. Round-trip: send→capture conformance test across all drivers.
- Unblocks: any buyer with an existing mail stack or data-residency rule (Resend-only blocks them).

### 1B. KMS wiring — `KmsClient` + license `Signer` port → **ADR-0120**

- **SHIPPED:** AWS KMS, GCP KMS, and Azure Key Vault implement the envelope-encryption port. The
  hosted site uses Azure through an explicit `ClientSecretCredential`, purge protection, version-pinned wrapped
  DEKs, bounded provider calls, an append-only Postgres wrapped-DEK store, and disposable request
  contexts.
- License issuance retains the general `Signer` port for a buyer-supplied asymmetric KMS adapter;
  the unused specialized `KmsSigner` interface was retired. HashiCorp Vault is the remaining
  on-demand field-crypto backend.

### 1C. Enterprise auth / SSO — `SessionProvider` → **ADR-0121** (WorkOS) / **ADR-0287** (Clerk)

- **WorkOS driver → SHIPPED** (SAML + SCIM + directory sync, `org-controls/src/workos.ts`).
- **Clerk driver → SHIPPED 2026-07-07** (`org-controls/src/clerk.ts`, ADR-0287): session-token
  verification (JWT v2) against Clerk's JWKS, networkless when a public key is configured;
  stateless claims mapping onto the kernel's session shape — a Clerk Organization maps to an
  account/role, a personal session falls back to the product's own single-user convention.
- Still open: Auth0/Okta. Better-auth stays the default OSS driver; SSO is the commercial lane.

### 1D. Analytics port + env-gate (fixes a live bug) → **ADR-0122** (env-gate) / **ADR-0287** (port)

- The env-gate **DONE** (`apps/site/components/plausible-init.tsx` reads
  `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, no-ops when unset — `936f54f`).
- The port **SHIPPED 2026-07-07** and was **RETIRED 2026-08-18** (ADR-0410 — never acquired a
  consumer; the package is deleted and module-delisted). Historical shape: `AnalyticsProvider.capture`
  with a capture (test) driver plus Plausible / PostHog / GA4 production drivers — server-side
  event capture, fail-open by design. This is a distinct surface from `apps/site`'s own
  client-side Plausible/PostHog page-tracking init, which is unchanged.

---

## Tier 2 — broadens deployment targets

### 2A. Storage — `ArtifactStore` → superseded by **ADR-0267** (2026-07-06)

- ~~**Cloudflare R2** (S3-compatible → reuse `S3ArtifactStore` with `endpoint`+creds, ~trivial)~~
  **WRONG PREMISE** — R2 has no S3 Object Lock and `ArtifactStore` is a WORM-contract port.
  Corrected scope per ADR-0267: **GCS Bucket Lock** driver + an **R2 driver on Cloudflare's
  bucket-locks API** (fail-closed when the bucket rule can't satisfy `retainUntil`); Azure
  Blob immutable-storage later. Lets buyers avoid AWS; R2 stays cheap-egress.

### 2B. Jobs — `JobQueue` → **ADR-0124** (pg-boss) / **ADR-0287** (BullMQ)

- **pg-boss → SHIPPED** (runs on the Postgres the buyer already has — lowest-friction self-host,
  no new infra).
- **BullMQ/Redis → SHIPPED 2026-07-07** (`packages/jobs/src/bullmq.ts`, ADR-0287): Redis shops.
  Idempotent retries map to a native job id; overlap-safety maps to BullMQ's Simple-Mode
  deduplication; cron scheduling maps to a job scheduler.
- Still open: Inngest (serverless). Trigger.dev stays the managed default.

### 2C. Inference backends → **ADR-0125**

- **AWS Bedrock** + **Azure OpenAI** (enterprise procurement reality) + **Ollama** (local-first
  edition's natural self-host backend). Extend `ai-config` enum + `ai-kit` transports + embedder.

---

## Tier 3 — nice-to-have

- **Billing** (ADR-0126): LemonSqueezy / Polar MoR alternatives to Paddle.
- **Chat** (ADR-0127 pencil / **ADR-0287** actual lock): the `ChatPlatform` port extraction +
  **Slack driver → SHIPPED 2026-07-07** (`chat_slack.py`) — escalation-notify only, config-selected
  (`chat_platform=discord|slack`); the bot's `/ask`/`#ask-ai` surface stays Discord-native. Telegram
  still open.
- **MCP HTTP transport** (ADR-0128): SSE/HTTP transport beside stdio for remote MCP.
- **Observability**: OTLP/gRPC exporter option (already swappable via `OTEL_EXPORTER_OTLP_ENDPOINT`).
- **DB**: explicit Supabase driver; Neon-serverless-HTTP **only if** reconcilable with the
  transaction-scoped `withTenant` RLS model (it needs TCP transactions — the reason for Railway PG).

---

## Build waves (proposed execution order)

| Wave  | Items                                                                | Effort | Gate                                                                                           |
| ----- | -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| **A** | 1A email (SMTP+SES) · 2A R2 storage · 2B pg-boss · 1D analytics port | S      | lands fast, no infra deps — **DONE**                                                           |
| **B** | 1B KMS wiring (AWS first) · 1C WorkOS SSO                            | M      | edition-critical; needs AWS/WorkOS test creds — **DONE**                                       |
| **C** | 2C Bedrock/Azure/Ollama inference · storage GCS/Azure · jobs BullMQ  | M      | — **DONE** (BullMQ shipped 2026-07-07, ADR-0287)                                               |
| **D** | Tier 3 (billing/chat/MCP-http/db)                                    | M      | lowest priority — **Chat/Slack shipped 2026-07-07 (ADR-0287); billing/MCP-http/db still open** |

Each wave: lock its ADR(s) → build drivers in worktree-isolated parallel agents → port-conformance +
round-trip tests → integrate → gate. Drivers are inert (env-gated) until the operator supplies creds,
so merging a wave never changes runtime behavior.

## Open picks (operator-owned, do NOT pre-bind)

- **SSO vendor (§1C) — RESOLVED, not a single pick.** Both **WorkOS** (SAML/SCIM directory sync,
  ADR-0172) and **Clerk** (session-token verification, ADR-0287) **SHIPPED**. Genuinely open: whether
  Auth0/Okta is worth a third driver, on enterprise demand.
- **KMS providers (§1B) — RESOLVED, not AWS-only.** **AWS** (live-proven, ADR-0171), **GCP**, and
  **Azure Key Vault** (hosted production, ADR-0387/0389) are shipped. Genuinely open: HashiCorp Vault,
  build on demand.
- Test-cred availability for SES / WorkOS / Clerk (needed to exercise the remaining live transports in
  CI; AWS KMS is already real-CMK live-proven — most others stay CI-dormant by design).
