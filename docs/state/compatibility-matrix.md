---
updated: 2026-09-24
status: live
grounds:
  - packages/tenancy-rls/src/drizzle.ts
  - packages/cli/templates/
  - packages/ai-config/src/config.ts
  - packages/ai-kit/src/providers.ts
  - packages/billing/src/provider.ts
  - packages/org-controls/src/workos.ts
  - packages/org-controls/src/clerk.ts
  - packages/jobs/src/bullmq.ts
  - services/support-bot/src/caisson_support_bot/chat_slack.py
  - docs/state/adapter-expansion.md
---

# Compatibility matrix — what a generated repo actually works with

**Current-state snapshot**, not a roadmap — `docs/state/adapter-expansion.md` is the roadmap doc and
is **partially stale** as of this writing (see §6). This file exists to answer one question:
_"if I buy Caisson, what stacks/providers/tools does it actually work with today?"_ — grounded in
code, split by what a **buyer's generated repo** gets vs what's specific to **Caisson's own**
internal build/deploy (buyers never get Railway/Grafana/SigNoz — those aren't shipped).
The buyer-facing rendering of this file is the site's `/stack-fit` page (per-module DB posture
via `apps/site/lib/stack-fit.ts` `MODULE_DB_POSTURE`, drift-pinned by test — shipped 2026-07-07).

## 1. The floor — every generated repo, any edition

