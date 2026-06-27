# Post-purchase value-add + support stack (Phase 2 addendum)

Cited research in the agent transcript. Distilled decisions below. **Unifying insight:**
one content artifact (docs + `llms.txt`) powers three jobs — the AI support bot, in-Discord
answers, AND the buyer's own AI coding agents. Build for that overlap.

## Benchmarks that frame it

- Dev-tool churn ~**2.7%/mo (~28%/yr)**; #1 churn driver = an OSS equivalent.
- **Docs quality is a measured, category-specific retention driver** for dev tools.
- Median dev-tool **NDR 125%** (top quartile 140%+); **usage-based pricing drives the highest NDR (~140%)** → validates the credits layer.
- One-time = cash burst then "revenue dry spell" → the subscription/credits layer is the fix (ShipFast's named weakness: "no recurring revenue").

## AI-support + human-ticketing (the "AI briefs + is tagged into the ticket" ask)

The pattern is now standard; pick by dev-community fit. Best fits:

| Pick                 | Role                                                         | Why                                                                                                                                   | Floor                      |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Inkeep**           | AI-in-Discord, docs-grounded, escalate→tagged human/ticket   | purpose-built for dev communities; ingests Mintlify/Docusaurus/GitHub/Discord; cited answers; closes docs↔support loop; OSS free tier | free → Enterprise (sales)  |
| **Plain**            | human ticketing surface where briefs land                    | B2B/dev-native, API-first, Discord + Linear/Jira + Cursor codebase lookup                                                             | $35/mo (50% startup disc.) |
| **Pylon** _(alt)_    | single-platform Discord→AI-triage→human-handoff-with-context | most mature one-stack flow                                                                                                            | ~$3–5k/yr                  |
| **Chatwoot** _(alt)_ | cost-min self-hosted (Captain answers → Handoff-to-Human)    | MIT, self-hostable, free for OSS                                                                                                      | free self-host             |

Avoid Zendesk (enterprise pricing, auto-billed resolution overages); Intercom Fin = premium graduate option.

## Community

**Discord is the proven moat** (ShipFast 5,000+ Discord = its durable advantage, "harder to replicate than code") AND a free distribution channel. **Do both:** Discord community for peer support/moat + an AI bot (Inkeep) absorbing repetitive FAQ so humans only touch judgment calls.

## Docs tooling → **Mintlify** (Fern if API-centric)

AI-native: agentic-RAG assistant, maintenance agent (opens PRs), **hosted MCP server + `llms.txt` + `skill.md`**, every page as `.md`. The docs double as (a) the Inkeep KB and (b) agent-readable context for buyers' coding agents. Budget path: Starlight/Docusaurus + self-hosted Inkeep.

## Value-add menu → mapped to tiers (ranked by retention × effort)

- **Base (one-time):** private GitHub repo + **lifetime updates** (written commitment) + Discord + **AI-native config bundle (AGENTS.md + scoped rules + buyer-facing MCP server WITH AUTH)** + AI-searchable docs.
- **Bundle (higher AOV):** + onboarding/architecture call + course/video + component/Figma kit + **AI Production Kit** (provider-agnostic AI config for all providers + settings config file + agent-assisted setup).
- **Subscription / credits (recurring MRR):** priority human-support SLA + private channel + updates-as-a-service + usage-metered AI-feature credits; grandfather buyers on price increases; white-label as top tier.
- **AppSumo:** only for a zero-audience launch (30–50% rev share + deal-hunters + low price anchor); once you have a list/Discord, self-host via a Merchant of Record.

## Ties to product (D12)

The **buyer-facing MCP server (with auth)** + **AGENTS.md config bundle** + **AI Production Kit** are simultaneously _product features_ AND _post-purchase value-adds_ AND the _"coach-not-wizard" agent-assisted onboarding_ the market is missing — one build, three payoffs. This is the spine of the **"your AI production codebase starter"** positioning.
