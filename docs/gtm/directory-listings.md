---
updated: 2026-07-10
status: live
grounds:
  - knowledge/decisions/ADR-0080-copy-messaging-expansion.md
  - knowledge/decisions/ADR-0082-go-live-site-posture.md
  - knowledge/decisions/ADR-0303-cf-access-commerce-scope.md
  - knowledge/decisions/ADR-0318-oss-launch-program-locks.md
  - outputs/research/prelaunch-fanout-2026-07/SYNTHESIS.md
  - outputs/research/oss-launch-gtm-2026-07-10.md
  - docs/state/decisions-and-forks.md
  - docs/gtm/positioning.md
---

# Directory-listing prep (AEO program, CAISSON-29 / D5)

The directory leg of the AEO program (SYNTHESIS §4.4). Directories give three things a
new brand can't buy: dofollow backlinks that compound as an SEO foundation, presence in
the "alternative to X" long-tail an AI answer engine reads, and a second surface where a
buyer comparing options finds Caisson. Ranked by fit for a **developer-tools + compliance
infrastructure** product, not generic SaaS.

**Each row below is verified to exist (web search, 2026-07).** Submission URLs are the
canonical entry points — confirm the live form before you paste. **Gate:** most of these
publish immediately; hold the launch-timed ones (Product Hunt) until the CF-Access gate
drops and checkout is live, per the go-live posture (ADR-0082). G2 / Capterra are
deferred until real reviews exist (SYNTHESIS §4.4).

## Copy laws (ADR-0080 — apply to every listing)

- Name the mechanism, never "enterprise-grade" vagueness: _fail-closed Postgres RLS_,
  _S3 Object-Lock WORM_, _append-only hash-chain audit log_ — not "bank-level security".
- No invented numbers, no fake scarcity, no testimonials that don't exist.
- Six-bundle vocabulary only (compliance / ai-production / local-first / agentic-dev /
  provenance / everything). The four "editions" are dissolved — never use that word.
- V1-live posture: no "coming soon", no roadmap framing. Describe what ships today.

## Reusable listing copy (grounded, drop-in)

**Name:** Caisson
**One-liner (≤60 chars):** Compliance-grade infrastructure for regulated SaaS.
**Tagline (≤120 chars):** Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain — wired and tested before your first audit.
**Category tags:** developer tools · compliance · SaaS boilerplate · security · Postgres · TypeScript · open source (base)

**Short description (≈50 words):**

> Caisson is a composable, Apache-2.0-based infrastructure library for regulated SaaS. The base ships fail-closed Postgres row-level security, per-tenant field encryption, and an append-only audit chain; six commercial bundles add WORM evidence storage, SOC 2 / HIPAA / EU AI Act control mappings with OSCAL v1.2.2 export, token metering, on-device inference, and a governed agent kernel. One-time perpetual license — own the source.

**Long description (≈110 words):**

