# ADR-0257 — Catalog-rework SPEC locks: full rename + bundle schema, F7/F8 split, merged org module, display direction

**Status:** accepted · 2026-07-06 (Kickoff D Stage 3 picker, round 1 of 2, against the Stage-3
research pass `wf_51c546a1-d3f`). **Realizes** ADR-0246 §Consequences (grant migration as a
design item) and ADR-0249's deferred package-shape call; **extends** ADR-0247 (F7/F8
mechanics), ADR-0250 (brand cut rides this SPEC), ADR-0255 (Kickoff E branch — the
`updatesWindows` claims rewrite this program's claims work rides behind). **Numbering note:**
filed from 0257 by cross-branch agreement with Kickoff E (`feat/independent-build-wave`
ceiling 0256 as of 2026-07-06); the dual-branch 0251/0252 collision renumbers at merge per
ADR-0088. **The bundle-model lock is an operator override** of the written stable-ids
recommendation. Append-only; supersede with a later ADR, never edit. **Tags:** none at lock;
the builds inherit `billing` + `external-system` + `security` + `ui`/`frontend`. Scope:
`outputs/specs/catalog-rework/SPEC.md` + `PLAN.md` (locked same session).

## Decision

1. **Bundle model = full rename + first-class bundle schema + alias map (override).**
   `registry-schema` gains an additive `"bundle"` module kind (the 20 historical
   `kind:"edition"` ledger entries stay valid — no ledger rewrite); the four persona bundles
   take new bundle ids; Provenance lands as a first-class bundle entry. A resolve-time alias
   map inside `expandEntitlements` is the SINGLE alias point for legacy purchased ids; a
   shared vocabulary constant is exported and consumed by Kickoff E's RENEWAL_BOOK lookup
   (E never re-keys — coordination locked with the E session 2026-07-06; this program owns
   the RENEWAL_BOOK lookup normalization and the cosmetic sandbox price-name sweep).
2. **F7/F8 = data + D-side enforcement here, on E's plumbing precedent.** This program
   builds the pricebook member-effective-dates timeline, the F8 item×bundle upgrade-credit
   map + checkout crediting, and the `entitledSince` per-purchased-id claims record + the
   per-member join-date fail-soft filter in `registry-schema` — sequenced after E's PR #128
   (ADR-0255). Boundary: E owns per-version enforcement (`publishedAt ≤ updatesWindows[id]`)
   in the Worker; D owns the per-member join-date filter in registry-schema. Absent key =
   grandfathered/unrestricted on both axes. (Refines the round-1 "enforcement in E" lock
   after E-session reconciliation — recorded here as the binding boundary.)
3. **Org module = ONE merged `@caisson/org-controls` at $249** (ADR-0252's merged price).
   Contents: WorkOS SSO + ONLY the owner-gated multi-user membership surface
   (`listAccountMembers`/`addAccountMember`/`assertCanManageMembers` — the research REFUTED
   the "zero blast radius" whole-file framing; session-resolution stays open) + the FULL
   6-export tenancy-rls admin-write layer (resolving ADR-0249 G6's 2-vs-6 ambiguity) + a new
   entitlement gate on the currently-ungated `/dashboard/members`. The $199 standalone
   branch is dead.
4. **Display = hub-extend + a fifth Provenance persona page**; `pricing.ts` moves to a 1:N
   `bundles[]` membership model (registry truth); renewal display defers to the dashboard
   until Kickoff E's plumbing lands.

## Consequences

- The catalog-rework SPEC/PLAN (same session) is the execution contract; waves ordered
  W0 vocabulary → W1 extractions ∥ W2 credits-flip → W4 gate checks → W5 bundle
  objects/republish → W3 claims (post-#128) → W6 display/legal → W7 Paddle+flip.
- All OSS-line moves land by W5 — the ADR-0248 ratchet clears before any first publish.
- ADR-0258 (same session) records the price consequences the round-2 picker locked.
