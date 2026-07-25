---
status: shipped (PR #307)
locked_by: ADR-0371
tags: [product, ui]
date: 2026-07-20
---

# SPEC — Buyer-facing trust/status-page generator

**Goal.** Every hosted competitor sells a "trust center" as a login-gated portal. Caisson's
honest substitute is a static-render library: the buyer's evidence pack + rollup rendered to a
page they host themselves — keep the artifact, refuse the portal. Explicitly distinct from
Caisson's own `/trust` page (ADR-0348): this is a module a BUYER uses to publish THEIR posture.

**SKU posture (ADR-0371):** NEW catalog module on a **reserved id** (sold-unpublished pattern) —
not sellable, not displayed, until the pricing round arms it.

## Scope

1. A static-site/JSON generator consuming the evidence pack + crosswalk rollup; output = a
   deployable static page (self-contained HTML + JSON) the buyer hosts anywhere.
2. **Redaction is allowlist-based (binding):** an explicit per-field PUBLIC allowlist — a field
   absent from the allowlist never renders. Denylists rejected (silently leak later-added
   fields). The default allowlist is minimal and documented.
3. Rendering goes through the **shared render primitive** (same lane as the SoA generator).
4. Copy obeys ADR-0080: readiness/posture language, never "certified/compliant".

## Non-goals (binding)

- **No auth, no reviewer sign-off, no hosted comments, and the NDA-gated variant is a
  PERMANENT non-goal** (ADR-0371) — any of those makes it the wrong-class portal under a
  different name.
- No hosting service — Caisson generates, the buyer deploys.

## Verification

- Redaction test: a field added to the evidence pack but not the allowlist does NOT appear in
  any output byte (positive leak-check, not just a unit test of the filter).
- Golden render from a fixture pack; deterministic bytes.
- Copy lint: the generated page passes the existing claim-language checks (no forbidden
  compliance claims).
