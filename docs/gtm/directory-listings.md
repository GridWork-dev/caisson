---
updated: 2026-07-07
status: live
grounds:
  - knowledge/decisions/ADR-0080-copy-messaging-expansion.md
  - knowledge/decisions/ADR-0082-go-live-site-posture.md
  - outputs/research/prelaunch-fanout-2026-07/SYNTHESIS.md
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
| 12  | **Product Hunt**                                   | producthunt.com/posts/new — **LAUNCH DAY ONLY**                                                                   | Name, tagline, gallery, first-comment maker story, topics                                                                                                   | The launch-moment surface. Dofollow follows a decent ranking. **Hold until CF-Access drops + checkout is live** — a pre-launch PH post burns the one shot at a gated site (ADR-0082).                                         |
| 13  | **BuildKits / boilerplate-comparison directories** | buildkits.dev, saasboilerplates.dev, boilerplatehub.com submission forms                                          | Name, price, stack, feature matrix row                                                                                                                      | Niche directories where a buyer is actively comparing SaaS starter kits — the exact "build vs buy a kit" moment Caisson's compliance angle wins. Verify each form; list against ShipFast / Makerkit / Supastarter.            |

## Sequencing

1. **Now (pre-launch, behind the gate):** prep every listing draft from the copy above;
   submit the always-on directories that publish to an index regardless of a gated live
   URL only _after_ CF-Access drops — a crawler that 401s on the submitted URL can get the
   listing rejected or de-indexed.
2. **At launch (gate dropped, checkout live):** fire the always-on directories (#1–#11, #13)
   in one batch — SYNTHESIS notes 30–50 directory submissions in week one build a
   compounding backlink foundation. Then Product Hunt (#12) as the timed launch beat.
3. **Post-launch:** revisit G2 / Capterra once real customer reviews exist.

## Handoff

`gw-market-intel` owns the ongoing directory watch; `gw-devrel-writer` owns the DEV.to
launch post. This doc is the canonical submission-copy source — amend here, don't fork a
second copy.
