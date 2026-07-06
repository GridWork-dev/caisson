---
updated: 2026-07-06
status: live
adr: ADR-0265
---

# Live-transport checklist — the launch-gating SOT

One row per live transport (ADR-0265). **Posture: enterprise-ready sweep** — every coded
transport is live-proven or carries an explicit `waived` row before launch; silence is not a
state. Tests follow the ADR-0201 convention (outside `./src`, self-skip without creds, may
mint throwaway resources, run via explicit `test:live`). Creds provisioning is
operator-owned; the "Creds / env" column is the provisioning shopping list.

Statuses: `proven` (live evidence on record) · `unproven-gating` (must prove or waive before
launch) · `waived` (operator-signed exception, dated) · `pending-build` (driver locked this
wave, row activates when it lands).

## Proven (13 transports, evidence 2026-07-02/05)

| Transport                    | Package / test                                                                                               | Creds / env                                                                                                                                   | Last proven |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| OpenRouter chat (gateway)    | `packages/ai-kit` · `live/gateway.live.test.ts`                                                              | `OPENROUTER_API_KEY`                                                                                                                          | 2026-07-02  |
| OpenRouter embeddings        | `packages/ai-kit` · `live/embed.live.test.ts` (`qwen/qwen3-embedding-8b`)                                    | `OPENROUTER_API_KEY`                                                                                                                          | 2026-07-02  |
| OpenRouter rented (local-ai) | `packages/local-ai` · `live/rented.live.test.ts` (Matryoshka truncation + integer metering)                  | `OPENROUTER_API_KEY`                                                                                                                          | 2026-07-02  |
| Azure OpenAI rented          | `packages/local-ai` · `live/rented-drivers.live.test.ts`                                                     | `AZURE_OPENAI_API_KEY` / `_ENDPOINT` / `_EMBEDDING_DEPLOYMENT` / `_COMPLETION_DEPLOYMENT`                                                     | 2026-07-02  |
| AWS Bedrock rented           | `packages/local-ai` · `live/rented-drivers.live.test.ts` (hand-rolled SigV4)                                 | AWS credentials                                                                                                                               | 2026-07-02  |
| ONNX on-device               | `packages/local-ai` · `live/onnx.live.test.ts` (3 legs: tamper fail-closed, self-pin, egress block)          | `CAISSON_ONNX_LIVE` opt-in + HF network; `@huggingface/transformers` installed ad-hoc (~270 MB)                                               | G1-A recipe |
| AWS KMS (field-crypto)       | `packages/field-crypto` · `live/kms.live.test.ts` (5 legs, throwaway CMK mint→shred)                         | `CAISSON_KMS_LIVE` + AWS credentials                                                                                                          | 2026-07-02  |
| S3 WORM Object-Lock          | `packages/audit-worm` · `live/store.s3.live.test.ts` (5 legs on `caisson-worm`, GOVERNANCE)                  | `CAISSON_WORM_LIVE_BUCKET` + AWS credentials                                                                                                  | 2026-07-02  |
| Paddle webhook verify        | `packages/billing` · `live/paddle-webhook.live.test.ts` (Leg A simulator; Leg B Playwright checkout)         | `PADDLE_API_KEY` + `PADDLE_SIM_RECEIVER_URL`/`_PORT`; Leg B: `PADDLE_SANDBOX_CHECKOUT_URL`                                                    | 2026-07-02  |
| Paddle webhook → grant       | `services/license` · `live/webhook-grant.live.test.ts` (end-to-end to deployed license.caisson.sh)           | `PADDLE_WEBHOOK_SECRET` + `DATABASE_URL` + `LICENSE_WEBHOOK_URL` + `PADDLE_PROOF_PRICE_ID`                                                    | 2026-07-02  |
| Discord grant (two seams)    | `services/license` · `live/discord-grant.live.test.ts` + `services/support-bot` `test_billing_grant_live.py` | `SUPPORT_BOT_URL`/`_GRANT_TOKEN` + `DISCORD_PROOF_USER_ID`; bot side `DISCORD_TOKEN`/`GUILD_ID`/`DISCORD_PROOF_ROLE_ID`/`BILLING_GRANT_TOKEN` | 2026-07-02  |
| Grafana Cloud (Tempo)        | `apps/admin` · `live/grafana.live.test.ts`                                                                   | `GRAFANA_URL` + `GRAFANA_QUERY_TOKEN` + `GRAFANA_TEMPO_DATASOURCE_UID`                                                                        | 2026-07-02  |
| Analytics bundle inlining    | `apps/site` · `live/analytics-bundle.live.test.ts` (real `next build`, 600 s budget)                         | `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`                                                                                    | 2026-07-05  |

## Unproven — gating (coded today, zero live evidence; prove or waive per row)

