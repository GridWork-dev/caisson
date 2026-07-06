---
updated: 2026-07-06
status: live
grounds:
  - packages/*/package.json
  - packages/cli/templates/
  - packages/ai-config/src/config.ts
  - packages/ai-kit/src/providers.ts
  - packages/billing/src/provider.ts
  - packages/auth/src/workos.ts
  - packages/agent-dev/src/emitter.ts
  - docs/state/adapter-expansion.md
---

# Compatibility matrix — what a generated repo actually works with

**Current-state snapshot**, not a roadmap — `docs/state/adapter-expansion.md` is the roadmap doc and
is **partially stale** as of this writing (see §6). This file exists to answer one question:
_"if I buy Caisson, what stacks/providers/tools does it actually work with today?"_ — grounded in
code, split by what a **buyer's generated repo** gets vs what's specific to **Caisson's own**
internal build/deploy (buyers never get Railway/Grafana/SigNoz — those aren't shipped).

## 1. The floor — every generated repo, any edition

| Dimension         | Supported today                                                                                                                                                              | Not yet                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Web framework** | Framework-agnostic. No template ships next/react/hono/express (`packages/cli/templates/*/package.json`); reference wiring is raw `Bun.serve` (`apps/base/src/server.ts`)     | n/a — bring your own                                                                |
| **Database**      | Postgres only, raw SQL + RLS, no ORM shipped (`packages/tenancy-rls`, `@caisson/migrate`). Alternate driver: Supabase session-mode pooler (`tenancy-rls/src/supabase.ts`)    | MySQL/SQLite-server/Mongo; any ORM (Drizzle/Prisma are Caisson's own app-only deps) |
| **Auth**          | Provider-agnostic core — EdDSA-JWT + session + membership, zero vendor deps (`packages/auth`). Optional WorkOS SSO transport (SAML/SCIM, `packages/auth/src/workos.ts`)      | Clerk, Auth0/Okta as first-class drivers                                            |
| **Billing**       | One `BillingProvider` port, four drivers coded: Stripe, Paddle, LemonSqueezy, Polar (`packages/billing/src/provider.ts`)                                                     | n/a — all four majors already coded                                                 |
| **Jobs**          | Trigger.dev, **pg-boss** + in-memory (`packages/jobs/src/{trigger-driver,pgboss}.ts`, ADR-0173; in-service scheduler ADR-0256) — corrected 2026-07-06, was wrongly "not yet" | BullMQ/Redis, Inngest                                                               |
| **Email**         | Five drivers: Resend, **SMTP-generic, AWS SES, Postmark** + Capture (`packages/email/src/{email,smtp,ses,postmark}.ts`, ADR-0170) — corrected 2026-07-06                     | n/a — the majors are coded                                                          |
| **Observability** | Vendor-neutral OTel, inert until `OTEL_EXPORTER_OTLP_ENDPOINT` is set (`packages/observability`)                                                                             | n/a — bring your own backend (Grafana/SigNoz/Honeycomb/etc.)                        |
| **Deployment**    | No deploy config shipped in any template (no railway.toml/vercel.json/Dockerfile) — portable by omission                                                                     | No first-party deploy templates yet (Railway/Fly/Vercel one-click)                  |

## 2. AI Production Kit edition

- **Config lane enum** (`packages/ai-config/src/config.ts`): `openai · anthropic · google · openrouter · local · bedrock · azure-openai · ollama` — 8 lanes.
- **Live-wired via Vercel AI SDK** (`packages/ai-kit/src/providers.ts`): OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, Google — real `@ai-sdk/*` adapters, SSRF-guarded + `fetchWithTimeout`-bounded.
- **OpenAI-compatible bridge**: OpenRouter, local, Ollama ride `@ai-sdk/openai-compatible` — real code path, but CI never exercises it live (self-skipping `live/` tests).
- **Not supported:** any provider outside this list (Cohere, Mistral-direct, Groq, etc.) — needs a new `ai-config` lane + a `providers.ts` case.

## 3. Local-first AI edition

- **On-device:** ONNX embedding backend (`packages/local-ai/src/inference/onnx-backend.ts`, dynamic `@huggingface/transformers` import) — real code, never exercised in CI.
- **Rented fallback transports:** OpenRouter, AWS Bedrock, Azure OpenAI.
- **Not supported:** Ollama as a _rented_ transport is deliberately excluded — Ollama is the self-host target, not a rented backend.

## 4. Agentic-Dev edition

- **Multi-harness emitter** (`packages/agent-dev/src/emitter.ts`) fans one typed schema to: **Claude Code** (`.claude/{agents,skills,rules}/*.md` + `hooks.json`), **Codex** (single `AGENTS.md`), **Cursor** (`.cursor/rules/*.mdc`).
- **Sandboxed execution** (`packages/agent-runner`) is provider-agnostic by profile shape, but the only wired profile today is a headless Claude CLI (`CLAUDE_CLI_PROFILE`).
- **Not supported:** Windsurf, GitHub Copilot Workspace, Cline, Aider — no emitter target exists for any of these yet.

## 5. Compliance edition

- **Frameworks:** SOC2, HIPAA, EU AI Act (`packages/compliance`) — OSCAL v1.2.2 export (JSON + `oscal-cli` XML) across all three.
- **Storage/crypto:** S3 Object-Lock WORM (live-proven against the real `caisson-worm` bucket) + per-tenant field-crypto (HKDF+AES-256-GCM). AWS KMS is live-proven (throwaway CMK mint/tag/delete, `docs/build-state.md` 2026-07-02 live-proof paragraph) — despite `adapter-expansion.md` still listing it as a throwing stub (stale, see §6).

## 6. `adapter-expansion.md` is partially stale — reconcile before quoting it

That doc (authored 2026-06-30) is the internal driver-expansion **roadmap**; several rows it marks
"planned"/"throws" have since shipped in the 2026-07-01/02 build waves and are now **live**, per
this file's own recon:

| Row in `adapter-expansion.md`         | Marked as                         | Actual state (2026-07-06)                                          |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| AI inference: Bedrock/Azure/Ollama    | "Add" (Tier 2C, not built)        | **Live** — `ai-kit/src/providers.ts` + `ai-config/src/config.ts`   |
| `SessionProvider`: WorkOS SSO         | "Add" (Tier 1C)                   | **Live** — `packages/auth/src/workos.ts`                           |
| `KmsClient`: AWS KMS                  | "`awsKmsClient` throws" (Tier 1B) | **Live-proven** — 2026-07-02 real-CMK proof, `docs/build-state.md` |
| `BillingProvider`: LemonSqueezy/Polar | "Add" (Tier 3)                    | **Already coded** — `packages/billing/src/{lemonsquery,polar}.ts`* |
| MCP transport: HTTP/SSE               | "stdio only" (Tier 3)             | **Both exist** — `mcp-server/src/{stdio,http}.ts` (ADR-0161)       |

_\*filename per repo convention; verify exact name before citing in a PR._

Still genuinely open (not contradicted by recon): storage drivers beyond S3 (R2/GCS/Azure Blob),
job-queue drivers beyond Trigger.dev, email drivers beyond Resend, GCP/Azure/Vault KMS beyond AWS,
chat drivers beyond Discord. Recommend a fresh pass over `adapter-expansion.md` to flip its stale
rows to "shipped" and re-date it — tracked as a follow-up, not done in this pass (this file is new
documentation, not an edit to that one).

## Sources

Recon dated 2026-07-06 against `main`: `packages/cli/templates/*/package.json`, `apps/base/src/server.ts`,
`packages/tenancy-rls/src/{rls,supabase}.ts`, `packages/auth/src/{session,workos}.ts`,
`packages/billing/src/provider.ts`, `packages/ai-config/src/config.ts`, `packages/ai-kit/src/providers.ts`,
`packages/local-ai/src/inference/*.ts`, `packages/agent-dev/src/emitter.ts`, `packages/agent-runner/src/agent-runner.ts`,
`packages/mcp-server/src/{stdio,http}.ts`, `packages/observability/src/observability.ts`,
`docs/state/adapter-expansion.md`, `docs/build-state.md` (2026-07-02 live-proof banner).
