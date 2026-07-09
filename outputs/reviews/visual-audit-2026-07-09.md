# Visual audit — full-surface prod screenshot sweep (2026-07-09)

The chunked agent analysis of the 2026-07-09 visual-harness run against **live prod**
(`caisson.sh`, CF-Access service-token bypass). Run artifacts: `outputs/visual-audit/2026-07-09/`
(gitignored, 640 PNGs + `manifest.json`); harness: `apps/site/scripts/visual-harness.ts`.

**Run shape:** 640 shots · 142 distinct routes · 12 categories (marketing, marketplace, module,
popout, compare, glossary, docs, legal, auth, email, interaction, dashboard) · mobile 390px +
desktop 1280px · light + dark · includes the authenticated buyer-dashboard leg and 10 scripted
interactions. **Analysis:** 36 chunk-audit agents + 1 console-triage agent, one shared visual-audit
standard, every agent reading its images directly. 99 raw findings (9 P0 · 56 P1 · 25 P2 · 9 P3),
60 surfaces explicitly clean. Raw per-chunk results: workflow run `wf_cf7e4223-63b`.

Tracking: the P0/P1 clusters below are filed as **Linear CAISSON-64..71** (64 ai-keys crash ·
65 footer overlap · 66 compare template · 67 home mobile · 68 broken diagrams/popout media ·
69 dashboard chrome + login feedback · 70 docs dark-mode contrast · 71 prod 429s/502s); the
tracker row "Visual-audit remediation" in `docs/state/outstanding-work.md` §2 points here.

## P0 — content-destroying, fix before any launch push

| #   | Root cause                                                                                                                                                                                                                                                                                                                                                                      | Blast radius                                                                                                                                                                         | Evidence                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | **`/dashboard/ai-keys` is dead** — Server Components render error (digest 2809451432) replaces the whole authed layout with the error boundary                                                                                                                                                                                                                                  | The route the dashboard sidebar links from every page; 4/4 viewport-mode variants, 100% reproducible                                                                                 | `dashboard/dashboard__ai-keys__*.png`; console triage "Server Components render error"      |
| 2   | **Sitewide mobile footer overlap** — the logo tagline ("compliance-grade infrastructure") renders on top of the "Bundles" nav column, glyphs interleaved and illegible                                                                                                                                                                                                          | Every page on the site at 390px, both themes (reported independently by 10+ chunks: marketing, legal, compare, auth, glossary, marketplace, module, interaction). Desktop unaffected | e.g. `legal/legal__eula__mobile__light.png`, `compare/compare__open-saas__mobile__dark.png` |
| 3   | **`/compare/*` fact-chip nowrap** — the monospace descriptor pill ("What X is") never wraps on mobile, forcing page-level horizontal overflow: 520–1014px rendered width vs the 390px viewport, dead canvas past the fold on the full page height                                                                                                                               | All ~20 comparison pages (every compare chunk found it); overflow scales with the descriptor length (worst: comp-ai at 1014px, turbostarter 767px, supastarter 734px)                | `compare/compare__comp-ai__mobile__*.png` and siblings                                      |
| 4   | **Module popout content loss** — (a) `module-ai-meter` desktop popout drops its description paragraph + capability badges entirely (blank slot where siblings render copy); (b) the field-encryption media-carousel diagram is wider than the modal: unreadable on mobile (both edges clipped, the fail-closed "0 rows / denied" message lost), right column clipped on desktop | Buyer-facing purchase surfaces for paid modules                                                                                                                                      | `popout/module-ai-meter__desktop__*.png`, `interaction/popout-media-carousel-next__*.png`   |
| 5   | **Home mobile hero** — the sticky "0 selected / $0 / Add to cart" builder bar renders pinned over the hero card copy, and the page itself is 449px wide against the 390px viewport (tenant-stat row + the 6-bundle "Compose, don't fork" matrix neither wrap nor scroll internally)                                                                                             | The front door of the site on every phone, both themes                                                                                                                               | `marketing/home__mobile__*.png`                                                             |

## P1 clusters (deduped)

