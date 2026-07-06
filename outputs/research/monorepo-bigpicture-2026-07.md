<!-- Provenance: 6-agent exa research workflow (5 angles: monorepo-eng, productized-library GTM, solo-operator ops, SEO/AEO devtools, agent-driven repo ops + opus synthesis), 2026-07-05, session site-design-2 close-out. -->

# Caisson vs. 2025–2026 Best Practice — Synthesis Across Five Research Angles

## 1. Executive summary

Caisson is **ahead of reference practice on architecture and discipline, behind it on dependency hygiene and measurement loops, and sitting on two unmade revenue-policy decisions that are cheap now and expensive after launch.** The load-bearing structural bets are already right and, in several cases, more advanced than the tools the field is converging toward:

- **Ahead:** package-level (not folder-level) open-core split avoids the exact `/ee`-coupling bug Cal.com issue #13575 has left unfixed since 2024; the 3-layer standards-gate (custom TS + ESLint + dependency-cruiser + byte-identical registry-index rebuild) out-executes Turborepo's experimental `boundaries` and Nx's _paid_ Conformance plugin; the estimate-reserve-reconcile AI-spend metering (`ai-meter`, `ask-ai/spend.ts`) is further along than any surveyed article; Paddle-as-MoR, sole-prop-first legal posture, Plausible/PostHog surface split, and offline Ed25519 license verification are all textbook-correct.
- **At practice:** per-package `AGENTS.md`, append-only dated-banner state docs, session-handoff/auto-memory, JSON-LD `@graph`, robots allow-all, llms.txt (**see reconciliation note below**), hybrid one-time+credit-subscription pricing shape, deep-scope "complete business" positioning the saturated boilerplate market is now scrambling toward.
- **Behind:** no shared-dependency catalog (zod pinned across **4** ranges, typescript across **5**), no Renovate/Dependabot, no unused-dep detector, no AI-citation measurement loop despite a `gw-aeo-strategist` agent existing to consume one, no graded support-bot confidence model, and two undecided commercial-policy forks (update/renewal window, credit rollover) that a live checkout will silently default.

**Reconciliation:** the agent-driven-repo-ops angle flagged "no llms.txt" as a gap; the seo-aeo angle found it live at `apps/site/app/llms.txt` (+ `llms-full.txt`) via `route.ts` per ADR-0237 F8. It exists — the grep missed a dynamic Next route. **Not a gap; do not chase it.**

## 2. Prioritized gap table (ranked by impact-per-effort for a pre-launch solo operator)

