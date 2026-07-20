# ADR-0371 — Compliance-gap module SPEC locks (all five stubs, twelve forks, three rounds)

**Status:** accepted · 2026-07-20 (the full SPEC-lock picker over
`outputs/specs/compliance-gap-candidates/SPEC-STUBS-2026-07-19.md`, operator-locked in three
rounds). Promotes all five stubs to locked SPECs (`outputs/specs/{compliance-drift-monitor,
access-review-campaigns,general-risk-register,iso-soa-generator,trust-page-generator}/`).
Append-only; supersede with a later ADR, never edit.
**Tags:** product (trust-page adds `ui`; risk-register touches a shipped collector's goldens).

## Decision

| Fork                                 | Lock                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Drift: baseline semantics**        | **Typed first-class accepted-deviation state** — a WORM-attested record (control id, reason, acceptor, expiry) the diff engine honors; re-alerts suppressed until expiry or regression past the accepted baseline.                                                             |
| **Drift: anchoring scope**           | **Every snapshot anchored** — each scheduled snapshot digest goes through the existing anchoring seam; the provable continuous-posture timeline IS the differentiator.                                                                                                         |
| **Drift: default schedule**          | **Daily** (buyer-configurable; weekly one config line away).                                                                                                                                                                                                                   |
| **SKU posture (all five)**           | **New SKUs where distinct** — access-review, risk-register, and trust-page-generator become new catalog modules; drift monitor and SoA generator extend existing packages (compliance-core / frameworks-pack) and ride existing prices.                                        |
| **New-SKU first prices**             | **Reserved ids now, price round later** — the three new modules build against reserved catalog ids (the established sold-unpublished pattern), NOT sellable and NOT displayed until a gw-pricing-analyst memo + operator price lock. Site depth pages wait for the price lock. |
| **Access-review: import shape**      | **Typed `MembershipSnapshot` port** (EvidenceCollector-style); CSV/JSON loaders ship as trivial adapters on top.                                                                                                                                                               |
| **Access-review: connectors**        | **GitHub-org connector named as a v2 milestone in the SPEC** (still not built in v1; Google Workspace stays unplanned).                                                                                                                                                        |
| **Risk register: residual override** | **WORM-logged exception record** (who/why/when, chained) — never a plain audit row; residual is computed, freeform never.                                                                                                                                                      |
| **Risk register: EU-AI-Act**         | **REFACTOR the shipped `ai-risk-register` collector onto the generalized schema** (operator override of the keep-separate rec). Golden-file regeneration rides the build; the EU-AI-Act crosswalk pointers must survive byte-reviewed.                                         |
| **Render lane (SoA + trust-page)**   | **Shared render primitive** — one small internal package (filter + redact + citation rows) both consume.                                                                                                                                                                       |
| **SoA: first render target**         | **Evidence pack + OSCAL first**; dashboard rendering later.                                                                                                                                                                                                                    |
| **Trust-page: redaction + NDA**      | **Allowlist-based exposure** (explicit per-field public allowlist) and the **NDA-gated variant is a PERMANENT non-goal** — any auth/sign-off/gating is the wrong-class portal.                                                                                                 |

## Execution shape

Four parallel builder lanes in isolated worktrees off main (ADR-0328 wave default; builders
build + commit, never push), one PR each: (A) drift monitor · (B) access-review · (C) risk
register incl. the EU-AI-Act refactor · (D) shared render primitive + SoA + trust-page (one
lane because they share the render seam). Merges queue behind the in-flight mechanical tail
(PR #301 → version train → deploys).

## Consequences

- The five SPECs land as locked (this ADR is their lock record); PLAN/EXECUTE may proceed.
- Three reserved catalog ids enter the registry as unpublished; a future pricing ADR arms them.
- The EU-AI-Act refactor is the one lock touching a shipped surface — its golden diffs get a
  dedicated review pass at SHIP.
- ADR ceiling moves to 0371.
