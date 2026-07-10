---
updated: 2026-07-10
status: live
grounds:
  - docs/state/go-live-legal-and-entity.md
  - knowledge/decisions/ADR-0276-eula-continuity-clause.md
  - knowledge/decisions/ADR-0282-eula-continuity-parameters.md
  - knowledge/decisions/ADR-0302-subscription-refund-coverage-horizon.md
  - apps/site/app/legal/eula/page.tsx
---

# Legal review brief — one engagement, three scopes (operator-locked 2026-07-10)

The single lawyer engagement for launch (picker L1/L2, 2026-07-10): **entity core + commercial
paper + open-core/trademark, engaged now** — lead time runs parallel to the EIN wait
(est. 2026-07-21) and the Paddle production review. Program agreements (design-partner
signable, affiliate terms) were deliberately EXCLUDED from this round — they stay
operator-level marketing terms until a partner or the affiliate flip demands paper.

Entity facts to fill from the formation documents (`~/lab/caisson-inbox/CAISSON.zip` intake):
exact LLC legal name · state + formation date · registered agent · member/ownership structure.
The legal name must then propagate IDENTICALLY to the site ToS + the Paddle business form
(rejection-cause: entity mismatch — CAISSON-31).

## Scope 1 — entity core

1. **Operating agreement finalization.** The operator's draft is a free template; the lawyer
   produces the final. MUST align with the EULA vendor-continuity clause the site already
   serves (ADR-0276/0282: Continuity Event + Affiliate definitions, §365(n) successors
   language, prospective-only cure) — dissolution/assignment/successor provisions in the OA
   cannot contradict what the EULA promises buyers.
2. **IP assignment, founder → LLC.** All Caisson code, brand, and content predates the entity.
   The EULA licenses IP the LLC must own before the first sale; a short assignment (code,
   marks, domains, content, the `caisson-sh` org/npm scope) closes it.

## Scope 2 — commercial paper

3. **EULA review** (`apps/site/app/legal/eula/page.tsx`, Last-updated 2026-07-10): per-org
   no-seat licensing (ADR-0305), the continuity clause (ADR-0276/0282), the
   subscription-refund coverage-horizon claw (ADR-0302), 12-month updates windows +
   perpetual-ownership framing (ADR-0244/0251), evaluation/eval-license terms (ADR-0274/0280).
4. **ToS + privacy + refund policy.** Refund policy must read as an unconditional guarantee
   with zero qualifiers (Paddle-verification rejection-cause otherwise) — this review doubles
   as Paddle application prep. Privacy covers Plausible (cookieless), PostHog (dashboard
   routes), OTLP telemetry, and the support-bot Discord surface.

## Scope 3 — open-core + trademark

5. **Open-core boundary sanity pass.** Apache-2.0 base (16 packages, public mirror
   `caisson-sh/caisson-oss` + `@caisson-sh/*` npm) vs commercial bundles — confirm the LICENSE
   files, the mirror's read-only posture, and the EULA don't leak rights across the seam
   (ADR-0094/0097/0136/0222).
6. **"Caisson" trademark usage policy** for the public repo: what forks/redistributors of the
   Apache base may call themselves; publishable as a short `TRADEMARK.md` on the mirror.

## Deliverables checklist

- [ ] Final operating agreement (continuity-aligned)
- [ ] Executed IP assignment
- [ ] EULA redline + accepted final
- [ ] ToS/privacy/refund redlines (refund wording Paddle-safe)
- [ ] Open-core boundary memo (short)
- [ ] TRADEMARK.md text for the mirror

## Sequencing notes

- Engage now; the OA final + IP assignment are wanted before first sale, not before Paddle
  application (which can start immediately — formation docs suffice for business verification;
  Paddle explicitly does not take EIN/tax docs).
- Mercury is EIN-gated (CP-575 verified against the IRS database; applying early
  auto-rejects) but NOT gated on the lawyer-final OA — the draft PDF suffices if ownership
  documentation is requested. Apply ~2 days after the EIN lands.
- Paddle's verification pass may surface specific policy objections — feed them to the lawyer
  as addenda rather than holding the engagement for them.