| #   | Gap                                                                                                                     | Evidence-backed practice                                                                                                                                                                                                                              | Caisson state                                                                                                                                                 | Effort                                            | Expected impact                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Perpetual license has no stated updates/renewal window** — an unbounded free-updates commitment is implied by default | AG-Grid scopes perpetual = "this version forever" + 1yr updates, then 35–50% renewal for new versions; Tailwind Plus's lifetime-only model collected all LTV on day one and left zero recurring floor when docs traffic cratered (−80% rev from peak) | LACKS. `decisions-and-forks.md` #90 locks one-time editions + per-module but carries no "included updates window" or renewal clause                           | **S** (policy decision + checkout/EULA copy)      | **L** — commit it at the checkout flip; retrofitting "updates now cost money" post-launch is a trust-cost you can't undo |
| 2   | **Credit rollover / top-up policy undecided**                                                                           | The highest-scoring 2026 AI-pricing pattern is subscription + _pooled rollover_ credits + top-ups (Clay, ElevenLabs); hard monthly-reset scored as the less-coherent majority                                                                         | PARTIAL. Integer wallet + ledger + subscription allotment built (ADR-0007/0024); grep of spec/catalog found no rollover/expire/top-up policy                  | **S** (decision; wallet plumbing already exists)  | **M–L** — it's a pricing-page commitment; decide before the page ships                                                   |
| 3   | **Root CLAUDE.md ADR-history run-on paragraph** (700+ words, one wrapped line, appended every merge)                    | Root CLAUDE.md/AGENTS.md should be a ~80–300-line pointer file; depth lives in `docs/` — the growing-inline-history is the named anti-pattern                                                                                                         | PARTIAL. File is 253 lines (in range) but the SoT-hierarchy section embeds the entire ADR-0001→0242 catalog inline instead of pointing to `docs/adr-index.md` | **S** (cut to a pointer line)                     | **M** — every agent session loads this; it's a recurring context tax on a file that's supposed to be lean                |
| 4   | **No package-manager catalog for shared deps**                                                                          | Bun/pnpm catalogs are 2025 monorepo baseline; Renovate added catalog-aware grouping specifically to stop drift                                                                                                                                        | LACKS, and drift is real: **zod at `^3.23.8`/`^4.0.0`/`3.25.76`/`^3.23.0` (4 ranges)**, typescript across 5, over 51 packages                                 | **S** (one `catalog:` block in root package.json) | **M** — zod 3↔4 across packages is a live type-incompat landmine, not cosmetic                                           |
| 5   | **`build-vs-buy` comparison page named in ADR-0079, zero built**                                                        | Company-owned content wins ~51% of B2B-SaaS AI citations (>UGC+editorial combined); ADR-0079 correctly bets on build-vs-buy over "Vanta alternative" pages                                                                                            | LACKS. Grep of `apps/site/app` found no build-vs-buy page; the ADR names the pattern, nothing implements it                                                   | **S** (one page, pattern already designed)        | **M** — the single largest AI-citation slot for the category, already specced                                            |
| 6   | **Cloudflare Content-Signals header (ADR-0079 §5) not implemented**                                                     | Selective AI-crawler signalling (allow-all + Content-Signals) is the sanctioned middle ground; blanket GPTBot block cost −73% ChatGPT citations with zero Googlebot upside                                                                            | LACKS. robots.ts posture is correct (allows all but `/dashboard`) but the `search=yes, ai-input=yes` header wasn't found in next.config/headers               | **S** (one response header)                       | **S–M** — completes an already-locked decision                                                                           |
| 7   | **No unused-dependency / unused-export gate (Knip)**                                                                    | Knip is the purpose-built monorepo dead-code/dead-dep detector, positioned as complement to boundary lint                                                                                                                                             | LACKS. Standards-gate checks license/boundary/manifest but nothing flags dead deps/exports across 51 packages                                                 | **S** (`knip` + one CI step)                      | **S–M** — hygiene compounding at 51 packages; cheap to add                                                               |
| 8   | **No automated dependency-update bot**                                                                                  | Renovate/Dependabot with monorepo+catalog awareness is default for 50+-package repos                                                                                                                                                                  | LACKS. No `renovate.json`/`dependabot.yml`; the version drift in #4 is the direct symptom                                                                     | **S** (one config; pairs with #4)                 | **M** — pre-launch is the cheapest time to get on a freshness cadence                                                    |
| 9   | **No AI-citation tracking loop**                                                                                        | Citation share is assistant-specific and volatile month-to-month (only 14% of top-50 domains shared across engines; shifts on infra changes alone) — must be measured, not assumed                                                                    | LACKS. `gw-aeo-strategist` agent exists to consume this data but no Peec/Ahrefs-Brand-Radar-style tracker is wired in; ADR-0079's GEO bets ship unmeasured    | **S–M** (wire a tracker to the existing agent)    | **M** — you already built the consumer; you're flying blind without the feed                                             |
| 10  | **Changesets `ignore`/`privatePackages` policy undeclared**                                                             | changesets docs specify explicit private/publish policy; teams hit friction relying on `private:true` defaults alone                                                                                                                                  | PARTIAL. Config relies implicitly on 11 apps/services carrying `private:true`; correct today, undeclared for future reclassification                          | **S** (one config block)                          | **S** — codify before the public/private split grows                                                                     |
| 11  | **Support-bot has no graded confidence gate**                                                                           | Best-practice RAG support = 3-tier (high→auto-answer, medium→suggest-to-staff, low→stay-silent+escalate), not always-answer                                                                                                                           | PARTIAL. `services/support-bot` does RAG + escalates failures to Linear, but escalation is binary (answer or ticket), not tiered                              | **M**                                             | **M** — a live, monetizable, public-facing surface; hallucination on it is a trust hit                                   |
| 12  | **No docs-conversion instrumentation**                                                                                  | Docs are the highest-intent ungated funnel; instrument discover→quickstart→signup and let API-key/account creation be the conversion event (30–45% higher free→paid for open-core with good docs)                                                     | PARTIAL. Fumadocs surface + ask-AI intent capture exist, but no discover→signup progression tracking in `docs/state/`                                         | **M**                                             | **M** — the conversion-attribution half of the docs-as-demand-channel play                                               |
| 13  | **No affiliate / recurring-commission program**                                                                         | Recurring-commission affiliate (% first sale + smaller % renewal) via existing community trust durably beats one-off bounties for dev-tool audiences                                                                                                  | LACKS. No affiliate/referral anywhere in specs/ADRs — clean gap, and caisson already has the Discord + subscription substrate it rides on                     | **M**                                             | **M** — **post-launch**; needs traffic first, but the substrate is already there                                         |

