# Demand ledger — field traction, pre-launch (2026-07-23 read)

**Compiled:** 2026-07-23 · **Compiler:** Phase-0 evidence collector D · **Snapshot read:**
`/home/gw/lab/caisson-audit-ro` (pinned, read-only) · **Company stage:** PRE-LAUNCH, pre-revenue.

**Purpose.** This is the outreach → reply → interview → demo → waitlist/checkout funnel, by
channel and by ICP segment, as the corpus actually records it — **with explicit zeroes** where
instrumentation or activity is absent. Honesty over completeness: a mostly-zero ledger is the
correct pre-launch reading if that is what the record shows, and it is what the record shows.
No number below is invented or interpolated to fill a gap — every row states its source or
states "no record found."

---

## 0. The one fact that governs every row below

As of the most recent go-live-readiness recon in the corpus
(`outputs/research/w3-flipgate-verification-2026-07-17.md`, dated 2026-07-17):

- **The public OSS mirror repo (`caisson-sh/caisson-oss`) is still PRIVATE.** No public npm
  package has ever shipped. All engineering/technical go-live gates for the free-tier flip are
  GREEN; the flip itself is **HELD on business optics** — the operator is explicitly waiting for
  Mercury (banking) and Paddle (payments) applications to be materially further along before any
  public GTM motion, per that same document's opening line: _"all technical gates GREEN · flip
  HELD on business optics."_
- **Mercury and Paddle are both APPLICATION PENDING** — the "first sale" business gate
  (`docs/business/caisson-internal-master-map.md` §13, cited in the same recon) is explicitly
  NOT closed. There is no live payment processor and no live bank account attached to the
  business as of this reading.
- **The commercial site (`caisson.sh`) sits behind a Cloudflare Access gate.** Every traffic
  number in this ledger inherits that fact.

Every channel row below should be read against this baseline: **Caisson has not yet gone to
market.** The counts that follow are pre-launch preparatory activity (outreach drafted/sent,
research recruited, infrastructure wired), not post-launch acquisition performance.

---

## 1. Outbound design-partner channel (the only channel with any recorded human-to-human send activity)

| Stage                                                            | Count           | Source                                                     | Notes                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidates researched                                            | **30**          | `outputs/research/design-partner-candidates-2026-07-10.md` | 4 segments (A: regulated-SaaS startups, B: agencies, C: compliance-adjacent dev-tools, D: OSS-adjacent TS teams), all public-channel-only research, dated 2026-07-10.                                                                                                                                       |
| Candidates shortlisted for outreach                              | **10**          | `docs/gtm/design-partner-outreach.md`                      | Ranked top-10 of the 30, "High"/"Med-High" confidence only.                                                                                                                                                                                                                                                 |
| Outreach emails drafted (send-ready)                             | **5**           | `docs/gtm/design-partner-outreach-drafts-2026-07-12.md`    | Segment-A top-5 (Legion Health, Confido Legal, Kubera Health, SeedTrust Escrow, Clearest Health), founder-to-founder, drafted 2026-07-12.                                                                                                                                                                   |
| Outreach emails actually SENT                                    | **0 confirmed** | —                                                          | The drafts document includes an explicit "Log" section instruction ("append a `## Log` section" recording sends/replies) — **no such log section exists in the file as read**. No independent send confirmation, reply, or price reaction was found anywhere in the corpus for any of the 5 drafted emails. |
| Replies received                                                 | **0**           | —                                                          | No record found.                                                                                                                                                                                                                                                                                            |
| Interviews/calls booked from outreach                            | **0**           | —                                                          | No record found.                                                                                                                                                                                                                                                                                            |
| Demos given from outreach                                        | **0**           | —                                                          | No record found.                                                                                                                                                                                                                                                                                            |
| Design partners signed (of the 5-slot cohort locked by ADR-0297) | **0 of 5**      | —                                                          | No record found of any signed, discounted, or entitlement-granted design partner anywhere in the corpus.                                                                                                                                                                                                    |

**Reading:** the design-partner program has a fully-built terms sheet (ADR-0297), a fully-drafted
outbound motion (5 send-ready emails), and a locked application surface (`/partners` page,
live since 2026-07-10 per `docs/gtm/design-partner-program.md`) — but the corpus contains no
evidence any of the 5 drafted emails were sent, replied to, or converted. This is the single
most-developed GTM motion in the company and it still reads as zero executed field contact.

---

## 2. Cookiy paid-research recruitment (NOT a GTM/demand channel — a research instrument — listed here only to avoid double-counting it as "interviews with prospects")

