# ADR-0249 — Catalog follow-up picker (G-series): bundle set, billing split, auth-sso carve, credits sequence, rls carve, metas

**Status:** accepted · 2026-07-05 (G-series picker against
`outputs/research/catalog-rework-brainstorm-2026-07.md` §5, run in the SOT-expansion session in
two structured rounds). Realizes ADR-0246's bundle-set mandate and applies the ADR-0248
buyer-based standard to its first per-package verdicts. **G2 (ui/kit shape) is NOT locked here**
— the operator redirected it wider (public full-surface customizable kit + separate internal
brand layer + per-package frontend surfaces); grounded options return in the same session's
follow-up round. Two operator overrides of the written recommendations are recorded below as
overrides. Append-only; supersede with a later ADR, never edit. **Tags:** none at lock; the
builds inherit `billing` (G3/G5) and the standards-gate critical path (boundary edits).

## Decision

1. **G1 = (a+) — the bundle set is Persona + Provenance:** the four ICP-mapped bundles
   (Compliance hero with the ADR-0246 3-SKU carve · AI-Production with `ai-evals` folded in as
   a real member · Local-first · Agentic-Dev with `tool-exec` added) + Everything, **plus the
   Provenance cross-bundle** = `signing-primitive` + `audit-worm` + `field-crypto` — the named
   landing spot for the non-compliance buyer who wants tamper-evidence à la carte. All prices
   via the ADR-0247 formula at the pricing pass; shared members ride the crediting map.
2. **G3 — `billing` splits:** raw webhook signature-verify stays open (the day-one dev-workflow
   floor); the multi-provider orchestration layer (Stripe/Paddle/LemonSqueezy/Polar checkout +
   idempotent side-effects) carves commercial. Honors both readings of the buyer-based test.
3. **G4 — `auth` carves:** `jwt.ts`/`session.ts` stay open; `workos.ts` + `membership.ts`
   (enterprise SSO + org roles) carve commercial.
4. **G5 = decouple-then-flip (operator override of keep-open):** the `cli` codegen-debit gate
   is decoupled from `@caisson/credits` (a queued build item on the generator's path), and
   `credits` then flips commercial. The flip is sequenced behind the decouple — never before
   (open-generator-depends-up violation otherwise).
5. **G6 = carve the admin-write layer (operator override of keep-whole-open):**
   `buildAdminWritePolicySql`/`withAdminWrite` (the org-controls layer of `tenancy-rls`) carve
   commercial; the fail-closed RLS foundation (`withTenant`, `buildTenantPolicySql`) stays open
   and the positioning proof point is preserved and must be re-verified in copy at the carve.
   Packaging note: the G4 + G6 carves MAY land in one commercial org/enterprise module — the
   catalog-rework SPEC decides the package shape, not this ADR.
6. **G7 — the `ai-kit`/`local-ai`/`agent-dev` meta-packages stay unpriced bundle-glue** (the
   ADR-0238 install-wall stands for them); each remains carve-eligible only via a
   concern-by-concern case like compliance's.

## Consequences

- All carves/flips (G3/G4/G5/G6) execute **before first publish** or not at all (the ADR-0248
  ratchet); each lands via the catalog-rework SPEC with standards-gate boundary updates
  (`OPEN_BASE_NAMES` untouched — the carved packages are NEW commercial names; the source
  packages stay open with narrower surfaces).
- The pricing-revalidation pass gains SKUs to price: the Provenance bundle, the billing
  orchestration module, the auth-sso/org module (possibly merged with the G6 carve), and
  post-decouple `credits`.
- The tracker's catalog-rework SPEC row now has its full scope: bundle objects + grant
  migration + the ADR-0246 carve + the four G-carves + the cli-debit decouple.