## 3. Do not copy — practices to deliberately skip

- **shadcn `registry.json` agent-install channel.** Caisson already ships a license-token-authed self-hosted npm registry (`registry.caisson.sh`, ADR-0223) that is a _superset_ of what shadcn's registry does, plus the commercial gating shadcn has no model for. A registry.json channel is built for free/copy-paste component installs with no auth — adding it is a parallel channel that undercuts the paywall. Skip unless you deliberately want a _free-tier component teaser_ as a funnel.
- **Live phone-home license verification (Cal.com model).** Caisson chose offline Ed25519 verification on purpose. Cal.com's own issue #23342 documents the phone-home check failing customers after trial expiry. The offline choice is already correct — do not "modernize" toward the network check.
- **ADR-injection / ADR-enforcement CI tooling (adr-kit, adr-governance).** Automating diff-vs-active-ADR enforcement is over-engineering at solo scale. 240+ ADRs are already managed by append-only immutability + a hand-synthesized index; the automation's maintenance cost exceeds the drift cost for one operator. YAGNI. (The **one** ADR-adjacent fix worth doing is #3 — shrinking the inline history, which is deletion, not automation.)
- **CI doc-code sync gate (docs-gate, veritas) that auto-drafts doc PRs.** For an operator who narrates state docs in-session, an LLM gate opening doc-update PRs is a noise generator. The dated-banner + append-only discipline already works and is verifiable by eye. Skip.
- **`turbo --affected` on the required `check` gate.** The inline comment in `ci.yml` already reasons this correctly: `--affected` would skip validation of a release-blocking gate. Keep the full graph on the required check. (A shared **remote cache** is marginally worth it but low priority — GitHub-Actions-local caching is fine at solo volume.)
- **Collapsing the 5-service Railway topology to one host.** The "one boring managed host" ideal doesn't fit a product whose editions and a **Python** support-bot are genuinely different runtimes, plus a Cloudflare Worker registry. `providers.md` PF-7 already frames this as a reasoned tradeoff. Re-architecting toward a monolith fights the product shape. Skip.
- **Over-investing in llms.txt as an "AI visibility" lever.** It's already shipped and correctly scoped as a coding-agent token-saver. 97% of llms.txt files get zero AI-bot traffic and Google's Mueller calls it "not done for search." Keep it; don't expect ranking lift from it.

## 4. Sources by angle

**Monorepo engineering**