| Study                                                             | Recruited / target                                                                         | Real-ICP completes                                                      | Screen-outs                                                                       | Spend                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Study 1 (`019f4a11`, positioning+WTP, launched 2026-07-08)        | 12 of 12 target                                                                            | 12 (real-ICP-adjacent; 2 of 12 explicitly off-fit)                      | not separately logged                                                             | part of the program budget                                                                    |
| Frame-test survey (776545)                                        | 42 of 60 target (final pull)                                                               | 33% (14/42) mapped to any Caisson persona; 66.7% self-ID'd role "Other" | n/a (survey, not screened)                                                        | part of program budget                                                                        |
| Van Westendorp survey (445432)                                    | 26-27 of 60 target                                                                         | 9-10/26-27 ICP-claimed; 3 fully internally-consistent                   | n/a (survey, not screened)                                                        | part of program budget                                                                        |
| Study 2 (`019f57b1`, positioning validation, launched 2026-07-12) | **5 of 12 target — recruit exhausted, OPERATOR-LOCKED STOP at n=5 (2026-07-16, ADR-0352)** | 5 completes; effective usable-quality n≈2–3                             | **4 screen-outs** (reasons not itemized in the corpus — see Evidence ledger E-D8) | ~$122 of the $130 ADR-0328 budget (per `outputs/research/provider-cost-rollup-2026-07-12.md`) |

**Reading:** this is paid third-party recruitment of interview/survey subjects, not organic or
outbound demand — it belongs in this ledger only as a boundary marker: **these are not
prospects in a pipeline; they are paid research participants**, and none of them are a lead, a
waitlist signup, or a design-partner candidate. Treating any of these completes as "demand" would
double-count research spend as market traction. None did.

---

## 3. Website / marketing funnel

