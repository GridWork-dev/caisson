# Design reference layer — pinned galleries + motion catalog (Kickoff-S task 13, $0)

**Date:** 2026-07-13 · **Session:** Kickoff-S design-motion · **Refero quota at check:**
64/8,000 calls this month (0.8% — far under the 50% hard stop; Mobbin fork stays closed).
Feeds the refero-design research step of every future design phase; the deep curated set
(refero UUIDs + flows for docs/dashboard/motion) lives in
`outputs/archive/research/design-session/refero-screens-motion.md` and stays authoritative.

## Pinned gallery list (the free pre-Refero sweep)

Check these BEFORE spending Refero quota; they answer "what does good look like right now"
for the exact site class caisson sits in:

| Gallery                              | What it's pinned for                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| saaspo.com                           | The broadest live SaaS page-type index (pricing, docs, changelog by pattern)              |
| bestsaaswebdesigns.com/dark          | Dark-mode SaaS specifically — caisson's own register                                      |
| webanatomy.ai (dev-tools scored set) | Scored dev-tool landing anatomy — section-by-section grading to sanity-check ours         |
| refero.design (Pro, 8k calls/mo)     | The deep layer: real product screens + flows + styles — quota-disciplined, research-first |

## Motion-catalog vocabulary (as SHIPPED by ADR-0334 — cite these terms in research briefs)

- **Seal** — one-shot dash-draw + spring-overshoot settle on a proof affordance (WORM lock
  engaging). Shipped: ProofChips reveal, LicenseTokenCard copy-confirm.
- **Descent** — scroll-scrubbed environment response (depth layer + lattice sink + fog
  uniform); the page answers scroll with pressure, not parallax clichés. Shipped: hero exit.
- **Chrome persistence** — cross-document view transitions where nav/logo/footer hold still
  and only content cross-fades; element morphs carry identity across pages (door chip → hero
  eyebrow). Shipped sitewide, Chromium progressive enhancement.
- **Evidence build** — sticky-runway scroll sequencing where the REAL product component
  assembles itself from real data, closing on a real verdict (Linear autonomous-demo · Ramp
  walkthrough · NRK sequencing lineage). Shipped: the Living Chain on /evidence.
- **Weight** — interruptible spring physics on hover-capable pointers, velocity carried
  across retargets (Vercel Ship magnet · Stripe Connect cubes lineage). Shipped: dual doors.
- Register floor: novelty-map discipline (moments never adjacent); pricing, /security,
  legal, checkout forms stay still; reduced-motion always gets the complete rest frame.

## Small probes + trial ledger (statuses at this sitting)

| Lane                               | Status                                                                                                                | Trigger to act                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Stitch trial (task 9)              | **BLOCKED — no `STITCH_API_KEY` in `~/.gridwork/env`; no `system/mcps/stitch.toml` manifest (gw-core owns that leg)** | Key provisioned + gw-core manifest lands → run the half-day pricing-hero variant trial as specced |
| superdesign (task 11)              | Gated — only if Stitch disappoints                                                                                    | Stitch verdict                                                                                    |
| Recraft API lane (task 12)         | **BLOCKED — no `RECRAFT_API_KEY`** (PAYG ~$0.04/img verified by the audit)                                            | Operator provisions key; revisit at 30d telemetry per audit §C                                    |
| FixAEO free scan (task 13 probe)   | Operator step (~5 min, browser) — external validation of shipped llms.txt/robots/schema; never pay (ADR-0254)         | Next operator sitting                                                                             |
| 21st.dev free tier (task 13 probe) | Needs an MCP manifest — gw-core owns `system/mcps/*`                                                                  | gw-core files the manifest + roster row (same-commit invariant)                                   |
| Storybook 10.5 (task 10)           | **DONE — SUCCESS verdict** (see the Kickoff-S PR body; feeds ADR-0330's runtime-axe gate)                             | —                                                                                                 |
| Nicelydone                         | CUT (operator 2026-07-13)                                                                                             | —                                                                                                 |