- https://turborepo.dev/docs/reference/boundaries
- https://github.com/vercel/turborepo/discussions/9435
- https://github.com/vercel/turborepo/pull/9634
- https://github.com/vercel/turborepo/pull/10151
- https://nx.dev/docs/reference/conformance/overview
- https://nx.dev/docs/features/enforce-module-boundaries
- https://nx.dev/docs/enterprise/conformance
- https://nx.dev/blog/nx-cloud-conformance-automate-consistency
- https://github.com/calcom/cal.com/blob/main/LICENSE
- https://github.com/calcom/cal.com/blob/main/packages/features/ee/README.md
- https://github.com/calcom/cal.com/issues/13575
- https://deepwiki.com/calcom/cal.com/10.1-build-system-and-turborepo
- https://github.com/changesets/changesets/blob/main/docs/versioning-apps.md
- https://github.com/atlassian/changesets/blob/main/docs/config-file-options.md
- https://github.com/changesets/changesets/commit/283f654f74620b55ad8db7afc0beaf8dfcd55879
- https://github.com/changesets/changesets/issues/1702
- https://turborepo.dev/docs/reference/query
- https://github.com/vercel/turborepo/commit/1b9f6cb7fa297960503ed20176947f25005c033d
- https://vercel.com/changelog/automatically-skip-unnecessary-deployments-in-monorepos
- https://bun.com/docs/pm/catalogs
- https://blogs.abhipanseriya.dev/blog/pnpm-catalogs-went-from-convenience-to-baseline-here-is-what-nobody-mentions
- https://github.com/renovatebot/renovate/pull/33376
- https://github.com/renovatebot/renovate/commit/106953b4cd8cf769413e8d29c0ac8b9c7cda0249
- https://knip.dev/
- https://knip.dev/reference/faq
- https://github.com/webpro-nl/knip/issues/1711
- https://turborepo.dev/docs/crafting-your-repository/constructing-ci
- https://warpbuild.com/blog/github-actions-monorepo-guide
- https://ui.shadcn.com/docs/monorepo
- https://deepwiki.com/shadcn-ui/ui/2-monorepo-structure

**Productized-library GTM**

- https://tailwindcss.com/plus
- https://tailwindcss.com/blog/tailwind-plus
- https://joost.blog/tailwind-paradox/
- https://danjcleary.substack.com/p/ai-is-both-propelling-and-undermining
- https://ui.shadcn.com/docs/changelog/2025-07-universal-registry
- https://otf-kit.dev/blog/shadcn-cli-v4-registry-economy
- https://starterpick.com/guides/shadcn-registry-blocks-vs-ui-libraries-saas-boilerplates-2026
- https://newsletter.marclou.com/p/i-made-1-032-000-in-2025
- https://startupfounderstories.com/stories/marc-lou-shipfast-250k-5-months
- https://www.ag-grid.com/license-pricing/
- https://www.ag-grid.com/react-data-grid/community-vs-enterprise/
- https://ag-grid.com/archive/25.0.0/license-pricing.php
- https://calcom.mintlify.dev/docs/self-hosting/license-key
- https://github.com/calcom/cal.com/blob/main/packages/features/ee/README.md
- https://github.com/calcom/cal.com/issues/23342
- https://keygen.sh/for-npm-packages/
- https://github.com/launchframe-dev/cli
- https://github.com/nmarijane/saas-boilerplate
- https://www.mintlify.com/blog/documentation-is-a-demand-channel
- https://www.getmonetizely.com/articles/how-documentation-quality-drives-open-core-conversion-rates-a-data-backed-guide-for-saas-leaders
- https://razegrowth.com/blog/saas-lead-magnet-docs
- https://razegrowth.com/blog/developer-experience-design-marketing
- https://pricinginnovation.substack.com/p/credit-based-pricing-execution-patterns
- https://tierly.app/blog/credits-vs-monthly-pricing
- https://www.buildinpublic.so/blog/launch
- https://autosaaslaunch.com/blog/how-to-launch-your-saas
- https://dev.to/boldforge/building-trust-first-how-my-discord-community-became-my-most-valuable-revenue-channel-3gi6
- https://dev.to/gentlelogic/affiliate-marketing-for-developers-what-i-wish-i-knew-earlier-11if
- https://unil.ink/blog/how-to-make-money-on-discord-2026
- https://paybotapp.com/docs/affiliate-program/
- https://www.greatfrontend.com/interviews/pricing

**Solo-operator ops**

