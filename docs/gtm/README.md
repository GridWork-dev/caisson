---
updated: 2026-07-11
status: live
grounds:
  - outputs/archive/specs/sot-expansion/SPEC.md
---

# docs/gtm — the business-side source of truth

The curated **business** layer for caisson: positioning, pricing/packaging rationale,
market/competitor intel, channels + launch sequencing, tools + COGS (the real monthly stack
bill), legal/MoR posture, and the ranked gap ledger. An agent or the operator reads this first
for the "why we sell it this way" answer; the raw scrapes, transcripts, and one-off memos it
distills stay in `outputs/research/`.

## Charter

- **This directory owns the BUSINESS side; `outputs/research/` is the raw layer.** These files
  distill research into a decision-ready form — they never replace it. When a number or claim
  needs its evidence, follow the citation down to the research file or ADR.
- **Every claim cites its source.** Each file lists its `grounds` in frontmatter and cites ADRs /
  research files inline. An uncited assertion is a bug — flag it, don't trust it.
- **Nothing here locks anything. Git owns decisions.** ADRs (`knowledge/decisions/`) and the live
  fork board (`docs/state/decisions-and-forks.md`) are the decision SOT. On any conflict, **the
  ADR wins** and this file is the stale side — reconcile it back, never the reverse. Pricing/
  packaging locks are ADRs; open questions are forks; this directory only explains them.

## Files

| File                         | Owns                                                                                                                                                                                                                                                                       | Primary grounds                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `positioning.md`             | Who it's for (3 ICPs + buyer firewall), the wedge-and-umbrella split, what Caisson is NOT, the canonical one-sentence/one-paragraph positioning, message hierarchy, voice floor, and code-as-proof points.                                                                 | ADR-0040, ADR-0080, specs/04                                                 |
| `pricing-packaging.md`       | The locked price matrix, the below-sum invariant, the 11-module catalog, the updates window, the credit policy, grandfathering posture, and what stays operator-adjustable pre-flip. **The one owner for committed price numbers** — other files link here, never restate. | ADR-0012/0106/0129/0137/0227/0238/0240/0244/0245, `apps/site/lib/pricing.ts` |
| `market-intel.md`            | The outside view only — per-segment competitor sets, the compliance wedge (Vanta-class vs library-class), component-market pricing norms, dated demand signals, and named threats. Not a decision surface.                                                                 | `outputs/research/` (market/demand/options)                                  |
| `channels-launch.md`         | Distribution bets (SEO/AEO + glossary program, Discord, docs-as-funnel), the support-bot escalation surface, and the business-level launch-readiness inputs. Runbook mechanics stay in `docs/ops/launch-runbook.md`.                                                       | ADR-0079/0206/0232/0235                                                      |
| `tools-cogs.md`              | The real monthly stack bill (flat / usage-scaling / revenue-contingent / one-time) and the per-sale COGS floor. Distills `../state/providers.md` into GTM terms.                                                                                                           | `../state/providers.md`, ADR-0098/0182/0222                                  |
| `legal-entity.md`            | Entity status (GA sole-prop, LLC trigger), the Paddle MoR chain (who sells/is liable/handles tax), EULA posture incl. the ADR-0244/0245 pre-flip copy gap, privacy/analytics posture.                                                                                      | `../state/go-live-legal-and-entity.md`, ADR-0108/0200/0244/0245/0236         |
| `gaps-and-plays.md`          | The 13-gap disposition from the 2026-07 research sweep with live status, plus the standing do-not-copy anti-decision list.                                                                                                                                                 | `outputs/research/monorepo-bigpicture-2026-07.md`                            |
| `design-partner-program.md`  | The partner-facing terms one-pager behind the quiet `/partners` surface (send-ready text + operator notes). Terms LOCKED: 5 partners · 40% off · 12-month reverting · case-study contingent on conversion.                                                                 | ADR-0297, ADR-0273, `outputs/research/wtp-memo-2026-07-10.md`                |
| `design-partner-outreach.md` | The recruiting layer: ranked top-10 shortlist, sequencing, channel plan, and the evidence-capture loop. Distills the 30-row candidate research; outreach itself stays an operator act.                                                                                     | `outputs/research/design-partner-candidates-2026-07-10.md`, ADR-0297         |
| `aeo-citation-tracking.md`   | The AI-citation tracking loop (gap #9): the canonical AEO query list + the pay-as-you-go OpenRouter probe cadence `gw-aeo-strategist` reads as its briefing input.                                                                                                         | ADR-0254, `tooling/scripts/aeo-probe.ts`                                     |
| `aeo-crawlability-audit.md`  | Code-level pass/fail audit of `apps/site`'s crawlability for search + AI-answer crawlers, plus the one launch blocker no code change can clear.                                                                                                                            | ADR-0079/0082/0235                                                           |
| `comparison-targets.md`      | The verified `Caisson vs X` target list (15–20 pages) driving the strongest single AEO lever found in pre-launch research, with the honesty-rule build discipline.                                                                                                         | ADR-0080, `docs/gtm/positioning.md`                                          |
| `directory-listings.md`      | Directory-submission prep (CAISSON-29 / D5) — dev-tools + compliance-infra directories ranked by fit, each verified to exist.                                                                                                                                              | ADR-0080/0082                                                                |

## Frontmatter convention

Every file in this directory carries a YAML block:

```yaml
---
updated: 2026-07-05 # date of the last real edit (ISO)
status: live # live | draft | stale
grounds: # every ADR / research file / code path this distills
  - knowledge/decisions/ADR-XXXX-slug.md
  - outputs/research/<file>.md
---
```

`status: stale` is the honest signal when a superseding ADR has landed but the file hasn't been
reconciled yet — set it rather than letting a reader trust drifted prose.

## Cross-links

Sibling files are referenced by bare filename (`pricing-packaging.md`), out-of-directory files by
repo-root-relative path in backticks (`docs/ops/launch-runbook.md`) or a `../` relative link.
The **catalog-doctrine fork** (whether editions become bundle options over an individually-
sellable package catalog) CLOSED 2026-07-06 — ADR-0257 (vocabulary: six bundles) / ADR-0258
(numbers), live in Paddle SANDBOX. Files that touch packaging structure now state the six-bundle
catalog as locked, not open; `outputs/archive/research/catalog-doctrine-2026-07.md` is the
research trail behind the lock, not an open question.
