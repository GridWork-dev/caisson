# Pricing-revalidation pass — evidence memo + formula sheet (Kickoff D Stage 2)

**Dated 2026-07-06.** The operator-commissioned pass ADR-0246 §Consequences queued: every
displayed number re-validated live, the new-SKU first prices, the anchor tension resolved, and
the renewal cents. Evidence: 10-agent workflow `wf_a48a04fe-2de` (5 sonnet pricing lanes — 3
module-comp sweeps, the compliance anchor/WTP memo on the `gw-pricing-analyst` lane, the
recurring/renewal survey — an opus completeness critic, and 4 gap-fills: a P_C peer hunt, the
Cookiy funding attempt, a repo-grounded credit-margin audit, and the 3-bundle resolution model).
Full agent returns: the session workflow journal. **Locks recorded in ADR-0252**; this memo is
the evidence record. Nothing here re-opens a lock.

## 1. Registry-truth corrections (load-bearing)

Three of the research agents' bundle sums used wrong member sets. Verified directly against
`registry/index.json` latest-version `members` maps:

- `field-crypto` ($199) is a member of **three** bundles — compliance 0.3.1, ai-kit 0.3.0,
  local-ai 0.2.3 — the agents omitted it from the AI and Local-first sums.
- `local-store` ($99) is a member of **agent-dev 0.2.3** — omitted from the Agentic sum.

Corrected priced-member sums (current prices, pre-carve): Compliance $696 · AI-Production $845
(with the ADR-0249 G1 `ai-evals` fold-in) · Local-first $298 · Agentic-Dev $347 + P_T. The
corrections flip the AI-Production story from "formula cuts $599 → $484" to "formula raises
$599 → $634", and soften the Local-first floor from $74 to $224.

## 2. The anchor tension — how it resolved

Two logics, presented as Round-1 fork options:

- **Sum-of-parts (comps-anchored):** carve SKUs priced inside their own researched bands →
  bundle ≈ $999–1,049. Keeps the catalog's module-tier coherence ($49–299).
- **Bundle-whole (Clynova-anchored):** $1,999–2,499, resting on Clynova ($999/$1,999 one-time,
  re-scraped 2026-07-06, unchanged) + one new lower-confidence comp (NouchiX CMMC lifetime
  $497/$1,997/$4,997 — explicitly scarcity-priced founder tiers; vendor's own steady-state is
  $25–75k/yr SaaS) + PAL/gpt-5.2 consensus (8/10). Requires carve SKUs at $650–880 each with a
  confirmed comp desert under P_C.

