# ADR-0287 — Catalog wave-1: S-effort driver batch + Next.js starter template, in parallel

**Status:** accepted · 2026-07-07 (operator-locked, eighth-sitting picker over the catalog leg
of `outputs/research/admin-intel-catalog-roadmap-memo-2026-07-07.md`). Extends ADR-0170/0173
(driver families), ADR-0268 (template family), ADR-0264 (emitter targets). Append-only;
supersede with a later ADR, never edit. **Tags:** `frontend` (template), per-package scopes.

## Context

The compat research ranked twelve value-adds by demand evidence against the current
compatibility matrix. The top strategic gap: every competitor Caisson prices against ships a
wired Next.js app while `packages/cli/templates/*` is raw `Bun.serve`. The top quick wins are
four S-effort drivers on the existing port pattern (driver-beside-driver, DI, env-gated,
round-trip tests).

## Decision

Both tracks run in parallel (isolated worktrees, serial merges):

1. **S-effort driver batch:**
   - **Analytics port** (PostHog + GA4 drivers beside Plausible) — closes the flagged
     `adapter-expansion.md` §1D gap; PostHog is already dogfooded.
   - **Slack `ChatPlatform` driver** — extract the port from the Discord-coupled support-bot
     seam; Slack is the only enterprise-compliant chat option (serves the compliance persona).
   - **Clerk auth driver** — the 2026 Next.js SaaS default; every named competitor has it.
   - **BullMQ/Redis job driver** — the dominant queue; joins Trigger.dev + pg-boss + in-memory.
2. **Next.js starter template** in the `create-caisson` template family (same opt-in shape as
   the ADR-0268 deploy templates): a wired Next.js App-Router app consuming the base substrate
   (auth/tenancy/billing/jobs/email wiring demonstrated), portable-by-omission preserved —
   unselected output stays byte-identical.

## Consequences

- Wave-2 (Inngest, JetBrains/Amazon-Q emitter targets, Render template, Azure Blob WORM,
  Cohere lane, Turso-scoped-to-local-first) queues behind wave-1; Auth0/Okta holds until a
  named deal stalls on it.
- Rejected permanently (cited in the memo): MySQL transactor (ADR-0281), Turso-as-primary,
  DeepSeek/xAI lanes, Netlify template, Vault KMS, Aider emitter.
- The compatibility matrix + stack-fit page re-render after merge (their "Not yet" columns
  shrink) — same-wave doc updates, not a follow-up.
