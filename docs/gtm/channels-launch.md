---
updated: 2026-07-09
status: live
grounds:
  - knowledge/decisions/ADR-0079-seo-strategy.md
  - knowledge/decisions/ADR-0232-seo-renderer-trigger-glossary-program.md
  - knowledge/decisions/ADR-0235-glossary-program-fork-locks.md
  - knowledge/decisions/ADR-0254-measurement-pair-citation-loop-docs-funnel.md
  - outputs/research/support-strategy.md
  - docs/state/linear-integration.md
  - docs/ops/launch-runbook.md
  - outputs/research/monorepo-bigpicture-2026-07.md
---

# Channels and launch

Distribution bets, the support surface, and the business-level shape of go-live. Runbook mechanics
(Terraform, Paddle catalog swap, credential rotation) stay in `docs/ops/launch-runbook.md` — this
page covers what channel and sequencing decisions are locked, not how to execute them.

## Channel bets

**SEO/AEO: own the dev-kit long-tail, cede the head.** The category head terms (`[framework]
compliance`) are owned by finished platforms (Vanta/Drata) and unwinnable at zero domain
authority; Caisson instead targets the long-tail — "SOC 2 starter kit", "HIPAA boilerplate
Next.js", "self-hosted audit log" — where the CPC is 10–50x every other cluster at low keyword
difficulty (ADR-0079 §1). The engine is a per-framework × per-control content matrix (each control
maps to the actual Caisson code that satisfies it), so uniqueness is structural, not padding
(ADR-0079 §2). Docs themselves are the SEO surface — no separate content team, the existing
Fumadocs tree is the asset (ADR-0079 §3). AI crawlers stay allow-all (blocking measured −73%
ChatGPT citations for zero Googlebot gain) with Cloudflare Content-Signals as the sanctioned
middle ground (ADR-0079 §5) — see the unbuilt-items note below. **The measurement side of this
bet is now wired** (gap #9, ADR-0254, 2026-07-06): a pay-as-you-go probe loop runs the 18-question
canonical set through OpenRouter monthly and appends dated citation snapshots — see
`docs/gtm/aeo-citation-tracking.md`.

**Glossary program: the first and only content program pre-committed.** ADR-0232 set the
build-a-renderer trigger at ~20+ near-identical pages and pre-committed the glossary as the one
candidate that clears it alone — no other content program is authorized to justify the renderer.
ADR-0235 locked all 32 terms, an agent-authored-and-adversarially-verified workflow (compliance
terms 1–10 get the strictest claim-by-claim pass, ADR-0235 Fork B rider), footer-only nav
placement, and curated (not auto-generated) internal linking. All 32 terms are live (PR #121).
This is the proof-of-concept for "content as a built, verified product surface" rather than a
marketing side-channel — the same pattern (research → draft → adversarial verify → operator
merges) is the template for any future programmatic content batch, not just glossary.

**Discord: community moat + AI-bot FAQ absorption.** Discord is treated as a distribution channel
and a durable moat (harder to replicate than the code itself), paired with an AI bot that absorbs
repetitive questions so humans only handle judgment calls (`outputs/research/support-strategy.md`
"Community"). This is now built, not aspirational — see the support-bot surface below.

**Docs as the funnel, not just the manual.** One content artifact — docs + `llms.txt` — is built
to serve three jobs at once: the support bot's retrieval corpus, in-Discord answers, and buyers'
own coding agents reading the repo (`outputs/research/support-strategy.md` "Unifying insight").
Docs-as-demand-channel is real and its conversion path (discover → quickstart → signup) is now
**instrumented** (gap #12, ADR-0254, 2026-07-06 — split assignment, Option C): Plausible owns
the top-of-funnel (a `getting-started` page-goal, `docs_cta_click`, `signup_complete` — all
cookieless extensions of the ADR-0237 F8 event set) and PostHog gains one `account_created`
capture beside the existing `identify(accountId)` on first `/dashboard` mount, carrying a
`signup_source` stitched from a `?ref=` param. The PostHog JS client stays dashboard-only (F8
unchanged). First report artifact: the Plausible goals dashboard for the `caisson.sh` property
(`https://plausible.io/caisson.sh` — configure the `getting-started` page-goal there,
dashboard-side, Starter plan; no code change needed for that half). Full design:
`knowledge/decisions/ADR-0254-measurement-pair-citation-loop-docs-funnel.md` (the same ADR
that closed gap #9's AI-citation loop, `docs/gtm/aeo-citation-tracking.md`).

## The support-bot surface

The Discord support bot (ADR-0105, built in P6) is simultaneously a support-cost reducer and a
channel asset: it answers from the docs-RAG corpus and escalates what it can't handle. As of
ADR-0206 (edition-tails-ops), unresolved escalations post to Linear Triage as a third best-effort
sink alongside Discord-thread and Postgres logging — `services/support-bot`'s `Escalator`, wired
env-gated-off by default (`docs/state/linear-integration.md` "Inbound wiring"). Linear owns the
resulting work item; the bot never writes a decision anywhere — that boundary is binding
(`docs/state/linear-integration.md` "The one boundary that matters").

**Known gap, not yet fixed:** escalation is binary (answer confidently or hand off to a human)
rather than the three-tier confidence gate (high → auto-answer, medium → suggest-to-staff, low →
stay silent and escalate) that best-practice RAG support uses. Tracked as gap #11 in
`gaps-and-plays.md` — parked pending real support volume, since tuning a confidence
threshold needs live traffic to calibrate against.

## Launch sequence — the business view

The mechanical flip (Paddle production catalog, Cloudflare Access gate removal, credential
rotation) is fully specified in `docs/ops/launch-runbook.md` — read that file to execute it.
At the business level, three things must land before or at that flip:

1. **Commerce policy locked today must reach the buyer-facing surfaces before the flip.**
   ADR-0244 (perpetual = 12 months included updates, ~40% renewal for continued updates after) and
   ADR-0245 (credits: pooled rollover, 12-month grant expiry, FIFO burn, $49 top-up per ADR-0222)
   are both accepted but not yet reflected in checkout copy or the EULA — that's a checkout/EULA
   content task gating the same flip window the runbook's §3 pricing-confirm step covers.
2. **Legal content is a hard gate, not a nicety** — Paddle's MoR attribution line and refund policy
   must render on `/legal/terms` before the site goes public (launch-runbook §1 P2, §6 DO-NOT
   list) — verified 2026-07-05.
3. **The catalog shape is now locked.** The catalog-doctrine round closed 2026-07-06 (ADR-0257
   vocabulary · ADR-0258 numbers): editions dissolved into six individually-priced bundles over a
   fully à-la-carte package catalog, live in Paddle SANDBOX (PR #130). The editions/module pricing
   structure referenced throughout this launch sequence (`launch-runbook.md` §2.2's per-edition
   table) still needs a pass to the bundle-era numbers before the production flip — see
   `pricing-packaging.md` for the current six-bundle matrix.

Launch itself is DEPLOY-class and operator-executed, never part of the autonomous build loop
(`docs/ops/launch-runbook.md` header) — this page tracks the channel/business readiness inputs
into that act, not the act itself.

## Named unbuilt items

Two ADR-0079-locked channel items are specced but not shipped, per the ranked gap table in
`outputs/research/monorepo-bigpicture-2026-07.md` §2 (full evidence there; live disposition in
`gaps-and-plays.md`):

- **`build-vs-buy` comparison page** (gap #5) — ADR-0079 explicitly bets on this pattern over
  head-to-head "Vanta alternative" pages (which the ADR's Rejected section rules out as violating
  the honesty-boundary firewall). Company-owned build-vs-buy content wins roughly 51% of B2B-SaaS
  AI citations, more than user-generated and editorial content combined — this is the single
  largest unclaimed AI-citation slot for the category, and the pattern is already designed, just
  not built. Queued for the Kickoff-B hygiene wave.
- **Cloudflare Content-Signals response header** (gap #6) — ADR-0079 §5 locked the
  `search=yes, ai-input=yes` posture as the sanctioned middle ground between full AI-crawler block
  and unsignaled allow-all; the header was never added to `next.config`/response headers. `robots.ts`
  itself is already correct (allow-all except `/dashboard`) — this is the one remaining piece.
  Queued for the Kickoff-B hygiene wave.

Both are small (one page, one header) against work already specced by a locked ADR — they were
found, not re-litigated, by the 2026-07 research sweep.
