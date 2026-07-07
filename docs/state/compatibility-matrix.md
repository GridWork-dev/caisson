---
updated: 2026-07-07
status: live
grounds:
  - packages/tenancy-rls/src/drizzle.ts
  - packages/cli/templates/
  - packages/ai-config/src/config.ts
  - packages/ai-kit/src/providers.ts
  - packages/billing/src/provider.ts
  - packages/org-controls/src/workos.ts
  - packages/agent-dev/src/emitter.ts
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

| Dimension         | Supported today                                                                                                                                                                                                                                                                         | Not yet                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web framework** | Framework-agnostic. No template ships next/react/hono/express (`packages/cli/templates/*/package.json`); reference wiring is raw `Bun.serve` (`apps/base/src/server.ts`)                                                                                                                | n/a — bring your own                                                                                                                                                                                                                                                |
| **Database**      | Postgres, raw SQL + RLS (`packages/tenancy-rls`, `@caisson/migrate`) + **Drizzle and Prisma bridges over the TenantExecutor port** (`tenancy-rls/src/{drizzle,prisma}.ts`, ADR-0266 — added 2026-07-06). Alternate driver: Supabase session-mode pooler (`tenancy-rls/src/supabase.ts`) | **MySQL: no lane, LOCKED** (ADR-0281 — DB-enforced RLS isolation is the product; Postgres required, revisit is demand-driven + must name the weaker posture); SQLite-server/Mongo not supported; RLS DDL stays raw-SQL canonical (drizzle-kit can't emit FORCE RLS) |
| **Auth**          | Provider-agnostic core — EdDSA-JWT + session + membership, zero vendor deps (`packages/auth`). Optional WorkOS SSO transport (SAML/SCIM, `packages/org-controls/src/workos.ts` — carved out of auth by the ADR-0257 W1 org-controls extraction)                                         | Clerk, Auth0/Okta as first-class drivers                                                                                                                                                                                                                            |
| **Billing**       | One `BillingProvider` port, four drivers coded: Stripe, Paddle, LemonSqueezy, Polar (`packages/billing/src/provider.ts`)                                                                                                                                                                | n/a — all four majors already coded                                                                                                                                                                                                                                 |
| **Jobs**          | Trigger.dev, **pg-boss** + in-memory (`packages/jobs/src/{trigger-driver,pgboss}.ts`, ADR-0173; in-service scheduler ADR-0256) — corrected 2026-07-06, was wrongly "not yet"                                                                                                            | BullMQ/Redis, Inngest                                                                                                                                                                                                                                               |
| **Email**         | Five drivers: Resend, **SMTP-generic, AWS SES, Postmark** + Capture (`packages/email/src/{email,smtp,ses,postmark}.ts`, ADR-0170) — corrected 2026-07-06                                                                                                                                | n/a — the majors are coded                                                                                                                                                                                                                                          |
| **Observability** | Vendor-neutral OTel, inert until `OTEL_EXPORTER_OTLP_ENDPOINT` is set (`packages/observability`)                                                                                                                                                                                        | n/a — bring your own backend (Grafana/SigNoz/Honeycomb/etc.)                                                                                                                                                                                                        |
| **Deployment**    | Opt-in `--deploy railway\|fly\|vercel` template family (`packages/cli/templates/deploy/`, ADR-0268 — added 2026-07-06); unselected stays portable-by-omission, byte-identical to before                                                                                                 | Render/Netlify/self-host templates; Dockerfiles are starter scaffolds (no server entrypoint in base)                                                                                                                                                                |

## 2. AI Production Kit edition

- **Config lane enum** (`packages/ai-config/src/config.ts`): `openai · anthropic · google · openrouter · local · bedrock · azure-openai · ollama · groq · mistral · together` — 11 lanes (groq/mistral/together added 2026-07-06, Kickoff-F).
- **Live-wired via Vercel AI SDK** (`packages/ai-kit/src/providers.ts`): OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, Google — real `@ai-sdk/*` adapters, SSRF-guarded + `fetchWithTimeout`-bounded.
- **OpenAI-compatible bridge**: OpenRouter, local, Ollama, **Groq, Mistral, Together** ride `@ai-sdk/openai-compatible` — real code path, but CI never exercises it live (self-skipping `live/` tests). The three named paid lanes fail closed on a missing API key (unlike local/ollama's placeholder fallback).
- **Not supported:** any provider outside this list (Cohere, DeepSeek, xAI, etc.) — needs a new `ai-config` lane + a `providers.ts` case.

## 3. Local-first AI edition

- **On-device:** ONNX embedding backend (`packages/local-ai/src/inference/onnx-backend.ts`, dynamic `@huggingface/transformers` import) — real code, never exercised in CI.
- **Rented fallback transports:** OpenRouter, AWS Bedrock, Azure OpenAI.
- **Not supported:** Ollama as a _rented_ transport is deliberately excluded — Ollama is the self-host target, not a rented backend.

## 4. Agentic-Dev edition

- **Multi-harness emitter** (`packages/agent-dev/src/emitter.ts`) fans one typed schema to 6 targets (ADR-0264, expanded 2026-07-06): **Claude Code** (`.claude/{agents,skills,rules}/*.md` + `hooks.json`), the **universal `AGENTS.md` base** (read natively by Codex, Cursor, Devin, Zed, Gemini CLI, Copilot coding agent), **Cursor** (`.cursor/rules/*.mdc`, activation-derived `alwaysApply`), **Devin Desktop** (`.devin/rules/` + `.windsurf/rules/` legacy mirror), **GitHub Copilot** (`.github/copilot-instructions.md` + path-scoped `.instructions.md`), **Cline** (`.clinerules/`). Rules/skills carry optional `activation`/`paths`; unrepresentable choices emit fidelity warnings, never silent degradation.
- **Sandboxed execution** (`packages/agent-runner`) is provider-agnostic by profile shape, but the only wired profile today is a headless Claude CLI (`CLAUDE_CLI_PROFILE`).
- **Not supported:** JetBrains Junie, Amazon Q, Aider — no emitter target yet (JetBrains/Amazon Q are named near-zero-LOC follow-ups in ADR-0264).

## 5. Compliance edition

- **Frameworks:** SOC2, HIPAA, EU AI Act (`packages/compliance`) — OSCAL v1.2.2 export (JSON + `oscal-cli` XML) across all three.
- **Storage/crypto:** WORM `ArtifactStore` over three backends — S3 Object-Lock (live-proven against the real `caisson-worm` bucket), **GCS Object Retention Lock** and **R2 bucket-locks** (both coded 2026-07-06 per ADR-0267, self-skipping live proofs awaiting creds; R2's `extendRetention` only works under an `Indefinite` rule) — plus per-tenant field-crypto (HKDF+AES-256-GCM). KMS: AWS live-proven (2026-07-02 real-CMK proof) + **GCP Cloud KMS coded** (ADR-0171 binding, 2026-07-06).

## 6. `adapter-expansion.md` is partially stale — reconcile before quoting it

That doc (authored 2026-06-30) is the internal driver-expansion **roadmap**; several rows it marks
"planned"/"throws" have since shipped in the 2026-07-01/02 build waves and are now **live**, per
this file's own recon:

| Row in `adapter-expansion.md`         | Marked as                         | Actual state (2026-07-06)                                          |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| AI inference: Bedrock/Azure/Ollama    | "Add" (Tier 2C, not built)        | **Live** — `ai-kit/src/providers.ts` + `ai-config/src/config.ts`   |
| `SessionProvider`: WorkOS SSO         | "Add" (Tier 1C)                   | **Live** — `packages/org-controls/src/workos.ts`                   |
| `KmsClient`: AWS KMS                  | "`awsKmsClient` throws" (Tier 1B) | **Live-proven** — 2026-07-02 real-CMK proof, `docs/build-state.md` |
| `BillingProvider`: LemonSqueezy/Polar | "Add" (Tier 3)                    | **Already coded** — `packages/billing/src/{lemonsquery,polar}.ts`* |
| MCP transport: HTTP/SSE               | "stdio only" (Tier 3)             | **Both exist** — `mcp-server/src/{stdio,http}.ts` (ADR-0161)       |

_\*filename per repo convention; verify exact name before citing in a PR._

Still genuinely open after the 2026-07-06 Kickoff-F wave (which shipped GCS/R2 storage, GCP KMS,
Drizzle/Prisma bridges, groq/mistral/together lanes, 3 emitter targets, deploy templates): Azure
Blob storage, job-queue drivers beyond Trigger.dev/pg-boss, Azure/Vault KMS, chat drivers beyond
Discord. `adapter-expansion.md` carries the reconcile (ADR-0265 doc-correction pass).

## Sources

Recon dated 2026-07-06 against `main`: `packages/cli/templates/*/package.json`, `apps/base/src/server.ts`,
`packages/tenancy-rls/src/{rls,supabase}.ts`, `packages/auth/src/{session,workos}.ts`,
`packages/billing/src/provider.ts`, `packages/ai-config/src/config.ts`, `packages/ai-kit/src/providers.ts`,
`packages/local-ai/src/inference/*.ts`, `packages/agent-dev/src/emitter.ts`, `packages/agent-runner/src/agent-runner.ts`,
`packages/mcp-server/src/{stdio,http}.ts`, `packages/observability/src/observability.ts`,
`docs/state/adapter-expansion.md`, `docs/build-state.md` (2026-07-02 live-proof banner).
