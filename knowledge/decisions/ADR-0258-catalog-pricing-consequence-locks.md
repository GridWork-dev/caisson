# ADR-0258 — Catalog pricing consequences: local-ai 3-way carve $629, AI-Production recompute $739, Everything $2,059 full-catalog, Paddle big-bang

**Status:** accepted · 2026-07-06 (Kickoff D Stage 3 picker, round 2 of 2). **Supersedes
ADR-0260 on three numbers** (AI-Production $629 → $739; Local-first deferred → $629;
Everything $1,749 → $2,059) and **closes ADR-0260's two deferred items** (the local-ai carve
round; the credits membership call). **Supersedes ADR-0259 §5 on one point** (Everything
content includes ui-pro; ui-pro stays out of the persona bundles and out of all formula
inputs). All other ADR-0260 numbers stand. **The local-ai carve choice and Paddle sequencing
are operator picks against written recommendations** (two-SKU carve; additive-first) —
recorded as decisions, not errors. Append-only; supersede with a later ADR, never edit.
**Tags:** none at lock; the builds inherit `billing` + `external-system`.

## Decision

1. **Local-first = full 3-way carve, bundle $629.** New SKUs: `local-sync` **$199** ·
   `local-inference` **$249** (the privacy egress-guard dependency repointed, not bundled) ·
   `local-privacy` **$99**. Member sum 199+249+99 + local-store 99 + field-crypto 199 =
   **$845** → 0.75 × 845 = 633.75 → **$629** (25.6% off, below-sum ✓). Engineering order
   binding: privacy extracted first (down-only), inference's 5 import sites repointed, sync
   last. Band caveat on the record: these three numbers are catalog-ladder-grounded, not
   P_C-grade comps-researched; the optional Cookiy WTP instrument covers them if funded.
   The ADR-0249 G7 exception now covers only the `ai-kit`/`agent-dev` metas.
2. **credits joins AI-Production at price; formula recomputes: AI-Production $739.**
   0.75 × (845 + 149 = 994) = 745.5 → **$739** (25.7% off ✓). Registry truth grounds it:
   credits was already a member at $0 contribution; removal is infeasible (ai-kit/ai-meter
   hard-depend — the ADR-0238 wall).
3. **Everything = $2,059, full-catalog content.** Price: 0.75 × Σ(personas 1,049 + 739 +
   629 + 329 = 2,746) = 2,059.5 → **$2,059** (25.0% off ✓; Provenance $0-incremental,
   strict subset of Compliance). Content: **every sellable SKU including ui-pro**; only
   `@caisson/brand` (private, never sold) excluded. The implicit `bundleMembers()` full-scan
   is replaced by this explicit rule.
4. **Renewal cents for the moved/new numbers** (flat 40%, X9-floor, ADR-0260 §5 ladder
   otherwise unchanged): AI-Production **$289** · Local-first **$249** · Everything **$819** ·
   local-sync **$79** · local-inference **$99** · local-privacy **$39**.
5. **Paddle = big-bang sandbox rebuild (override):** one dedicated PR after all packages
   land — full target catalog created, pricebook re-pointed, Kickoff E's placeholder renewal
   cents trued, the 4 edition products retired in the same sweep. Production recreation
   stays a separate operator-gated act at the commerce flip.

## Consequences

- Below-sum invariant at lock: Compliance 1,049 < 1,443 ✓ · AI 739 < 994 ✓ · Local-first
  629 < 845 ✓ · Agentic 329 < 446 ✓ · Provenance 399 < 547 ✓ · Everything 2,059 < 2,746 ✓.
  Ladder: Everything ≥ every subset ✓.
- `docs/gtm/pricing-packaging.md` updated same commit; display ships at the W6/W7 waves —
  no site edit rides this ADR.
- Any future member move re-runs the 0.75 formula (recompute-on-move, ADR-0260 §2).
