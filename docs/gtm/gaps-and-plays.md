---
updated: 2026-07-11
status: live
grounds:
  - outputs/research/monorepo-bigpicture-2026-07.md
  - outputs/archive/kickoffs/KICKOFF-B-hygiene-audit-remediation.md
  - knowledge/decisions/ADR-0244-*.md
  - knowledge/decisions/ADR-0245-*.md
  - knowledge/decisions/ADR-0254-measurement-pair-citation-loop-docs-funnel.md
---

# Gaps and plays

The 13-gap disposition from the 2026-07 five-angle research sweep (monorepo engineering,
productized-library GTM, solo-operator ops, SEO/AEO for devtools, agent-driven repo ops), plus
the standing do-not-copy list. Source: `outputs/research/monorepo-bigpicture-2026-07.md` §2–3.
Raw evidence and full URL list stay in that file — this page tracks live disposition only.

## Gap ledger

| #   | Gap                                                                                                    | Live status                        | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Perpetual license had no stated updates/renewal window                                                 | **CLOSED** — ADR-0244 (2026-07-05) | One-time purchases = perpetual use + 12 months included updates + ~40% renewal for continued updates. Must land in checkout copy + EULA before the pricing flip.                                                                                                                                                                                                                                                                                   |
| 2   | Credit rollover / top-up policy undecided                                                              | **CLOSED** — ADR-0245 (2026-07-05) | Pooled rollover, every grant expires 12 months from issue, FIFO burn; $49 top-up pack per ADR-0222.                                                                                                                                                                                                                                                                                                                                                |
| 3   | Root CLAUDE.md embeds the full ADR-0001→0242 catalog inline instead of pointing at `docs/adr-index.md` | **CLOSED** — PR #126 (2026-07-05)  | Trim to ceiling number + pointer + one-line renumbering convention note. Tracked in `outputs/archive/specs/sot-expansion/SPEC.md` §1.5.                                                                                                                                                                                                                                                                                                            |
| 4   | No package-manager catalog for shared deps (zod across 4 semver ranges, typescript across 5)           | **CLOSED** — PR #127 (2026-07-05)  | One `catalog:` block in root `package.json`; zod v3-vs-v4 mini-audit runs first as a judgment call per package family.                                                                                                                                                                                                                                                                                                                             |
| 5   | `build-vs-buy` page named in ADR-0079, never built                                                     | **CLOSED** — PR #127 (2026-07-05)  | Pattern already designed; ships through the F7 draft→skeptic→gate copy pipeline.                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | Cloudflare Content-Signals header (ADR-0079 §5) not implemented                                        | **CLOSED** — PR #127 (2026-07-05)  | One response header; completes an already-locked decision.                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | No unused-dependency / unused-export gate                                                              | **CLOSED** — PR #127 (2026-07-05)  | Add `knip` + one CI step.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 8   | No automated dependency-update bot                                                                     | **CLOSED** — PR #127 (2026-07-05)  | `renovate.json` or `dependabot.yml`; pairs with #4.                                                                                                                                                                                                                                                                                                                                                                                                |
| 9   | No AI-citation tracking loop                                                                           | **CLOSED** — ADR-0254 (2026-07-06) | Pay-as-you-go OpenRouter-routed probe loop wired: `docs/gtm/aeo-citation-tracking.md` (18-question canonical set + snapshots) + `tooling/scripts/aeo-probe.ts` + `.github/workflows/aeo-probe.yml` (monthly). `gw-aeo-strategist` reads the doc as its category-queries input.                                                                                                                                                                     |
| 10  | Changesets `ignore`/`privatePackages` policy undeclared                                                | **CLOSED** — PR #127 (2026-07-05)  | One config block; codifies what `private: true` defaults already do correctly.                                                                                                                                                                                                                                                                                                                                                                     |
| 11  | Support-bot escalation is binary (answer or ticket), not a 3-tier confidence gate                      | **TRIGGER-PARKED**                 | Revisit once the bot carries real support volume — best-practice RAG support is high→auto-answer / medium→suggest-to-staff / low→escalate.                                                                                                                                                                                                                                                                                                         |
| 12  | No docs discover→quickstart→signup conversion instrumentation                                          | **CLOSED** — ADR-0254 (2026-07-06) | Split assignment (Option C) built: Plausible `docs_cta_click`/`signup_complete` + a quickstart-page CTA; PostHog `account_created` beside the existing `identify()`, `signup_source` stitched from `?ref=`. No PostHog JS on docs (F8 holds). See `docs/gtm/channels-launch.md`.                                                                                                                                                                   |
| 13  | No affiliate / recurring-commission program                                                            | **BUILT**                          | BUILT. ADR-0320 (2026-07-10, Kickoff-N) fixed the parameters at flat 10% buyer discount / 30% commission (no tiers — the 30%→50% tier framing was dropped from `/affiliates` copy) and closed the production flip: mint route (`apps/admin/src/app/api/admin/affiliate/mint/route.ts`), admin dashboard surface (`apps/admin/src/app/business/affiliates/page.tsx`), and discount_id capture on both one-time and subscription paths are all live. |