| Dimension         | Supported today                                                                                                                                                                                                                                                                                                                                                                                                                       | Not yet                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web framework** | Framework-agnostic by default: the edition templates ship no web framework and buyers bring their own HTTP host. Opt-in `--framework next` adds a Next.js starter (`packages/cli/templates/framework/next/`, ADR-0287 — added 2026-07-07; its `src/lib/db.ts` builds the pool through `@caisson/tenancy-rls`'s `createPgPool`)                                                                                                        | react-only/hono/express starters — bring your own                                                                                                                                                                                                                   |
| **Database**      | Postgres, raw SQL + RLS (`packages/tenancy-rls`, `@caisson/migrate`) + **Drizzle and Prisma bridges over the TenantExecutor port** (`tenancy-rls/src/{drizzle,prisma}.ts`, ADR-0266 — added 2026-07-06). Alternate driver: Supabase session-mode pooler (`tenancy-rls/src/supabase.ts`)                                                                                                                                               | **MySQL: no lane, LOCKED** (ADR-0281 — DB-enforced RLS isolation is the product; Postgres required, revisit is demand-driven + must name the weaker posture); SQLite-server/Mongo not supported; RLS DDL stays raw-SQL canonical (drizzle-kit can't emit FORCE RLS) |
| **Auth**          | Provider-agnostic core — EdDSA-JWT + session + membership, zero vendor deps (`packages/auth`). Optional WorkOS SSO transport (SAML/SCIM, `packages/org-controls/src/workos.ts` — carved out of auth by the ADR-0257 W1 org-controls extraction) + **Clerk session-verification driver** (JWT v2 against Clerk's JWKS, networkless when a public key is configured — `packages/org-controls/src/clerk.ts`, ADR-0287, added 2026-07-07) | Auth0/Okta as a first-class driver                                                                                                                                                                                                                                  |
| **Billing**       | One `BillingProvider` port, four drivers coded: Stripe, Paddle, LemonSqueezy, Polar (`packages/billing/src/provider.ts`; the optional `createDiscount` mint method is Paddle-only — the other drivers simply omit it, ADR-0320)                                                                                                                                                                                                       | n/a — all four majors already coded                                                                                                                                                                                                                                 |
| **Jobs**          | Trigger.dev, pg-boss, **BullMQ/Redis** + in-memory (`packages/jobs/src/{trigger-driver,pgboss,bullmq}.ts`, ADR-0173/ADR-0287; in-service scheduler ADR-0256) — BullMQ added 2026-07-07                                                                                                                                                                                                                                                | Inngest                                                                                                                                                                                                                                                             |
| **Email**         | Five drivers: Resend, **SMTP-generic, AWS SES, Postmark** + Capture (`packages/email/src/{email,smtp,ses,postmark}.ts`, ADR-0170) — corrected 2026-07-06                                                                                                                                                                                                                                                                              | n/a — the majors are coded                                                                                                                                                                                                                                          |
| **Observability** | Vendor-neutral OTel, inert until `OTEL_EXPORTER_OTLP_ENDPOINT` is set (`packages/observability`)                                                                                                                                                                                                                                                                                                                                      | n/a — bring your own backend (Grafana/SigNoz/Honeycomb/etc.)                                                                                                                                                                                                        |
| **Analytics**     | **RETIRED 2026-08-18 (ADR-0410).** The server-side `AnalyticsProvider` port (ADR-0287, added 2026-07-07) never acquired a consumer and is deleted + module-delisted. `apps/site`'s own client-side Plausible/PostHog page-tracking init (`components/{plausible,posthog}-init.tsx`) is unaffected and remains the live path                                                                                                           | n/a — port retired                                                                                                                                                                                                                                                  |
| **Chat/support**  | The buyer-facing `services/support-bot` escalation-notify seam is driver-selected (ADR-0287, added 2026-07-07): Discord (default, reuses the live channel) or **Slack** (`ChatPlatform` port, `services/support-bot/src/caisson_support_bot/chat_slack.py`, config-gated via `chat_platform=slack`). The bot's own `/ask`/`#ask-ai` surface stays Discord-native                                                                      | Telegram; a Slack-native slash-command/listener surface (today Slack is escalation-notify only)                                                                                                                                                                     |
| **Deployment**    | Opt-in `--deploy railway\|fly\|vercel` template family (`packages/cli/templates/deploy/`, ADR-0268 — added 2026-07-06); unselected stays portable-by-omission, byte-identical to before                                                                                                                                                                                                                                               | Render/Netlify/self-host templates; Dockerfiles are starter scaffolds (no server entrypoint in base)                                                                                                                                                                |

## 2. AI Production Kit edition

- **Config lane enum** (`packages/ai-config/src/config.ts`): `openai · anthropic · google · openrouter · local · bedrock · azure-openai · ollama · groq · mistral · together` — 11 lanes (groq/mistral/together added 2026-07-06, Kickoff-F).
- **Live-wired via Vercel AI SDK** (`packages/ai-kit/src/providers.ts`): OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, Google — real `@ai-sdk/*` adapters, SSRF-guarded + `fetchWithTimeout`-bounded.
- **OpenAI-compatible bridge**: OpenRouter, local, Ollama, **Groq, Mistral, Together** ride `@ai-sdk/openai-compatible` — real code path, but CI never exercises it live (self-skipping `live/` tests). The three named paid lanes fail closed on a missing API key (unlike local/ollama's placeholder fallback).
- **Not supported:** any provider outside this list (Cohere, DeepSeek, xAI, etc.) — needs a new `ai-config` lane + a `providers.ts` case.

## 3. Local-first AI edition

- **On-device:** ONNX embedding backend (`packages/local-inference/src/onnx-backend.ts`, dynamic `@huggingface/transformers` import) — real code, never exercised in CI.
- **Rented fallback transports:** OpenRouter, AWS Bedrock, Azure OpenAI.
- **Not supported:** Ollama as a _rented_ transport is deliberately excluded — Ollama is the self-host target, not a rented backend.

## 4. Agentic-Dev edition

- **Sandboxed execution** (`packages/agent-runner`) is provider-agnostic by profile shape, but the only wired profile today is a headless Claude CLI (`CLAUDE_CLI_PROFILE`).
- **Not supported:** JetBrains Junie, Amazon Q, Aider — no emitter target yet (JetBrains/Amazon Q are named near-zero-LOC follow-ups in ADR-0264).

## 5. Compliance edition

- **Frameworks:** SOC2, HIPAA, EU AI Act (`packages/compliance`) — OSCAL v1.2.2 export (JSON + `oscal-cli` XML) across all three.
- **Storage/crypto:** WORM `ArtifactStore` over four backends — S3 Object-Lock (live-proven against the real `caisson-worm` bucket), **GCS Object Retention Lock**, **R2 bucket-locks**, and **Azure Blob immutability** (coded; cloud proofs remain credential-gated where noted in the live checklist) — plus per-tenant field-crypto (HKDF+AES-256-GCM). KMS: AWS live-proven, **GCP Cloud KMS shipped**, and **Azure Key Vault shipped and wired into the hosted site** with purge-protection checks and disposable request-scoped DEKs.

## 6. `adapter-expansion.md` is partially stale — reconcile before quoting it

That doc (authored 2026-06-30) is the internal driver-expansion **roadmap**; several rows it marks
"planned"/"throws" have since shipped in the 2026-07-01/02 build waves and are now **live**, per
this file's own recon:

| Row in `adapter-expansion.md`         | Marked as                         | Actual state (2026-07-06)                                                          |
| ------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| AI inference: Bedrock/Azure/Ollama    | "Add" (Tier 2C, not built)        | **Live** — `ai-kit/src/providers.ts` + `ai-config/src/config.ts`                   |
| `SessionProvider`: WorkOS SSO         | "Add" (Tier 1C)                   | **Live** — `packages/org-controls/src/workos.ts`                                   |
| `KmsClient`: AWS KMS                  | "`awsKmsClient` throws" (Tier 1B) | **Live-proven** — 2026-07-02 real-CMK proof, `docs/build-state.md`                 |
| `BillingProvider`: LemonSqueezy/Polar | "Add" (Tier 3)                    | **Already coded** — `packages/billing/src/{lemonsqueezy-webhook,polar-webhook}.ts` |
| MCP transport: HTTP/SSE               | "stdio only" (Tier 3)             | **Both exist** — `mcp-server/src/{stdio,http}.ts` (ADR-0161)                       |

Still genuinely open after the later Azure adapter wave: Vault Transit KMS, additional job-queue
drivers beyond the shipped set, and chat drivers beyond Discord/Slack. `adapter-expansion.md`
remains a historical roadmap; this matrix is the current compatibility truth.

## 7. ADR-0287 catalog wave-1 S-effort driver batch (2026-07-07)

Four S-effort drivers landed same-day, per the compat-research picker (`outputs/archive/research/admin-intel-catalog-roadmap-memo-2026-07-07.md`): the analytics port (since retired, ADR-0410), Clerk auth, BullMQ jobs, and the Slack ChatPlatform driver — each folded into its row above rather than repeated here. None enter the sellable registry index (`packages/analytics` was open-Base infra, not a sold module, and is now retired; the other three extend already-indexed/non-indexed packages without a manifest change).

## Sources

Recon dated 2026-07-06 against `main`, updated for the 2026-08-09 reference-app retirement: `packages/cli/templates/*/package.json`,
`packages/tenancy-rls/src/{rls,supabase}.ts`, `packages/auth/src/{session,workos}.ts`,
`packages/billing/src/provider.ts`, `packages/ai-config/src/config.ts`, `packages/ai-kit/src/providers.ts`,
`packages/local-inference/src/*.ts`, `packages/agent-runner/src/agent-runner.ts`,
`packages/mcp-server/src/{stdio,http}.ts`, `packages/observability/src/observability.ts`,
`docs/state/adapter-expansion.md`, `docs/build-state.md` (2026-07-02 live-proof banner). ADR-0287 wave
(2026-07-07): `packages/org-controls/src/clerk.ts`, `packages/jobs/src/bullmq.ts`,
`services/support-bot/src/caisson_support_bot/chat_slack.py`. Re-read 2026-09-24 against `a620da44`:
the template tree changed only in Bun base images (1.4.2, digest-pinned), the Next template's
`@caisson/*` pins after the 2026-09-16 version cut, and its pool construction — no row above moved.