> Most SaaS teams backfill compliance after their first audit. Caisson wires it in before the first customer. The Apache-2.0 base gives you fail-closed multi-tenant isolation (FORCE row-level security, so a forgotten WHERE clause returns zero rows instead of another tenant's data), per-tenant field encryption (HKDF-SHA256), and a SHA-256 hash-chained audit log. The Compliance bundle adds S3 Object-Lock WORM evidence storage, a control registry crosswalked to SOC 2 and HIPAA, and deterministic OSCAL v1.2.2 evidence-pack export. Five more bundles cover AI-production (metering, guardrails, eval gates), local-first (on-device inference, privacy egress gate), agentic-dev (governed agent kernel), provenance (cryptographic signing), and everything. Composable packages, never forks. `bunx @caisson-sh/cli` to start. Own the source.

## Directories (ranked by fit)

| #   | Directory                                          | Submission entry                                                                                                  | What it needs                                                                                                                                               | Fit / why                                                                                                                                                                                                                     |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **AlternativeTo**                                  | alternativeto.net → "Add application"                                                                             | Name, description, categories, license (mixed: Apache-2.0 base + commercial), platforms, similar apps (list ShipFast, Makerkit, Vanta as "alternatives to") | Captures the "alternative to X" query an AI engine reads. Dofollow, high long-term ROI. The single highest-value directory for AEO discovery.                                                                                 |
| 2   | **OpenAlternative**                                | openalternative.co/submit                                                                                         | GitHub repo, description, the proprietary tools it's an open alternative to                                                                                 | Purpose-built for open-source alternatives to proprietary SaaS — it already lists Comp AI as an open Vanta/Drata alternative. Position the Apache-2.0 base as the open, self-hostable compliance substrate. Strong niche fit. |
| 3   | **SaaSHub**                                        | saashub.com/submit                                                                                                | Name, URL, categories, description, logo, alternatives/competitors                                                                                          | Software discovery + comparison, no voting window — indexes for long-term organic discovery. Dofollow, quick approval, good long-tail.                                                                                        |
| 4   | **DevHunt**                                        | devhunt.org (GitHub auth)                                                                                         | Tool name, tagline, description, links, topics                                                                                                              | Developer-tool launch platform, developer-native audience, dofollow. Better fit than broad startup directories — the audience is exactly the create-caisson user.                                                             |
| 5   | **StackShare**                                     | stackshare.io → add a tool                                                                                        | Tool/company profile, stack it belongs to, description                                                                                                      | Engineer + CTO audience, high domain rating, free listing. Reaches the buyer evaluating a stack decision.                                                                                                                     |
| 6   | **GitHub awesome-lists**                           | PR to `tyaga001/awesome-saas-boilerplates-and-starter-kits`, plus an awesome-compliance / awesome-selfhosted list | A one-line entry + link, meeting each list's contribution guide                                                                                             | High-authority dofollow, dev-native, and durable. The boilerplate awesome-list is where a buyer comparing starter kits browses.                                                                                               |
| 7   | **LibHunt**                                        | libhunt.com (via the relevant topic)                                                                              | Project name, repo, description, tags                                                                                                                       | Trending open-source projects + their alternatives (SaaSHub's sibling). Fits the Apache-2.0 base's open-source surface. Dofollow.                                                                                             |
| 8   | **SourceForge**                                    | sourceforge.net → create project/listing                                                                          | Project name, description, categories, links, screenshots                                                                                                   | High-DR software directory; the open base gives a legitimate listing. Dofollow, long-tail search presence.                                                                                                                    |
| 9   | **DEV.to**                                         | dev.to (org profile + a launch/tutorial post)                                                                     | Org profile, a diff-grounded launch post (hand to `gw-devrel-writer`)                                                                                       | Developer community; the post earns a dofollow profile link and doubles as launch content. Pairs with the AEO explainer pages.                                                                                                |
| 10  | **TheSaaSDir**                                     | thesaasdir.com/submit                                                                                             | Name, URL, category, description, logo                                                                                                                      | SaaS & AI product directory, dofollow on the free tier. Cheap, quick, compounds.                                                                                                                                              |
| 11  | **Uneed**                                          | uneed.best/submit                                                                                                 | Name, tagline, description, logo, category                                                                                                                  | Curated indie-launch directory, small but high engagement per impression. Free SaaS submission (dofollow/featured is a paid upgrade — free tier still earns the listing).                                                     |
| 12  | **Product Hunt**                                   | producthunt.com/posts/new — **OPTIONAL, WEEK-2 FOLLOW-UP**                                                        | Name, tagline, gallery, first-comment maker story, topics                                                                                                   | Demoted from "the launch beat" to an optional week-2 follow-up after the Show HN anchor (ADR-0318 F5). Still one-shot: hold until checkout is live — a pre-launch PH post burns it (ADR-0082).                                |
| 13  | **BuildKits / boilerplate-comparison directories** | buildkits.dev, saasboilerplates.dev, boilerplatehub.com submission forms                                          | Name, price, stack, feature matrix row                                                                                                                      | Niche directories where a buyer is actively comparing SaaS starter kits — the exact "build vs buy a kit" moment Caisson's compliance angle wins. Verify each form; list against ShipFast / Makerkit / Supastarter.            |

## Sequencing (re-cut 2026-07-10 to the ADR-0318 F5 window → Show HN motion)

The old crawler-401 blocker is CURED: ADR-0303 scoped CF-Access to `/dashboard*` + `/cart*`
only, so marketing/docs/llms.txt serve public and a directory crawler gets 200s today. The
batch still holds — listings reference the GitHub repo and the install path, which don't
exist publicly until the W3 flip (`caisson-oss` public + first npm publish), and checkout
must be live so a converted visitor can buy.

1. **Now (staged):** every listing draft preps from the copy above. This doc is the staged
   batch; the trigger is unchanged (checkout live + the W3 public flip — the §3
   trigger-parked row in `docs/state/outstanding-work.md`).
2. **Window open (W3: repo public + first npm publish + checkout live):** fire the always-on
   directories (#1–#11, #13) AND the Awesome-list PRs (#6) as one batch at the START of the
   2–4-week pre-launch window — SYNTHESIS notes 30–50 directory submissions in week one build
   a compounding backlink foundation, and the window (not the launch-day spike) does the
   compounding (ADR-0318 F5: Show HN star half-life ~24h).
3. **Show HN anchor (window close):** the timed launch beat. Product Hunt (#12) optional in
   week 2 after it.
4. **Post-launch:** revisit G2 / Capterra once real customer reviews exist.

## Handoff

`gw-market-intel` owns the ongoing directory watch; `gw-devrel-writer` owns the DEV.to
launch post. This doc is the canonical submission-copy source — amend here, don't fork a
second copy.
