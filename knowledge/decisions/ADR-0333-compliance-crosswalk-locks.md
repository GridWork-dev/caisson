# ADR-0333 — Compliance crosswalk: pointer-row rollup v1, ISO 27001 via regimes.ts, structured provenance (supersedes ADR-0057 in part)

Status: accepted · 2026-07-13 (product-SPEC design session + SPINE research + adversarial audit
round + operator re-lock, same day. Locks the forks of `outputs/specs/compliance-crosswalk/SPEC.md`.
Supersedes ADR-0057 in part — the ingestion-ban clause only.)

The crosswalk feature makes one piece of evidence satisfy every framework it can honestly satisfy.
The 2026-07-13 session first locked a dual-catalog OSCAL spine (caisson catalog + vendored CC0
NIST 800-53 rev5 as a reference axis); four independent audit lanes then converged on the same
verdict: over-engineered for the evidenced demand. The rollup is a pure join over the EXISTING
`crosswalk[]` pointers; the vendored 1,196-control catalog has no runtime consumer and serves only
FedRAMP, which ADR-0277 explicitly defers; no OSCAL catalog-model emitter exists (ADR-0179
machinery is SAR/AP-fragment only); and the cited NIST↔ISO mapping docx targets the retired
27001:2013 edition. The operator descoped the same day.

## Decision

- **v1 =** (1) the cross-framework rollup as a pure join over existing `CrosswalkReference`
  pointer rows — no spine consolidation, no vendored catalog, no OSCAL catalog emitter; (2) ISO
  27001 as a FOURTH `regimes.ts`-pattern crosswalk (bare identifiers as factual citations +
  own-authored paraphrases, never ISO text), seeded from NIST's public-domain **2022-edition OLIR
  xlsx** mapping, URL + hash-pinned; (3) **structured provenance** replacing the proposed
  `verified: boolean`: `verification: { status: unreviewed|reviewed|expert-reviewed; relationship:
related|partial|equivalent; sourceId; sourceVersion; sourceDigest; reviewedBy; reviewedAt }` — a
  source-digest change automatically invalidates dependent verification, and claim propagation
  gates on review status (OLIR's own subjective/incomplete warning recorded).
- **Attestations** ship as HONEST NAMED-RECORDS: the authenticated actor identity + evidence
  digest recorded in the pack manifest at manual-slot fill, covered transitively by the existing
  per-tenant Ed25519 pack signature (ADR-0056). The record proves the TENANT asserted person X
  attested — per-person cryptographic identity (enrollment, revocation, custody) is a separate
  future program. Attestations stage after the rollup increment.
- **Rollup semantics:** restates, never originates — `implements` renders only when the ref's
  verification status is reviewed-or-better AND the underlying regime-crosswalk row (where one
  exists) is `implements`; default propagation is `maps-to` (ADR-0279 posture, mechanical).
- **The dual-catalog OSCAL spine is a WRITTEN DEFERRED FORK** gated on a real FedRAMP ask
  (ADR-0277 posture): caisson catalog OSCAL expression + vendored hash-pinned CC0 NIST 800-53
  rev5 + OLIR-style joining rows. Preconditions when it opens: a coherent pinned source bundle
  (catalog + mapping versions + hashes), a defined update/diff/re-review lifecycle, no "FedRAMP
  nearly free" claims.
- **ADR-0057 superseded in part:** the CC-BY-ND/NoDerivatives ban stays ABSOLUTE (SCF is never
  ingested, copied, or transformed). Narrowed: public-domain/CC0 reference material (NIST OLIR
  mappings, SP 800-66r2, CC0 OSCAL catalogs) MAY seed or check MAPPING ROWS — pointers with
  provenance, never control text — and may be vendored hash-pinned if the deferred fork opens.
  The over-broad "or any third-party catalog JSON" comment at
  `packages/frameworks-pack/src/registry/control.ts:5` is corrected in the same change that lands
  this ADR. Everything else in ADR-0057 (own-authored canonical catalog, clean-room authoring,
  typed `defineControl`/`defineFramework`, golden gating, commercial licensing) stands.
- **Legal routing:** the ISO-identifier / EU sui-generis database-right question is ADDED to the
  existing lawyer engagement (ADR-0319 scope) — not resolved here; the ISO crosswalk carries a
  verification-depth gate: no "verified" marketing claim before expert review + the legal answer.
- Grounding corrections of record: THREE shared control ids across packs (not one); crosswalk ref
  counts 38/31/19 (SOC2/HIPAA/EU-AI-Act).
- Fork record: A = caisson-native pointer rows v1, dual-catalog deferred FedRAMP-gated · B =
  own-authored + operator review, public-domain seeds as check data, expert-review gate before
  marketing claims · C = v1 touches no pack structure; goldens re-blessed only where the
  provenance field lands · D = attestations in this spec as honest named-records, staged after
  rollup · E = restates-never-originates as above · F = evidence pack + OSCAL export (SAR/AP seam)
  first, dashboard second.

## Rejected

- **Dual-catalog spine in v1** — no runtime consumer for the vendored catalog until FedRAMP; a
  half-used 1,196-control axis is maintenance without product (four lanes converged).
- **`verified: boolean`** — loses source version, relationship semantics, reviewer, and
  stale-on-update behavior; cannot substantiate an audit-facing mapping (CR-10).
- **Per-tenant-key "named-person" signatures** — a tenant key signing a self-asserted name proves
  nothing about the person and is replayable across packs (CR-05).
- **The 2013-edition ISO mapping docx as seed** — targets a retired standard edition.
- **SCF spine** — CC-BY-ND, banned absolutely (ADR-0057, unchanged).

## Binding

v1 ships the pointer-row rollup, the ISO 27001 regimes.ts crosswalk (2022 OLIR xlsx seed, URL +
hash-pinned), and structured provenance exactly as shaped above; no ISO/AICPA/PCI text ever
ships; the ND ban is untouched; `control.ts:5` is corrected in this ADR's landing change; the
dual-catalog fork stays closed until a real FedRAMP ask and then opens under its written
preconditions; attestations are honest named-records under the tenant signature until a
per-person-key program is separately specced. Evidence:
`outputs/specs/compliance-crosswalk/SPEC.md` (amended 2026-07-13);
`outputs/research/spine-hybrid-oscal-research-2026-07-13.md`;
`outputs/audit/AUDIT-SYNTHESIS-2026-07-13.md` §B;
`outputs/reviews/codex-adversarial-review-2026-07-13.md` CR-05/CR-10/CR-11/WR-08; ADR-0057
(superseded in part); ADR-0277 (FedRAMP deferral); ADR-0279 (claim posture); ADR-0056 (pack
signing); ADR-0319 (lawyer engagement scope).
