# ADR-0057 — Compliance control model: clean-room own-authored SCF-parity catalog + per-framework crosswalk

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Resolves the P2-12 control-mapping
SOURCE fork — the SCF licensing trap — for the Compliance hero.)

SOC2-TSC and HIPAA overlap heavily, so one canonical control catalog + per-framework crosswalk is the
model that scales to ADR-0040's framework set. The tension is the SOURCE: the best-in-class crosswalk
(Secure Controls Framework — 1,400+ controls, 200+ framework mappings, shipped as NIST OSCAL JSON) is
**CC-BY-ND 4.0**, whose NoDerivatives term collides head-on with Caisson being fully-commercial.

## Decision

Caisson authors its **OWN thin SOC2-TSC + HIPAA control catalog, hand-mapped**, in a
**canonical-catalog + per-framework-crosswalk** model: one canonical control set; each framework is a
pack that expresses its crosswalk as references onto that set, never a duplicated control list.

- **SCF-INSPIRED / parity for COVERAGE and structure, but CLEAN-ROOM.** Reference SCF only for _what_
  to cover (which controls a SOC2/HIPAA buyer expects, how the domains decompose); author all control
  text and every crosswalk expression **in-house, in Caisson's own manifest shape**.
- **NEVER ingest, copy, or transform SCF's CC-BY-ND 4.0 JSON.** NoDerivatives explicitly extends to
  AI-generated derivatives — pulling the JSON in (even as an agent transform) breaches the ND term and
  collides with the fully-commercial licensing model (ADR-0023). Flag-never-guess: no agent auto-pulls SCF.
- **The hero leads US frameworks (ADR-0040):** SOC2-TSC + HIPAA ship first. An **empty named slot is
  reserved for EU-AI-Act** (Annex IV) — a gated paid add-on whose content is authored later, not core.
- Implements the control registry under ADR-0006/0040 as a **typed `defineControl` / `defineFramework`
  builder, Zod `.strict()`-validated** (the `defineModule` precedent), golden-fixtured per ADR-0006/0013
  before any evidence logic. It **stays clean of ADR-0023 (fully-commercial)** — every authored control
  and crosswalk is `LicenseRef-Caisson-Commercial`-shippable with no third-party license attached. (The
  AGPL flank is irrelevant here: ADR-0050 brings local-ai commercial too, so there is no permissive
  escape hatch for compliance content either.)

## Rejected

- **Ship SCF verbatim + attribution (no transformation)** — ND-locked to SCF's exact IDs and structure;
  cannot be folded into Caisson's proprietary manifest shape, and resale-as-a-codebase-library legality
  is murky. The product needs owned, reshapeable content, not a frozen attributed blob.
- **Buy an SCF commercial license** (Tier-1 ~$25K/yr; Tier-2 ~$200K/yr + a cut of net sales, both
  restricted to "GRC or similar platforms") — unlocks derivative mappings and 200-framework breadth, but
  the cost and the "GRC platform" use restriction may not fit a sold **codebase library** rather than a
  hosted GRC product.
- **NIST OSCAL public-domain catalogs only** (800-53, FedRAMP) — sidesteps SCF entirely and is freely
  reshapeable, but provides **no SOC2/HIPAA crosswalk** — the exact thing the hero needs.

## Binding

No CC-BY-ND / NoDerivatives-licensed catalog (SCF first among them) is ever ingested, copied, or
transformed into the product; SCF is consulted **only** as a coverage-and-structure reference, and every
control's text plus every crosswalk reference is authored in-house. The catalog is one canonical control
set with per-framework crosswalk packs — US frameworks (SOC2-TSC + HIPAA) first per ADR-0040, EU-AI-Act
a reserved empty named slot — expressed as typed `defineControl`/`defineFramework` builders validated
with Zod `.strict()` and golden-fixtured before any evidence-pack logic depends on them. All of it ships
under `LicenseRef-Caisson-Commercial` (ADR-0023 / ADR-0050) with no third-party license obligation.
Evidence: ADR-0023 (fully-commercial, no permissive tier); ADR-0050 (local-ai also commercial); ADR-0040:46-60
(US frameworks lead, EU-AI-Act gated add-on, entitlement-scoped framework modules); ADR-0006/0013
(golden-file regression before evidence logic); ADR-0020 (`defineModule` typed-manifest ethos);
`outputs/research/wave1-forks.md` P2-12 (the SCF CC-BY-ND trap) + P2-11 (typed control registry).
