---
updated: 2026-07-11
status: live
---

# Go-live: legal, entity & launch-blocker checklist

Operator-actionable prep for taking Caisson from "deployed but gated" to "can take a real
payment." Companion to `docs/state/production-readiness.md` (build/deploy state) — this file owns the
**business/legal + launch-flip** surface. **Not legal/tax advice; confirm specifics with a
GA CPA + the GA SOS before filing.** Operator is **Atlanta, Georgia** (not CA — the CA
$800 franchise-tax math does NOT apply).

## Entity — Georgia

**Caisson Software LLC** (GA, member-managed, single member, Northwest Registered Agent;
membership omitted from the state filing) formed 2026-07-06, ahead of first sale. Facts, EIN
cheat sheet, operating-agreement brief, and the approval → EIN → OA → Mercury →
Paddle-production order of operations: `docs/business/caisson-software-llc.md`. Paddle
production proceeds as business type **Private** (entity).

## Legal docs — minimal launch stack (Paddle MoR + CalOPPA/GDPR reality)

Paddle (as Merchant-of-Record) requires ON THE SITE before go-live:

- **Terms & Conditions** — must carry the Paddle MoR attribution line verbatim
- **Refund policy**
- **Buyer support details** (email + contact)
- Seller/brand name visible

Plus, independent of Paddle:

- **Privacy Policy** — required day one (any site reachable from CA → CalOPPA; and Caisson processes
  auth/billing/audit data, so it's also a buyer trust signal)
- **Cookie consent banner** — **RESOLVED, no banner needed.** Plausible runs cookieless
  site-wide. PostHog is scoped to the authenticated `/dashboard` only (never the marketing
  layout, `components/posthog-init.tsx`) and now runs `persistence: "memory"` — no cookie, no
  localStorage, state lives only for the page's lifetime (`chore/site-content-tail`). Ruled
  out `cookieless_mode: "always"` instead: that mode forbids `identify()`, which would break
  the account-linked analytics PostHog exists for on the dashboard.
- **DPA (Data Processing Agreement) — have a template ready at launch.** Not legally forced for early
  B2C, but Caisson's buyer _is_ the audit-focused technical founder — they will ask early, and
  "already have one" is on-brand for a product selling compliance rigor. No-DPA = lost enterprise deal.

Tooling: Termly / iubenda generate Privacy + ToS + Refund + cookie banner in ~1hr for ~$10–30/mo.
Given the brand ("evidence-forward, not boilerplate"), the ToS deserves a real pass, not pure generator output.

**Defer:** MSA/enterprise contract (until a buyer wants custom terms) · SOC 2 report (~$10–30k,
3–6 mo; enterprise procurement, post-v1) · Delaware C-corp conversion (only if raising VC).

## Launch-blocker checklist (the go-live-execution phase — from the pre-merge recon)

These BLOCK a real sale and are **operator-owned** (I can't do them from the box):

1. **Paddle SANDBOX → production** — obtain live `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` /
   `PADDLE_CLIENT_TOKEN`; today's box vars are sandbox-scoped. **Hard blocker** — a completed checkout
   grants nothing until this + the (already-built) webhook route run against live creds.
2. **Cloudflare Access flip** off `caisson.sh`/`www` (ADR-0107) — the deliberate launch act; do only
   after checkout works + Compliance is buyable.
3. ~~**Discord** — enable GUILD_MEMBERS + MESSAGE_CONTENT privileged intents~~ **DONE 2026-07-11**
   (verified). Residual: confirm `SUPPORT_CHANNEL_ID`/`MEMBER_ROLE_ID` and the bot-role scope-down
   at launch.
4. **Rotate the leaked Discord/OpenRouter creds** — **DONE 2026-07-08** (`OPENROUTER_API_KEY` split
   into six per-service keys, `DISCORD_TOKEN` regenerated; see
   `docs/archive/operator-runbook-2026-07-08.md` Phase 1.1/1.2 and `docs/deploy/STATE.md`'s
   2026-07-08 entry). Only `MIRROR_PUSH_TOKEN` rotation is still open (runbook Phase 1.3).
5. Legal stack (above) live on the site + the Paddle attribution line.

Box-drivable go-live tail (I do these): mount/verify is already built (webhook route exists,
ADR-0108/0110); post-merge redeploys (`railway up -s …`); registry 32-index confirm; doc-hygiene sweep.

## Why this doc exists

Consolidates the entity/legal research (GA-corrected 2026-07-01) with the recon's operator-owned
go-live blockers, so the path from "deployed" to "first sale" is one checklist. The code mechanism
(billing/entitlement/license/registry/dashboards/bot) is already built + deployed; what remains is
credentials + one launch-flip + legal content — not architecture.
