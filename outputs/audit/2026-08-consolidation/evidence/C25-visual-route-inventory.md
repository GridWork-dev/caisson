# C25 — derive visual-harness public routes from canonical registries

**Verdict:** CONDITIONAL FOLD  
**Size:** approximately zero net; removes 20 duplicated route entries  
**Risk:** low

## Evidence

- Manual route arrays: `apps/site/scripts/visual-harness.ts:110-186`.
- Canonical marketing registry: `apps/site/lib/routes.ts:44-74`.
- Sitemap derivation: `apps/site/app/sitemap.ts:21-82`.
- Writing registry is already imported by another tool:
  `apps/site/scripts/regulatory-claim-watch.ts:29,153`.
- Current harness comparison found omitted public routes including `/writing`, `/trust`, `/support`,
  `/frameworks/eu-ai-act/article-50`, and a published writing spoke.

## Safe shape

Derive only canonical public marketing/legal/writing paths. Add `meta.path` to writing pieces if
needed. Keep explicit `/cart`, auth routes, dashboard routes, and other stateful exceptions in the
harness. This is correctness consolidation, not a LOC play.

## Registry/revenue

Operator-only local visual tool; no package, registry, or route runtime change.

## Refute attempt

Total elimination of route configuration was refuted because auth, cart, dashboard, and dynamic
states need explicit setup. The canonical public subset fold survived.

**Buyer/site notice:** none; visual coverage becomes less stale.