- https://www.monacocpa.cpa/post/vibe-coder-taxes-saas-indie-developer-guide
- https://www.paddle.com/blog/what-is-merchant-of-record
- https://leanvibe.io/blog/bp-26820
- https://fungies.io/non-us-founders-sell-saas-globally-2026/
- https://f3fundit.com/taxes-for-saas-founders-us-eu-international/
- https://cardpolo.com/tools/stacks/indie-saas
- https://www.promptstoproduct.com/saas-cost-at-1k-mrr
- https://www.play-ascend.com/blog/running-customer-support-on-discord
- https://dev.to/ticketcord/how-we-built-an-ai-support-assistant-that-actually-works-in-discord-1ddl
- https://luciusai.com/case-studies/jarsy-case-study
- https://www.thesaascfo.com/your-ai-feature-is-quietly-destroying-your-gross-margin/
- https://www.ertas.ai/blog/ai-saas-unit-economics-margin-math
- https://getpodfleet.com/insights/usage-based-ai-pricing-saas-margin
- https://rapidflowautomation.beehiiv.com/p/the-0-mrr-pre-revenue-architecture-trap-5-things-you-built-too-early
- https://chatsby.co/blog/how-to-run-saas-on-20-dollar-monthly-tech-stack
- https://www.stackfyi.com/guides/lemon-squeezy-vs-paddle-billing-2026

**SEO / AEO for devtools**

- https://ahrefs.com/blog/llmstxt-study/
- https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/
- https://llmtxt.info/llms-txt-adoption/
- https://www.semrush.com/blog/most-cited-domains-ai/
- https://ahrefs.com/blog/top-10-most-cited-domains-ai-assistants/
- https://ahrefs.com/blog/top-mentioned-sources-are-not-shared-across-ai-assistants/
- https://www.loudface.co/blog/ai-citation-benchmark-b2b-saas-2026
- https://www.sitepoint.com/ai-citable-documentation/
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://rankeo.io/blog/schema-markup-saas
- https://www.knowlee.ai/blog/programmatic-seo-at-scale
- https://ranksages.com/blog/programmatic-seo-2026-playbook/
- https://searchengineland.com/guide/programmatic-seo
- https://devtune.ai/blog/aeo-vs-geo-vs-seo
- https://www.infrasity.com/blog/aeo-for-developer-tools

**Agent-driven repo ops**

- https://agents.md/
- https://github.com/agentsmd/agents.md
- https://www.codeline.co/thoughts/repo-review/2025/agents-md-open-format-for-guiding-coding-agents
- https://agentpatterns.ai/standards/agents-md/
- https://www.harness.io/blog/the-agent-native-repo-why-agents-md-is-the-new-standard
- https://startdebugging.net/2026/05/how-to-structure-a-monorepo-so-claude-codes-context-stays-small/
- https://thepromptshelf.dev/blog/claude-code-monorepo-setup/
- https://tianpan.co/blog/2026-04-17-coding-agents-monorepo-context-window
- https://agents-ui.com/blog/ai-coding-agents-large-codebases-monorepos/
- https://claudecodeguide.dev/blog/handoff-protocol-saves-10-minutes
- https://www.augmentcode.com/guides/session-end-spec-update-ai-agents
- https://axme.ai/blog/vacation-empty-project-session-handoff/
- https://devforgedev.hashnode.dev/the-one-file-that-makes-claude-code-sessions-actually-persistent
- https://agentpatterns.ai/agent-design/session-recap/
- https://github.com/rvdbreemen/adr-kit
- https://github.com/ivanstambuk/adr-governance
- https://squiglos.com/architecture-ledger
- https://rickpollick.com/blog/adr-comeback-anchoring-agentic-engineering-teams
- https://github.com/sarvesh-ghl/docs-gate
- https://github.com/niloy-saha-123/veritas
- https://falconer.com/guides/ai-keep-documentation-sync-code/
- https://doc.holiday/blog/how-to-keep-documentation-alive-when-claude-writes-the-code
- https://llmstxt.org/
- https://github.com/AnswerDotAI/llms-txt
- https://geodocs.dev/technical/llms-txt
- https://circleci.com/blog/how-circleci-implemented-llms-txt
