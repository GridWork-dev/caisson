# ADR-0254 — Measurement pair: pay-as-you-go AI-citation probe loop (repo doc + PostHog) and split-assignment docs funnel

**Status:** accepted · 2026-07-06 (Kickoff-E picker round 3, independent-build-wave session).
Closes research gaps **#9** and **#12** (`docs/gtm/gaps-and-plays.md`, both un-parked by the
2026-07-05 operator call). Extends **ADR-0237 F8** (split analytics — the PostHog JS client stays
dashboard-only; this ADR builds INSIDE that lock, no rider), **ADR-0118** (Plausible cookieless),
**ADR-0236** (consent precedent — nothing here captures free text, so no new consent surface).
Append-only; supersede with a later ADR, never edit. **Tags:** none at lock; the funnel build
touches `apps/site` only within already-audited event paths.

## Decision

### AI-citation tracking loop (gap #9)

1. **Pay-as-you-go only — no monthly-subscription tracker** (operator lock, replacing the
   DIY-vs-paid-tool framing). The loop is scripted probes through the already-sanctioned
   OpenRouter credential (per-token PAYG, ~$1.20/run at 18 questions × 3–4 engines), run
   **monthly** as a GitHub Actions scheduled workflow living in-repo. A PAYG SERP API
   (DataForSEO-class, per-query cents) is evaluated at build for the Google-AI-Overviews leg —
   the one surface model APIs can't reach — and wired **only if** it stays in per-query cents
   with no subscription floor; otherwise the loop ships without AI-Overviews coverage,
   stated honestly in the report. Subscription trackers (Peec $95+/mo, Otterly $189/mo, Ahrefs
   Brand Radar $828+/mo all-in) are rejected at pre-launch volume; revisit only on real traffic.
2. **The 18-question probe set ships as-is** as the canonical list in
   `docs/gtm/aeo-citation-tracking.md` — it doubles as `gw-aeo-strategist`'s category-queries
   input (one doc, not two drifting lists). Amend by editing the doc.
3. **Results land in BOTH sinks**: append-only dated snapshots in
   `docs/gtm/aeo-citation-tracking.md` (the human/agent-readable trend + baseline) and an
   `aeo_citation_probe` PostHog event per probe (engine, query, cited, run_date) for queryable
   time-series. The first real run's baseline snapshot is part of the build's definition of done.

### Docs-conversion funnel (gap #12)

4. **Split assignment (option C), built now** (aligned with the un-park): **Plausible** owns
   top-of-funnel — a quickstart page-goal, a docs-CTA event, and a `signup_complete` custom
   event, all cookieless extensions of the locked F8 event set; **PostHog** gains one
   `account_created` capture beside the existing `identify(accountId)` on first dashboard mount,
   carrying a `signup_source` property stitched from a `?ref=` param — the existing `accountId`
   join key stitches signup→purchase. **The PostHog JS client does not move off `/dashboard`**
   (F8's literal lock holds; option B — PostHog on docs — would need a rider ADR and a consent
   surface, and is rejected). Cross-auth per-visitor joins are structurally impossible with
   cookieless Plausible; the funnel reads as aggregate ratios + referrer attribution, stated
   plainly wherever it's reported.
5. The funnel's first report artifact is a dashboard/goals link recorded in
   `docs/gtm/channels-launch.md`.

## Consequences

- `OPENROUTER_API_KEY` (and any SERP-API key) as a GitHub Actions secret is an operator-visible
  credential placement — flagged at ship, never set silently.
- The Plausible goal definitions are dashboard-side config on the Starter plan; the build
  documents them next to the code events. Plausible's native multi-step funnel UI is not assumed
  (plan-gated); the aggregate-ratio read does not need it.