**Operator locked sum-of-parts: Compliance $1,049.** The Vanta/Drata TCO band ($8–40k+/yr,
all quote-gated, third-party-reported) stays marketing narrative ("less than 2 months of your
first Vanta invoice, and you own it forever"), never pricing logic.

## 3. The locked sheet (ADR-0252)

**Formula: bundle display = 0.75 × priced-member sum, rounded down to the 9-ending; the
ADR-0137/0247 below-sum invariant checked per bundle. Everything = 0.75 × Σ(bundle prices),
recompute-on-move.**

| SKU                                        | Locked                                                                                          | Formula input                                                                                                              | Was                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Compliance bundle**                      | **$1,049**                                                                                      | 0.75 × (299+249+199+199+149+149+199 = 1,443) = 1,082                                                                       | $799 (ADR-0227, superseded)    |
| **AI-Production bundle**                   | **$629**                                                                                        | 0.75 × (199+199+199+149+99 = 845) = 634                                                                                    | $599 (superseded)              |
| **Local-first bundle**                     | **DEFERRED** — carve round queued                                                               | formula floor 0.75 × 298 = 224; core (3,063 LOC sync/inference/privacy) unpriced per ADR-0249 G7                           | $349 carries interim, unlocked |
| **Agentic-Dev bundle**                     | **$329**                                                                                        | 0.75 × (199+49+99+99 = 446) = 335                                                                                          | $249 (superseded)              |
| **Provenance bundle** (new)                | **$399**                                                                                        | 0.75 × (199+149+199 = 547) = 410; strict subset of Compliance members → contributes $0 incremental to Everything           | —                              |
| **Everything bundle**                      | **$1,749**                                                                                      | 0.75 × (1,049+629+349+329 = 2,356) = 1,767                                                                                 | $1,499 (superseded)            |
| P_C compliance-core (evidence assembly)    | **$299**                                                                                        | comp desert confirmed (everything is $0-OSS or quote-gated SaaS); internal premium tier                                    | new                            |
| P_F frameworks-pack (SOC2+HIPAA+EU-AI-Act) | **$249**                                                                                        | one-time comps per framework $59–1,050; 3-framework pack below summed retail                                               | new                            |
| P_S signing-primitive (Ed25519+RFC-3161)   | **$199**                                                                                        | signfiles TSA €1,450 one-time; free Sigstore/OpenTimestamps are shared public infra, not per-tenant                        | new                            |
| tool-exec                                  | **$99**                                                                                         | Composio $29/mo entry; trio coherence with kernel/runner                                                                   | new                            |
| auth-sso                                   | **$199** standalone / **$249** merged with rls admin-write org-controls (Stage 3 decides shape) | WorkOS $125/connection/mo context; $0-OSS floor (SSOReady/BoxyHQ)                                                          | new                            |
| credits (post-decouple)                    | **$149**                                                                                        | Stigg $399/mo validates; Lago free-OSS caps                                                                                | new                            |
| billing-orchestration                      | **$99**                                                                                         | Kill Bill/Lago free-OSS ceiling                                                                                            | new                            |
| ui-pro                                     | **$129**                                                                                        | within the ADR-0251 band ($129–199); operator took the low end                                                             | banded Stage 1                 |
| 11 existing modules                        | **all unchanged**                                                                               | every verdict "keep"; each sits under one month of its cheapest hosted comp                                                | $49–199                        |
| Compliance-Updates                         | **$1,499/yr** (keep)                                                                            | bracketed by compliance.tf $1,000 / SchemaPilot Pro $1,788                                                                 | —                              |
| Developer                                  | **$499/yr** (keep)                                                                              | Copilot Pro+ $468 / Cursor Pro+ $720 boundary                                                                              | —                              |
| Credit top-up                              | **$49 / 5,000** (keep)                                                                          | ≈ GitHub's defined $0.01/credit; **89.8% audited margin**, mix-proof (credits are par-cost $0.001 units; break-even $5.00) | —                              |
| **Updates-renewal**                        | **flat 40% of list, X9-rounded**                                                                | Hex-Rays 40% · JetBrains floor exactly 40% off · AG Grid ~35–47% · Binary Ninja 50%                                        | policy ADR-0244                |

Renewal cents at lock: Compliance $419 · AI-Production $249 · Agentic-Dev $129 · Everything
$699 · Provenance $159 · Local-first $139 interim · modules 299→$119 · 249→$99 · 199→$79 ·
149→$59 · 129→$49 · 99→$39 · 49→$19. Kickoff E builds the renewal plumbing; these are the
real cents it wires.

**Below-sum invariant check at lock (per bundle):** Compliance 1,049 < 1,443 ✓ (27.3% off) ·
AI 629 < 845 ✓ (25.6%) · Agentic 329 < 446 ✓ (26.2%) · Provenance 399 < 547 ✓ (27.1%) ·
Everything 1,749 < 2,356 ✓ (25.8%). Ladder: Everything ≥ every subset ✓.

## 4. Deferred / conditioned

1. **Local-first carve round (operator-commissioned this pass):** a concern-by-concern
   separability pass over `packages/local-ai` (sync 787 LOC · inference 1,524 · privacy 279) —
   the same shape as compliance's R3 — to create priced members or confirm the exception. Until
   it locks, $349 carries as the interim display and Everything uses it.
2. **credits bundle membership:** whether commercial `credits` ($149) joins the AI-Production
   member set is the Stage-3 catalog-rework's membership call; if it joins, the formula re-runs
   (0.75 × 994 ≈ $745).
3. **Display timing:** all numbers ride the Stage-3/4 catalog-rework display build — no
   pricing.ts edit now (operator lock, Round 3).
4. **WTP validation (operator-owed, optional):** the Cookiy Van Westendorp instrument
   (survey 374111) is live, correctly built, and unanswered; recruitment (~$20 / 40
   respondents) was blocked by the permission gate pending live operator approval. Wallet
   $1.20. If funded post-lock, it validates rather than blocks.

## 5. Ops findings routed out of this pass

- `BUNDLED_PRICE_BOOK` has **no `anthropic/claude-sonnet-4.5` row** — metering Sonnet-tier
  usage throws `ConfigError` (fails closed; blocks, doesn't leak). Add at the verified $3/$15
  per MTok; treat `PRICE_BOOK_VERSION` bumps as recurring governance. → Linear.
- The credit-margin audit confirmed rounding is conservative both directions (`ceil` on debit,
  floor on grant) — margin cannot erode from usage mix, only from price-book staleness.