- **Placeholder/broken diagrams shipped to prod** — the "what it composes / ships in the box /
  see it work" media slots render a bare broken-image glyph on a grid instead of content on:
  agentic-dev, ai-kit, local-first, provenance, compliance (bundle pages) and the alerting,
  guardrails, local-store, prompt-registry, agent-kernel, agent-runner, ai-evals, ai-meter module
  pages. Directly against the ADR-0290 media standard and the ADR-0082 artifacts-true-to-built
  floor. retention-runner's diagram renders but its text overflows its own boxes.
- **More mobile horizontal overflow** (same class as P0-3, different sources):
  `frameworks/eu-ai-act` 570px (non-wrapping code lines + badge pills), the `ai-evals` module page
  +144px, popout code-proof panels overflow with no scroll affordance on field-crypto, guardrails,
  local-store, prompt-registry.
- **Docs dark-mode code blocks near-illegible** — plain identifiers render at ~1.2–3.1:1 contrast
  in dark mode across base (billing, credits, email, jobs, kernel), compliance, local-first, and
  provenance docs; some pages fade only the second code block. One shared Shiki/theme bug. Bonus
  content bug: `docs/ai-kit` renders HTTP 402 as "4Θ2" (Greek theta for zero).
- **Comparison-table desktop cell collision** — adjacent long values run together with zero gap
  ("Caissonbuilding it in-house", "...perpetualFree (MIT)") on bedrock, build-in-house, comp-ai,
  create-t3-app, scytale; the mobile table squeezes the Detail column into 4–7 centered lines per
  row (delve, divjoy, drata, makerkit chunk).
- **Auth-page hydration mismatch** — React #418 fires on every `/login` and `/reset-password` load
  (12/12 captures, 0% elsewhere). Almost certainly the already-known CAISSON-50 (CF zone beacon
  auto-injection; terraform authored, apply operator-gated) — verify it clears once the beacon
  terraform applies before hunting anything in the form components.
- **Login form gives no visible failure feedback** — the invalid-submit interaction shot shows no
  error state, no field highlight, nothing (mobile, both themes).
- **Dashboard mobile chrome** — the session/account pill is hard-clipped at the viewport edge on
  every page, and mobile has no sign-out control at all (desktop-only).
- **Intermittent prod 5xx/asset noise (infra, correlate before fixing)** — 502s on 4 captures
  across home mobile-nav, `/marketplace/plans`, `/marketplace/modules/alerting`; one chunk-load
  failure on alerting; and **429s on 69/640 captures across 19 content-heavy routes** (legal,
  glossary, module detail) — a shared background endpoint rate-limited too low. Needs a re-run
  with request-URL logging to name the endpoint.

## P2/P3 (tracker-only, no Linear)

Email templates have **no dark-mode treatment** (all 11 pixel-identical in dark captures — a
policy call, not a defect); marketplace "AI-PRODUCTI…" badge truncation; empty-cart copy still
says "edition" (retired vocabulary) and `/dashboard/plan` says "Ai" and "Editions & bundle";
"Local-first AI" vs "Local-first" footer naming drift; `build-vs-buy` two-up list cramped at
390px; assorted popout carousel-control inconsistencies (misplaced arrows, missing total-page
digit, desktop-only slide indicators); legal pages leave ~45% of desktop width empty; the docs
sidebar drops 3 of 5 bundle links on base-package detail pages; forgot-password footer missing
the Discord link; kernel docs "compliance" pagination link lowercased.

## Explicitly clean

60 surfaces pass with no findings, including: all glossary desktop renders, most docs pages
(light mode), all email templates in light mode (layout/copy), the marketplace grid + cart flows,
dashboard overview/license/credits (the empty states verified live by the 4/4
`buyer-dashboard-flow.live.test.ts` proof), and 554/640 captures show no console errors beyond
the known CAISSON-51 CF-beacon CSP noise (which covers 141/142 routes and is already tracked).

## Reading the run

Re-run: `cd apps/site && bun run scripts/visual-harness.ts --prod` (creds via
`infra/terraform` outputs; see the harness header). Re-run a slice with `--only <category>` or
`--match <name>`. The manifest merges across runs keyed by `category/name/viewport/mode`, so
partial re-runs after fixes are cheap.