| Transport              | Package (driver)                                                             | Creds / env to provision                                                        | Status                                                      |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| SMTP-generic email     | `packages/email/src/smtp.ts` (ADR-0170)                                      | An SMTP host + auth pair (any provider)                                         | unproven-gating; needs a `live/` test                       |
| AWS SES email          | `packages/email/src/ses.ts` (ADR-0170)                                       | AWS SES creds + verified sender identity                                        | unproven-gating; needs a `live/` test                       |
| Postmark email         | `packages/email/src/postmark.ts` (ADR-0170)                                  | `POSTMARK` server token                                                         | unproven-gating; needs a `live/` test                       |
| WorkOS SSO             | `packages/auth/src/workos.ts` (ADR-0172)                                     | WorkOS test org (SAML/SCIM) + API key — **no test surface exists at all today** | unproven-gating                                             |
| LemonSqueezy billing   | `packages/billing/src/lemonsqueezy.ts` (ADR-0175)                            | LS test-mode store + webhook secret                                             | unproven-gating                                             |
| Polar billing          | `packages/billing/src/polar.ts` (ADR-0175)                                   | Polar sandbox org + webhook secret                                              | unproven-gating                                             |
| Supabase transactor    | `packages/tenancy-rls/src/supabase.ts` (ADR-0174)                            | A Supabase project, session-mode pooler DSN                                     | unproven-gating                                             |
| pg-boss runtime arm    | `packages/jobs/src/pgboss.ts` + `services/license` scheduler (ADR-0173/0256) | Real Postgres + `CREDIT_EXPIRY_SCHEDULE` armed at DEPLOY                        | unproven-gating (integration-tested; prod arm is the proof) |
| Ollama / local AI lane | `packages/ai-kit` `local`/`ollama` cases                                     | A running Ollama host (`baseUrl`)                                               | unproven-gating                                             |
| OpenAI direct lane     | `packages/ai-kit/src/providers.ts` (`openai`)                                | `OPENAI_API_KEY`                                                                | unproven-gating                                             |
| Anthropic direct lane  | `packages/ai-kit/src/providers.ts` (`anthropic`)                             | `ANTHROPIC_API_KEY`                                                             | unproven-gating                                             |
| Google direct lane     | `packages/ai-kit/src/providers.ts` (`google`)                                | Google AI key                                                                   | unproven-gating                                             |
| MCP HTTP/SSE transport | `packages/mcp-server/src/http.ts` (ADR-0161)                                 | None external — a live remote-client round-trip leg                             | unproven-gating                                             |

## Built this wave — rows activated at Kickoff-F integration (2026-07-06)

Self-skipping live tests are in-repo; every row below awaits operator creds to flip to proven.

| Transport               | Package (driver / live test)                                       | Creds / env to provision                                                                                                                           | Status          |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| GCP Cloud KMS           | `packages/field-crypto` · `live/kms-gcp.live.test.ts`              | `CAISSON_KMS_GCP_LIVE` + `CAISSON_KMS_GCP_KEY_RING` (pre-provisioned KeyRing — GCP KeyRings are undeletable) + GCP Application Default Credentials | unproven-gating |
| GCS Object Retention    | `packages/audit-worm` · `live/store.gcs.live.test.ts`              | `CAISSON_GCS_LIVE_BUCKET` + `GOOGLE_APPLICATION_CREDENTIALS` (bucket must have Object Retention Lock enabled)                                      | unproven-gating |
| R2 bucket-locks storage | `packages/audit-worm` · `live/store.r2.live.test.ts`               | `CAISSON_R2_LIVE_BUCKET` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (Edit on bucket lock) + `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`      | unproven-gating |
| Groq lane               | `packages/ai-kit/src/providers.ts` (`groq`, OpenAI-compatible)     | Groq API key                                                                                                                                       | unproven-gating |
| Mistral lane            | `packages/ai-kit/src/providers.ts` (`mistral`, OpenAI-compatible)  | Mistral API key                                                                                                                                    | unproven-gating |
| Together lane           | `packages/ai-kit/src/providers.ts` (`together`, OpenAI-compatible) | Together API key                                                                                                                                   | unproven-gating |

Drizzle/Prisma bridges (ADR-0266) carry no live row — the isolation proof is in-CI PGlite
(`packages/tenancy-rls/src/drizzle.integration.test.ts`); no external transport exists.
Deploy templates (ADR-0268) are inert artifacts — golden-tested, no live row (per that ADR).

## Operator creds shopping list (delta to prove everything above)

SMTP pair · SES + sender identity · Postmark token · WorkOS test org · LemonSqueezy test
store · Polar sandbox · Supabase project · Ollama host · OpenAI/Anthropic/Google keys ·
GCP project (KMS + GCS) · Cloudflare R2 · Groq/Mistral/Together keys. Everything in the
proven table already has working creds on record.