## New plays from the Cookiy report residuals (2026-07-11)

Two findings pulled from Cookiy's own platform reports that never made the in-house
wtp-synthesis R-list (evidence: studies 019f4a11 + 019f3aeb, report pull 2026-07-11):

- **"Weeks-saved" ROI framing near the price** (CAISSON-98, rides Session A): approval is
  two-tiered — champion picks, finance signs off on a "weeks of engineering time saved"
  translation. Put the math on the page ("$1,049 ≈ 4-8 engineering-weeks saved", the
  interviewees' own build-estimate range) on the pricing surface + how-to-buy lede.
- **"Stop the next war-room sprint" angle** (CAISSON-99): buyers build compliance
  REACTIVELY in crisis sprints when a prospect demands proof. Nobody markets to that
  trigger moment. Candidate homes: compliance bundle page, positioning angle inventory.

## Do not copy (standing anti-decision list)

- **shadcn `registry.json` agent-install channel** — `registry.caisson.sh` (ADR-0223) already
  superset of this, plus commercial gating shadcn has no model for; an unauthed install channel
  would undercut the paywall.
- **Live phone-home license verification (Cal.com model)** — offline Ed25519 verification was a
  deliberate choice; Cal.com's own issue #23342 documents phone-home breaking customers after
  trial expiry. Do not "modernize" toward the network check.
- **ADR-injection / ADR-enforcement CI tooling** (adr-kit, adr-governance) — over-engineering at
  solo scale; append-only immutability + the hand-synthesized `docs/adr-index.md` already manage
  240+ ADRs. The one worthwhile ADR-adjacent fix is #3 above (deletion, not automation).
- **CI doc-code sync gate that auto-drafts doc PRs** (docs-gate, veritas) — a noise generator for
  an operator who narrates state docs in-session; the dated-banner + append-only discipline is
  already eyeball-verifiable.
- **`turbo --affected` on the required `check` gate** — would skip validation of a release-blocking
  gate; keep the full graph. (A shared remote cache is marginally worth it, low priority.)
- **Collapsing the 5-service Railway topology to one host** — the product's editions plus a Python
  support-bot are genuinely different runtimes, plus a Cloudflare Worker registry; a monolith
  fights the product shape.
- **Over-investing in llms.txt as an AI-visibility lever** — already shipped, correctly scoped as
  a coding-agent token-saver (ADR-0237 F8). 97% of llms.txt files get zero AI-bot traffic; don't
  expect ranking lift.

## Catalog-doctrine fork — CLOSED

The R3 compliance-package-split price question was redirected into a catalog-doctrine research
round rather than decided directly. That round **locked 2026-07-06** (ADR-0257 vocabulary ·
ADR-0258 numbers): all editions dissolved into six individually-priced bundles (Compliance,
AI-Production, Local-first, Agentic-Dev, Provenance, Everything) over a fully à-la-carte package
catalog, with the open/commercial line unchanged and live in Paddle SANDBOX (PR #130). Research
trail: `outputs/archive/research/catalog-doctrine-2026-07.md`. Any pricing structure work
referencing this repo's editions should now use the bundle vocabulary — see
`docs/gtm/pricing-packaging.md` for the current matrix.