| Metric                                                 | Count                                                                 | Source                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Site visitors (30d, PostHog)                           | **~3 unique persons / 12 events**                                     | `outputs/research/provider-cost-rollup-2026-07-12.md`, probed 2026-07-12 | Source explicitly annotates: "site is CF-Access-gated; volume arrives at go-live." This is not organic traffic — it is pre-launch internal/testing access.                                                                                                                                                                                                                                                                                                                                                                                       |
| Plausible cookieless analytics                         | active, collecting                                                    | same source                                                              | "Dashboard goals = this session's operator act" — the `getting-started` page-goal, `docs_cta_click`, `signup_complete` events are wired (ADR-0254) but no reported counts exist anywhere in the corpus for any of them.                                                                                                                                                                                                                                                                                                                          |
| Waitlist signups (the site's primary pre-launch CTA)   | **no count found; mechanism itself was built as intentionally inert** | ADR-0085                                                                 | ADR-0085 (2026-06-27) built the waitlist as a Cloudflare Pages Function → Resend Segments call, explicitly scoped as "a seam: inert until a real Resend account + `RESEND_API_KEY` / `RESEND_SEGMENT_ID` env are wired (not this session — no live launch)." The 2026-07-12 provider rollup shows the Resend domain `caisson.sh` IS verified (so the email side is at least reachable by that date) — but no waitlist-contact-count, Resend-segment-size, or signup number appears anywhere in the corpus at any later date. **Zero confirmed.** |
| Docs discover→quickstart→signup funnel instrumentation | wired (ADR-0254, 2026-07-06), **zero reported counts**                | `docs/gtm/gaps-and-plays.md` gap #12, `docs/gtm/channels-launch.md`      | Plausible + PostHog events exist in code; the corpus records no dashboard read of them.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AI-citation / AEO probe loop                           | wired and running (ADR-0254 gap #9)                                   | `docs/gtm/aeo-citation-tracking.md`                                      | Measures whether AI search engines cite Caisson content — a visibility metric, not a demand metric; no citation-count snapshot value is reproduced in the files read for this audit.                                                                                                                                                                                                                                                                                                                                                             |
| GitHub stars (`caisson-oss`)                           | **N/A — repo is private, has never been public**                      | §0 above; `outputs/research/w3-flipgate-verification-2026-07-17.md`      | Cannot have stars, forks, issues, or Discord-driven traffic from a repo the public has never been able to see.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| npm downloads (`@caisson-sh/*`, `create-caisson`)      | **0 — never published**                                               | same                                                                     | `RELEASE_NPM_MIRROR_ARMED` confirmed absent (correct — it no-ops until the flip); no public package has ever shipped.                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## 4. Discord / community channel

| Metric                                 | Count                                                         | Source                                                                                  | Notes                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discord server                         | live, bot deployed ("Caisson Support Bot")                    | `outputs/research/provider-cost-rollup-2026-07-12.md`                                   | Bot presence confirmed by live probe.                                                                                                                                                                                                                                                               |
| Member count                           | **not found in any file read**                                | —                                                                                       | No membership, message-volume, or engagement number for the Discord server appears anywhere in the corpus.                                                                                                                                                                                          |
| Support-bot ticket / escalation volume | **effectively zero — explicitly parked pending real traffic** | `docs/gtm/channels-launch.md` "Known gap" section; `docs/gtm/gaps-and-plays.md` gap #11 | The bot's 3-tier confidence-gate design work was explicitly deferred ("TRIGGER-PARKED... best-practice RAG support is high→auto-answer/medium→suggest/low→escalate... revisit once the bot carries real support volume") — a direct admission there is not yet real support volume to tune against. |

---

## 5. Affiliate program

| Metric                         | Count                               | Source                               | Notes                                                                                                                               |
| ------------------------------ | ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Program built                  | yes (ADR-0320, 2026-07-10)          | `docs/gtm/gaps-and-plays.md` gap #13 | Flat 10% buyer discount / 30% referrer commission; mint route + admin dashboard + discount-ID capture all live in code.             |
| Affiliates recruited           | **0 found**                         | —                                    | No named affiliate, no minted affiliate code usage, no commission paid, anywhere in the corpus.                                     |
| Affiliate-driven signups/sales | **0 — cannot exist pre-first-sale** | §0 above                             | No sale of any kind has occurred (Paddle/Mercury both application-pending), so an affiliate-attributed sale is definitionally zero. |

---

## 6. Paid-channel experiments (newsletter sponsorships, ads, directories)

| Channel                                                                        | Status                                                                                                                                                                                                                                                               | Source                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Security/dev newsletter sponsorship (Bytes, TLDR InfoSec-class)                | **recommended, not executed** — "Weeks 2–6 ($3–8k)" is a future-tense plan in the research, not a run campaign                                                                                                                                                       | `outputs/research/prelaunch-fanout-2026-07/SYNTHESIS.md` §5                                |
| Directory listings (SaaSHub, AlternativeTo, DevHunt, StackShare, Product Hunt) | **staged, not submitted** — `docs/gtm/directory-listings.md` explicitly notes these "do not exist publicly until the W3 flip"                                                                                                                                        | `docs/gtm/directory-listings.md`                                                           |
| Show HN / Product Hunt launch                                                  | **not yet run** — sequenced as the LAST step of the 7-step operator checklist in the W3 flip-gate recon, itself gated on the still-unresolved business-optics hold                                                                                                   | `outputs/research/w3-flipgate-verification-2026-07-17.md`                                  |
| Paid search / SEO content (comparison pages, glossary)                         | Glossary program (32 terms) is live/published (PR #121, per `docs/gtm/channels-launch.md`) — the one content program actually shipped; comparison-page program ("15–20 Caisson-vs-X pages," the single strongest AEO lever identified) is **recommended, not built** | `outputs/research/prelaunch-fanout-2026-07/SYNTHESIS.md` §4; `docs/gtm/channels-launch.md` |

---

## 7. Checkout / commerce funnel

| Stage                             | Count                                                                                                   | Source                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Payment processor live            | **NO — Paddle + Stripe/Mercury both application-pending**                                               | `outputs/research/w3-flipgate-verification-2026-07-17.md` §"18 §13 business gates"                            |
| Catalog live in production Paddle | **NO — SANDBOX only**                                                                                   | `docs/gtm/gaps-and-plays.md` "Catalog-doctrine fork" (PR #130, sandbox); `docs/gtm/channels-launch.md` item 3 |
| Checkout sessions started         | **0 — no live checkout exists to start one**                                                            | —                                                                                                             |
| Purchases / revenue               | **$0 — pre-revenue, confirmed by the task framing and corroborated by every operational document read** | —                                                                                                             |

---

## Ledger summary — by the numbers

| Funnel stage                                                    | Count                                                                                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ICPs/candidates researched (design-partner program)             | 30                                                                                                                                                                                                |
| Outbound emails drafted                                         | 5                                                                                                                                                                                                 |
| Outbound emails confirmed sent                                  | **0**                                                                                                                                                                                             |
| Replies                                                         | **0**                                                                                                                                                                                             |
| Design partners signed (of 5 slots)                             | **0**                                                                                                                                                                                             |
| Waitlist signups confirmed                                      | **0** (mechanism built but no count ever recorded)                                                                                                                                                |
| Discord members                                                 | not recorded                                                                                                                                                                                      |
| GitHub stars / npm downloads                                    | **0 / 0** (repo never public)                                                                                                                                                                     |
| Affiliates recruited                                            | **0**                                                                                                                                                                                             |
| Paid-channel campaigns run                                      | **0** (all recommended, none executed per the corpus)                                                                                                                                             |
| Checkout sessions                                               | **0**                                                                                                                                                                                             |
| Revenue                                                         | **$0**                                                                                                                                                                                            |
| Real-ICP humans who have ever reacted to Caisson's actual price | **~10–14** (Study 1 n=10 heard the real number; Study 2 adds ~2–4 usable reactions, all off a pricing-screen probe the study's own moderators executed inconsistently — see Evidence ledger E-D9) |

**Honest read for the board:** Caisson's demand evidence today is almost entirely _research_
evidence (paid third-party interview/survey recruitment) and _preparatory_ evidence (drafted
outreach, wired-but-unused analytics, a sandbox catalog) — not _field-traction_ evidence. The
single design-partner outbound motion, which is the company's most mature GTM asset, has no
recorded reply, meeting, or signed partner. There is no public repository, no public package, no
live payment processor, and no confirmed waitlist count. This is the correct and expected state
for a company that has deliberately not yet flipped its go-live gate (§0) — the zeroes above are
a business-timing fact, not a performance failure, and the board should read them as "pre-launch,
as designed," while separately weighing how long that hold has been in place against the
maturity of the underlying technical readiness (per the Evidence ledger §6, the technical/audit
side is considerably further along than the commercial-gate side).
