---
title: "Research-response wave — SPEC"
date: 2026-07-07
status: locked (operator picker, fourth sitting — ADR-0272..0278)
tags: [ui, frontend, billing, security, auth, infra]
grounds:
  - outputs/research/prelaunch-fanout-2026-07/cookiy-deep-analysis-2026-07-07.md
  - knowledge/decisions/ADR-0272-research-response-site-wave.md
  - knowledge/decisions/ADR-0273-design-partner-program.md
  - knowledge/decisions/ADR-0274-evaluation-access-demo-and-eval-license.md
  - knowledge/decisions/ADR-0275-shipped-evidence-pack-artifact.md
  - knowledge/decisions/ADR-0276-eula-continuity-clause.md
  - knowledge/decisions/ADR-0277-named-regime-crosswalks.md
  - knowledge/decisions/ADR-0278-priority-support-sku.md
---

# Research-response wave — SPEC

## Goal

Convert the Cookiy deep-analysis findings into shipped surfaces and product changes while the
launch window is open (launch gated operator-side on LLC + EIN + Paddle production account).
Success = each objection cluster that the data says is answerable has its answer live in-repo:
proof surfaced, fit provable, terms explicit, evaluation possible, continuity codified.

## Non-goals

- No price changes (D2/D3 wait for the quant fills; ADR-0272 §5 is terms/framing only).
- No FedRAMP crosswalk (single mention — demand-driven later ADR).
- No MySQL port — the spike produces a decision doc, not code.
- The vendor report's Theme-2 maturity axis is refuted: no persona/maturity segmentation
  anywhere in copy or nav.

## Tracks

### Track S — site wave (ADR-0272 + the ADR-0273 application surface) · apps/site only

1. **Evidence-pack page** — public surface for the shipped proof artifacts (OSCAL conformance
   CI, threat models, test coverage, WORM live proofs, standards-gate). Links real artifacts
   from day one; upgrades to the ADR-0275 packaged download when Track V lands.
2. **Stack-fit adapter matrix** — ORM bridges (Drizzle/Prisma), auth/BYO providers, DB
   posture (Postgres-required vs DB-agnostic — honest, per the spike's eventual doc),
   no-hardcoded-infra; on the marketplace/compare surface.
3. **Trial-path emphasis** — create-caisson + deploy templates framed as "prove fit in week
   one" on module/bundle pages; upgrades to "request an evaluation" when Track E2 lands.
4. **Founder-transparency block** — open Apache Base + public changelog + who-builds-this.
5. **Pricing-terms rework** — the post-12-months answer on the pricing page; Developer plan
   reframed as security-patch continuity; support-responsiveness line; licensing/
   redistribution clarity at checkout. References the ADR-0276 clause once it ships.
6. **Design-partner quiet application surface** — apply-by-email, `/affiliates` pattern; no
   public countdown, no roadmap framing (ADR-0237 posture).

Copy laws ADR-0080/0237 bind; prices render from `pricing.ts` only (the PR #141 price-pin
test pattern extends to any new price mention).

### Track E1 — generator demo mode (ADR-0274 §1) · packages/cli

`create-caisson --demo`: full-catalog generation with demo stubs/watermarks for commercial
modules; runnable scaffolding; never licensable for production; zero license-service change.

### Track E2 — verified eval licenses (ADR-0274 §2) · services/license + apps/site (FABLE audit)

The eval grant kind: non-renewing ~14-day window, fail-closed expiry, revocable, watermarked
source delivery. The binding anti-exfiltration floor: verified work email on a company domain
(no free-mail) · one active eval per org domain + a global concurrent cap · card-on-file $0
authorization · operator review queue (approved, not instant) · per-eval buyer-identifying
watermarks in the tarball · no redistribution rights · standard deny-set on expiry/abuse ·
expansion through the fail-closed `expandEntitlements` boundary (expired/revoked → base
floor). Thresholds are config, not constants. Builds LAST in the wave; full SHIP-audit lane
with fable on the seam.

### Track V — evidence-pack artifact (ADR-0275) · CI + registry pipeline

Per-bundle CI aggregation: threat model + OSCAL/control crosswalk + coverage + SBOM +
standards-gate attestation → pre-purchase download (feeds Track S §1) + in-tarball delivery.
Release-gating: an incomplete pack fails the release loud. Index byte-identity untouched.

### Track C — named-regime crosswalks (ADR-0277) · compliance bundle

SOC 2 + PCI-DSS + GDPR mapping data + export routes over the existing OSCAL machinery;
golden-file-tested; lands inside the Track V pack when both exist.

### Track K — priority-support SKU (ADR-0278) · pricebook + billing + support-bot

Catalog row + Paddle SANDBOX subscription product (placeholder price; production numbers
operator-owned at flip) + entitlement id + support-bot priority routing keyed on it +
honest response-time copy (response-time, business days).

### Track L — EULA continuity clause (ADR-0276) · legal text

Draft the clause (perpetual offline verification · source retention · self-maintenance
conversion after N months of no security patches; N left blank for the operator) → operator
approves text → ships with/after Track S §5.

### Spike M — MySQL-compat scoping · decision doc only

Which packages are DB-agnostic today, what the Postgres-required/DB-agnostic split looks like
in the fit matrix, and a costed sketch of a MySQL lane. Output: a doc under
`outputs/research/`, feeding a future ADR — no code.

## Sequencing

ui-pro first-publish (already-armed separate act) → **Track S** (biggest immediate value, no
deps) with E1 + Spike M in parallel (disjoint trees) → **V + C** (pipeline + data) → **K** →
**E2 last** (license seam, fable). L drafts anytime; ships on operator approval. Every track:
worktree builder → in-session SHIP audits → PR → merge serially.

## Verify

- Track S: every objection cluster in the deep analysis's action table maps to a live URL.
- Track E2: an eval grant issued → expandEntitlements serves the window → expiry degrades to
  base floor at Worker/MCP/license — proven by tests at all three consumers.
- Track V: deleting one artifact input makes the release fail (gate proof).
- Goal-backward: re-read the deep analysis's "What survives" list; each item has a shipped
  answer or a tracker row naming why not.
