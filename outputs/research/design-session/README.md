# Design · Brand · SEO · Copy — research session (2026-06-27)

Ultracode research fanout for the Caisson Design·Brand·SEO·Copy scope session. 12 research
agents (refero reference · exa competitor teardown · exa SEO landscape · impeccable craft audit ·
current-state audits) → synthesis → completeness critic → a consolidated **148-fork board**.

Run as a background Workflow (`caisson-design-research`, run `wf_d10ca153-705`): 14 agents,
~2.46M subagent tokens. 9/12 research agents returned structured forks; **3 agents**
(`refero-pricing-edition`, `refero-screens-motion`, `exa-seo-technical`) hit the structured-return
retry cap but **wrote their full markdown artifacts first** — the synthesis read those off-disk, so
their forks are folded into the board (evidence cites `refero-pricing V*`, `refero-screens #*`,
`seo-technical F*`).

## The consolidated board

→ **`outputs/specs/design-brand-site-seo/FORK-BOARD.md`** (all 148 forks: options · recommendation ·
confidence · evidence). Live-board pointer + locked outcomes in `docs/state/decisions-and-forks.md`.

## Artifacts (raw agent output, durable)

| File                                 | Agent                | What                                                                                                                      |
| ------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `refero-brand-identity.md`           | gw-frontend-designer | wordmark/logomark · iconography · illustration/texture · motion references (Axiom, Linear, Vercel, Twingate, PlanetScale) |
| `refero-landing-hero.md`             | gw-frontend-designer | hero/landing patterns, evidence-as-hero, section rhythm, social-proof                                                     |
| `refero-pricing-edition.md`          | gw-frontend-designer | pricing-without-prices + edition-page layouts (synthesis read off-disk)                                                   |
| `refero-screens-motion.md`           | gw-frontend-designer | docs/dashboard screens + motion/interaction flows (synthesis read off-disk)                                               |
| `exa-competitor-compliance.md`       | gw-researcher        | Vanta/Drata/Secureframe/Oneleet/compliance.tf teardown                                                                    |
| `exa-competitor-devtools-aiinfra.md` | gw-researcher        | ShipFast/MakerKit + Helicone/Langfuse/Portkey + local-first teardown                                                      |
| `exa-seo-keywords-content.md`        | gw-researcher        | keyword clusters per persona, programmatic-SEO, IA/internal-linking                                                       |
| `exa-seo-technical.md`               | gw-researcher        | JSON-LD/OG/CWV/font-loading/AI-crawler for static Next 16 on CF Pages (synthesis read off-disk)                           |
| `impeccable-craft-audit.md`          | gw-frontend-designer | craft detector pass on the rendered marketing surface (P0/P1/P2)                                                          |
| `current-state-copy.md`              | gw-researcher        | per-page copy audit vs specs/04 voice                                                                                     |
| `current-state-seo.md`               | gw-researcher        | SEO inventory + gap analysis                                                                                              |
| `current-state-brand-tokens.md`      | gw-frontend-designer | token/brand-system completeness vs ADR-0042; expansion needs                                                              |

## Scope reminder (binding)

Spec-first, doc-only — no `apps/site` / `packages/ui` product code this session. ADR-0040 (hero) and
ADR-0041 (name) stay LOCKED. ADR-0042 (palette A + Structural type) MAY be widened by a new append-only
ADR. Locks → ADRs from **0078+** (Wave-1 reserved through 0077).
