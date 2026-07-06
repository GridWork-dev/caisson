# ADR-0252 — Pricing-revalidation locks: formula-priced bundles, carve/new-SKU first prices, renewal cents, Local-first deferred

**Status:** accepted · 2026-07-06 (Kickoff D Stage 2 picker, three rounds). **Supersedes the
numbers** of ADR-0227 (Compliance $799 → $1,049) and ADR-0137's edition/Everything figures
where moved (AI-Production $599 → $629 · Agentic-Dev $249 → $329 · Everything $1,499 → $1,749);
**applies** ADR-0246 F6 (carve formula-priced), ADR-0247 F3 (0.75 anchor + below-sum
invariant), ADR-0249 G1 (bundle set + fold-ins), ADR-0244 (renewal band → real cents),
ADR-0251 (ui-pro band → cents). ADR-0240's Local-first $349 is **not** superseded — that
bundle's number is deferred to an operator-commissioned local-ai carve round (a scoped,
recorded re-open of ADR-0249 G7 for `local-ai` only; G7 stands unless that round locks a
carve). Evidence: `outputs/research/pricing-revalidation-2026-07.md`. Append-only; supersede
with a later ADR, never edit. **Tags:** none at lock (numbers policy); implementation inherits
`billing` + `external-system` at the Paddle/display builds.

## Decision

1. **Pricing logic = sum-of-parts, comps-anchored** (over the Clynova-band bundle-whole
   back-solve). The Vanta-TCO comparison is marketing narrative, never pricing logic.
2. **Bundle formula binding:** display = 0.75 × priced-member sum (registry-truth membership),
   rounded down to the 9-ending; below-sum invariant checked per bundle. **Everything = 0.75 ×
   Σ(bundle prices), recompute-on-move** — any bundle move re-runs it; Provenance contributes
   $0 incremental (strict member-subset of Compliance).
3. **Locked numbers (one-time USD):** Compliance bundle **$1,049** · AI-Production **$629** ·
   Agentic-Dev **$329** · Provenance **$399** · Everything **$1,749**. Carve/new SKUs: P_C
   compliance-core **$299** · P_F frameworks-pack **$249** · P_S signing-primitive **$199** ·
   tool-exec **$99** · auth-sso **$199 standalone / $249 if merged** with the rls admin-write
   org-controls carve (Stage 3 decides the package shape; both prices pre-locked) · credits
   post-decouple **$149** · billing-orchestration **$99** · ui-pro **$129**.
4. **Unchanged (revalidated, keep):** all 11 existing à-la-carte modules; Compliance-Updates
   $1,499/yr; Developer $499/yr; credit top-up $49/5,000 (margin audited 89.8%, mix-proof).
5. **Renewal cents = flat 40% of list, X9-rounded, per SKU** (Hex-Rays/JetBrains/AG-Grid/
   Binary-Ninja convergence): Compliance $419 · AI-Production $249 · Agentic-Dev $129 ·
   Everything $699 · Provenance $159 · Local-first $139 interim · modules 299→$119 · 249→$99 ·
   199→$79 · 149→$59 · 129→$49 · 99→$39 · 49→$19. Kickoff E's renewal plumbing wires these.
6. **Local-first bundle DEFERRED:** an operator-commissioned carve round (separability pass
   over `packages/local-ai` sync/inference/privacy, R3-shaped) decides its members before its
   number; **$349 carries as the interim display, unlocked**. Everything uses the interim value
   under the recompute-on-move rule.
7. **Display timing:** every number above ships to `apps/site/lib/pricing.ts` with the
   Stage-3/4 catalog-rework display build — no site edit rides this ADR. The lock is the ADR +
   `docs/gtm/pricing-packaging.md` (updated same commit).

## Consequences

- The Stage-3 catalog-rework SPEC receives a fully-priced catalog: bundle objects at these
  numbers, the crediting map (ADR-0247 F8) over them, Paddle product churn scoped to them
  (sandbox-first). Its open membership call (`credits` into AI-Production members?) re-runs
  that one formula if taken (0.75 × 994 ≈ $745).
- Registry-truth membership is binding for formula math: `field-crypto` counts in Compliance,
  AI-Production, and Local-first sums; `local-store` counts in Agentic-Dev — shared members
  ride the ADR-0247 crediting map, never double-charge.
- The below-sum standing check (ADR-0227 consequence) now reads against these sums; any member
  price or membership change re-opens the affected bundle number automatically.
- WTP validation stays operator-owed and optional: Cookiy survey 374111 is live; funding
  (~$20/40 respondents) needs live operator approval. Results validate, not block.
- Ops: `BUNDLED_PRICE_BOOK` lacks a Sonnet-4.5 row (fails closed — blocks Sonnet metering) →
  Linear work item; price-book version bumps become a recurring governance item.
