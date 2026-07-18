---
status: draft (ADR-0363 build-now lock; PLAN gate pending operator review)
owner: operator
---

# SPEC — Dual-catalog OSCAL spine: caisson catalog OSCAL expression + vendored NIST 800-53 rev5 + OLIR-style mapping rows

- **Repo:** caisson · **Tags:** `product`, `security` · **Status:** DRAFT — spec-first per ADR-0363; PLAN awaits operator lock.
- **Lock:** ADR-0363 (2026-07-18, "build now") supersedes in part ADR-0333's deferred-fork gate — the
  real-FedRAMP-ask trigger is dropped; the fork's stated PRECONDITIONS become binding build
  requirements here, unchanged in substance.
- **Parents:** ADR-0333 (compliance-crosswalk v1 descope + the deferred-fork design this SPEC
  executes), ADR-0347 (`canonicalControlId` join + `seedProvenance` conventions — the ISO precedent
  this SPEC rides), ADR-0179/ADR-0180 (OSCAL version pin + output format; the existing SAR/POA&M
  export this SPEC extends).
- **Explicitly NOT opened:** ADR-0331's Merkle-commitment sibling fork (compact per-row EXTERNAL
  inclusion proofs on the audit-worm chain) — a separate, still-unlocked fork; nothing here touches it.
- **Design record:** `outputs/research/spine-hybrid-oscal-research-2026-07-13.md` ("SPINE research —
  hybrid OSCAL resolution") is the recommended design this SPEC turns into buildable scope. em-dash
  (github.com/aanishs/em-dash) was studied, not adopted (ADR-0057/ADR-0333) — no community mapping data
  is ingested from it.

## Goal (why now)

A buyer with a real or anticipated FedRAMP-adjacent ask gets three honest artifacts instead of zero:
(1) caisson's own, own-authored canonical control catalog expressed natively in OSCAL — proving the
catalog is OSCAL-shaped without contorting product-specific controls (RLS-force, AI-evals, WORM,
crypto-shred) into 800-53 language they don't fit; (2) the literal NIST SP 800-53 rev5 catalog,
vendored verbatim and hash-pinned, so the federal reference axis lives in-repo rather than as a claim;
(3) a capped, honest set of mapping rows showing exactly which caisson controls relate to which 800-53
controls — under the SAME restates-never-originates claim discipline (ADR-0333 Fork E) that already
governs SOC2/HIPAA/EU-AI-Act/ISO, never a "nearly FedRAMP" claim.

ADR-0333 wrote this down as a fork gated on a real FedRAMP ask and explicitly NOT built then — four
independent audit lanes had converged on "no runtime consumer, maintenance without product." At the
2026-07-18 forks-triage picker the operator chose to build now anyway (ADR-0363), while carrying every
one of ADR-0333's stated preconditions forward as binding, not optional.

## Current state (delta since ADR-0333/ADR-0347 shipped, 2026-07-15)

| Layer                            | What exists today                                                                                                                                                                                                                                                                                                                                          | Path                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Canonical control model          | `CanonicalControl.crosswalk[]` accepts ANY `framework` label with structured `CrosswalkVerification` provenance (status/relationship/sourceId/sourceVersion/sourceDigest/reviewedBy/reviewedAt); `NIST-800-53` is literally the docstring's own example label — but **zero** crosswalk row across the three shipped packs points at it                     | `packages/frameworks-pack/src/registry/control.ts`                      |
| Regime crosswalk + ISO precedent | Fourth `regimes.ts`-pattern crosswalk (`iso27001Crosswalk`): optional `canonicalControlId` join per row, crosswalk-level `seedProvenance` (URL+hash pin of the OLIR seed), and a STRUCTURAL Legal-gate cap — every row `claim: "maps-to"`, never carries `verification`, so the rollup can never promote it                                                | `packages/frameworks-pack/src/crosswalks/{regime-crosswalk,regimes}.ts` |
| Cross-framework rollup           | `computeCrosswalkRollup` joins TWO sources: pass 1 walks every framework pack's `crosswalk[]`; pass 2 is a hardcoded, ISO-specific block joining `iso27001Crosswalk` rows via `canonicalControlId` into the same map — this is the "canonicalControlId join" ADR-0347/ADR-0363 name                                                                        | `packages/compliance-core/src/evidence/crosswalk-rollup.ts`             |
| OSCAL export                     | Emits SAR + POA&M REPORT FRAGMENTS from an already-generated evidence-pack manifest (one finding/observation per control; the crosswalk rollup already rides inside the SAR as a `caisson-crosswalk-rollup` prop, ADR-0333/0347 Fork F). **No OSCAL catalog-model emitter exists** — nothing turns `defineFramework` data into an OSCAL `catalog` document | `packages/compliance-core/src/evidence/oscal-export.ts`                 |
| CI gate                          | `oscal-conformance` (required check) validates ONLY the SAR/POA&M XML round-trip against OSCAL **v1.2.2** via self-installed `oscal-cli-enhanced` 3.2.0. Never validates a `catalog` document                                                                                                                                                              | `.github/workflows/ci.yml` (job `oscal-conformance`)                    |
| Licensing floor                  | ND ban (SCF, CC-BY-ND) absolute; public-domain/CC0 material may seed/check mapping ROWS, and — per the now-active deferred fork — may be vendored hash-pinned. That fork is this SPEC                                                                                                                                                                      | `control.ts:5-6` comment, corrected by ADR-0333                         |

**Live-checked 2026-07-18 (see Sources):** OSCAL v1.2.2 (2026-04-30) is still NIST's latest stable
release — ADR-0179's pin needs no bump. The vendored-candidate NIST catalog
(`usnistgov/oscal-content`, CC0 1.0 Universal) currently expresses **SP 800-53 Rev 5.2.0** (catalog
`version: 5.2.0`, `oscal-version: 1.2.2`, last-modified 2026-05-11) — concretely confirming WR-08's
flagged risk that the OLIR-era 5.1.1 citation and the vendored catalog's own revision can drift apart.

## Scope — three components

### (a) Generated OSCAL catalog expression of the caisson canonical catalog

New adapter, `packages/compliance-core/src/evidence/oscal-catalog-export.ts`, sibling to
`oscal-export.ts` — same seam-tested/pure/deterministic pattern (injected `now`/`newId`, no I/O, no
network). Input: caisson's own `Framework[]` (from `@caisson/frameworks-pack`); output: one OSCAL
`catalog` document per the research doc's own naming — `caisson-catalog.oscal.json` — with `groups`
mirroring each control's own `family` field and controls addressed under a caisson URN namespace
(e.g. `urn:caisson:control:<id>`, mirroring the existing `CAISSON_OSCAL_NS` prop convention).
Product-specific controls stay native; nothing is force-fit into an 800-53 group shape. CI: extend
`oscal-conformance` with a second `oscal-cli validate` target for the catalog model, golden-fixtured
under `frameworks-pack/src/__golden__/` alongside the existing crosswalk goldens.

### (b) NIST 800-53 rev5 catalog, vendored hash-pinned

Source: `usnistgov/oscal-content`, path `nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json`
— CC0 1.0 Universal (public domain worldwide), ~1.04 MB. Vendor pinned to a **specific commit SHA**
(never `main`, which moves) and record, in ONE place: the source URL at that commit, the commit SHA,
the catalog's own internal `version` (currently 5.2.0) and `oscal-version` (1.2.2, matches the CI
pin), and a SHA-256 of the exact downloaded bytes. Verbatim, never paraphrased or mutated in place —
public-domain text, so no ND-ban tension (ADR-0057/ADR-0333). A cheap CI step re-verifies the
committed bytes hash to the pinned digest on every run (supply-chain drift guard — catches a bad
overwrite even though the file is otherwise NIST-conformant by construction).

### (c) OLIR-style mapping rows, caisson ↔ 800-53

A fifth `regimes.ts`-pattern crosswalk, `nist80053Crosswalk` (widen `RegimeId` to add
`"nist-800-53"`), riding the SAME machinery the ISO axis already proved: crosswalk-level
`seedProvenance` (here pinning the vendored catalog's own commit+hash from (b) — there is no
pre-existing external OLIR doc mapping caisson's proprietary controls to 800-53, so this crosswalk's
rows are **own-authored**, checked against the vendored catalog, not seeded from a third-party
mapping) and a per-row `canonicalControlId` join back into `computeCrosswalkRollup` — but REQUIRED
here (every row's purpose is the join), unlike ISO's optional field. `claim` is STRUCTURALLY capped
at `"maps-to"` for every row — mirrors the ISO Legal-gate pattern exactly (no row ships a
`verification` record, so Fork E condition (b) can never hold for an 800-53-driven contribution) —
directly satisfying "capped at maps-to strength like the ADR-0333 legal gate."

Rollup wiring: today's ISO join (crosswalk-rollup.ts lines ~219-248) is hardcoded to one regime id.
Generalize it into a loop over every `regimeCrosswalks[]` entry with `canonicalControlId` rows — one
code path serves ISO and the new NIST-800-53 axis (and any future regime riding this pattern), tested
against the existing ISO fixtures to guarantee no regression.

## Binding requirements (from ADR-0333, carried forward by ADR-0363 as build requirements)

1. **Coherent pinned source bundle.** The vendored catalog's commit SHA + internal version (5.2.0) +
   `oscal-version` (1.2.2) + SHA-256 travel together as ONE constant the vendoring script, the
   crosswalk's `seedProvenance`, and the CI drift-check all read — never two independently-drifting
   pins (the exact failure WR-08 named, now confirmed live).
2. **A defined update/diff/re-review lifecycle.** When NIST revises the catalog (5.2.0 → 5.2.1, or a
   future rev6), a documented, scripted procedure re-fetches, re-hashes, structurally diffs
   (added/removed/renumbered controls), and invalidates every dependent mapping row's provenance —
   mirroring `isVerificationStale`'s existing pattern, not a silent drift.
3. **No "FedRAMP nearly free" marketing claim.** Copy posture is UNCHANGED by this SPEC — no site,
   GTM, dashboard, or evidence-pack language may imply FedRAMP proximity or readiness from this
   artifact's mere existence.

## Non-goals

- ADR-0331's Merkle-commitment sibling fork — untouched, still separately gated.
- FedRAMP baseline/profile artifacts or the OSCAL 1.0.4 down-convert — ADR-0179 already defers these;
  still deferred.
- Any OTHER new regime/framework (NIS2, DORA, HITRUST, CMMC) — ADR-0277's demand-driven posture holds
  for everything except this one named 800-53/OSCAL axis (ADR-0363, verbatim).
- No re-scoping of the three shipped framework packs or the four existing regime crosswalks — additive
  only: one new file, one widened enum literal, one vendored artifact.
- No buyer-facing dashboard/UI surface for the new axis in v1 (mirrors ADR-0333 Fork F: report seam
  first — here, no dashboard surface is scoped at all yet).
- No GTM/marketing copy changes of any kind.

## Package placement — options + recommendation

frameworks-pack is already a separately-priced, separately-displayed SKU (ADR-0246 F6, the compliance
3-SKU carve: compliance-core / frameworks-pack / signing-primitive); its only in-repo dependents are
itself, `compliance`, and `compliance-core` — contained blast radius. compliance-core already depends
on frameworks-pack (consistent with ADR-0003's down-only floor) and already owns the only existing
OSCAL emitter code.

- **Option 1 — extend in place (recommended).** Catalog + mapping data lands in `frameworks-pack`
  (new files beside `regimes.ts`/`control.ts`; the vendored ~1 MB blob under e.g.
  `frameworks-pack/src/vendor/nist-800-53-rev5-catalog.json`); the catalog GENERATOR + drift-check
  land in `compliance-core` beside `oscal-export.ts`. Zero new packages, zero new registry entries,
  ships inside the existing SKU price points. Trade-off accepted: frameworks-pack's publish artifact
  grows ~1 MB even for a buyer who never touches the NIST axis.
- **Option 2 — new package `@caisson/oscal-spine`.** Houses the vendored catalog + the caisson-catalog
  export + the mapping crosswalk; depends on frameworks-pack for canonical control ids, feeds
  compliance-core. Keeps the weight out of frameworks-pack; is a clean candidate 4th priced SKU.
  Trade-off accepted: a new registry entry (a pure ADD — low blast radius per the launch runbook), a
  reserved SKU id to mint, full package scaffolding (package.json/tsconfig/eslint/CHANGELOG/standards-
  gate coverage) for a feature whose demand this SPEC does not re-evidence.

**Recommendation: Option 1, confidence high.** ADR-0363 asked to build the spine the research doc
already designed as data + a generator inside these two existing homes — not a new SKU. A package is
cheap to carve out LATER if a real pricing case emerges (a pure registry ADD is low-risk); welding a
$0-marginal-cost feature into an existing SKU now is the smaller, reversible diff. Whether the axis
ever becomes its own priced SKU is a pricing fork for `docs/state/decisions-and-forks.md`, not decided
here — flagged as F3 below.

## Verification gate (goal-backward)

1. `oscal-cli validate` passes schema-only validation (v1.2.2) on the generated
   `caisson-catalog.oscal.json` — extends the `oscal-conformance` required check.
2. The vendored NIST catalog's committed bytes hash to the pinned SHA-256 on every CI run, and
   independently pass `oscal-cli validate` (confirms no corruption from the vendoring step itself).
3. Every `nist80053Crosswalk` row's `canonicalControlId` resolves to a real control id across the
   shipped packs (existence test), and `claim` is `"maps-to"` for every row with zero exceptions
   (structural test, not merely convention).
4. `computeCrosswalkRollup` renders an NIST-800-53 cell from a collector-pass fixture exactly as it
   does for ISO today, and never renders `"implements"` for an 800-53-driven contribution (mirrors the
   existing ISO structural test).
5. New goldens: `crosswalk-nist-800-53.json` under `frameworks-pack/src/__golden__/` (mirrors the four
   existing crosswalk goldens) and a golden-fixtured catalog export (deterministic given injected
   `now`/`newId`, per the existing `oscal-export.ts` pattern).
6. No copy anywhere (dashboard, evidence pack, site, GTM) sourced from this artifact contains
   "compliant"/"certified"/"FedRAMP nearly free"/"FedRAMP-ready" — grep-gated the same way
   `pack-format.ts`'s `postureCopy` guard and the rollup's `note` regex already enforce (ADR-0080).
7. The source-bundle coherence + update/diff/re-review lifecycle (Binding requirements 1-2) exist as a
   documented, runnable procedure — not prose — before PLAN closes this SPEC's scope.

## Forks (open — operator picker at PLAN time)

**F1. Mapping-row home & shape**

- (a) Reuse `CanonicalControl.crosswalk[]` with `framework: "NIST-800-53"` — zero new schema, the
  rollup already joins it for free via the existing pass-1 loop; but no natural home for a
  crosswalk-LEVEL `seedProvenance` (rows would scatter across three pack files).
- (b) A fifth `regimes.ts`-pattern crosswalk (`nist80053Crosswalk`) — reuses `seedProvenance` +
  `canonicalControlId` exactly as named, centralizes the axis in one new file, mirrors the proven ISO
  precedent byte-for-byte. Requires generalizing the rollup's ISO-specific join pass into a loop
  (small, bounded, test-guarded refactor).
- (c) A wholly new OLIR-faithful schema (rationale/relationship/strength as distinct fields, outside
  both existing patterns) — maximizes fidelity to NIST IR 8278A's actual vocabulary at the cost of a
  third provenance dialect for reviewers to learn.
- **Recommendation: (b), confidence high.** Matches ADR-0363's own text ("riding the... `canonicalControlId` join and `seedProvenance` conventions") almost verbatim; smallest diff on a shipped, tested pattern.

**F2. OLIR relationship-vocabulary fidelity**

- (a) Reuse the existing `CrosswalkVerification.relationship: related|partial|equivalent` — already
  caisson's own deliberate simplification (ADR-0333/CR-10) of OLIR's five-way set-theory vocabulary.
- (b) Adopt NIST IR 8278A's actual vocabulary verbatim on this one crosswalk (rationale:
  syntactic/semantic/functional; relationship: subset-of/intersects-with/equal/superset-of/
  not-related-to; optional 0-10 strength) — confirmed live 2026-07-18, csrc.nist.gov/pubs/ir/8278/a/r1/final.
- **Recommendation: (a), confidence medium.** One provenance vocabulary across every crosswalk in the
  repo beats spec-purity on a field NIST itself marks optional/no-prescribed-methodology; revisit as
  (b) only if a buyer or auditor specifically asks for OLIR-standard-conformant output.

**F3. Package placement / future SKU**

- (a) Extend frameworks-pack + compliance-core in place (Scope recommendation above).
- (b) New `@caisson/oscal-spine` package, a candidate 4th compliance SKU.
- **Recommendation: (a) now; whether (b) ever becomes a priced SKU is a separate, later pricing fork** —
  log to `docs/state/decisions-and-forks.md`, not decided in this SPEC (pricing stays operator-owned).

**F4. Catalog granularity**

- (a) One `caisson-catalog.oscal.json` spanning every shipped pack's controls — the research doc's own
  stated design, and matches ADR-0363's singular "the caisson canonical control catalog."
- (b) Per-framework catalogs, mirroring today's per-framework SAR/POA&M split.
- **Recommendation: (a), confidence high.** A per-framework VIEW can still be derived from the one
  document later without a schema change; (b) adds artifacts the research doc never asked for.

**F5. NIST catalog refresh cadence**

- (a) Manual, operator-triggered re-vendor (a script exists; run on demand).
- (b) A scheduled cadence job (mirrors the gridwork-core `gw cadence` agent-lane pattern) that
  periodically checks `usnistgov/oscal-content` for a new commit and flags a diff for operator review
  — never auto-applies.
- **Recommendation: (a) for v1, confidence medium.** No evidenced demand for continuous freshness;
  Binding requirement 2's procedure is required either way — (b) is a later automation of the same
  procedure, not a different one.

## Dependencies / adjacent

- `outputs/specs/compliance-crosswalk/SPEC.md` — the direct parent; this SPEC executes its written
  deferred fork ("Deferred fork: dual-catalog OSCAL spine").
- `outputs/research/spine-hybrid-oscal-research-2026-07-13.md` — the design record turned into scope
  here.
- ADR-0179/ADR-0180 — the `oscal-version` pin (v1.2.2) this SPEC inherits unchanged (confirmed still
  current, live, 2026-07-18).
- ADR-0231 (rlink signed bundle) — the back-matter/hash-binding pattern the vendored-catalog pin
  borrows from.
- `outputs/specs/per-row-verification-ui/SPEC.md` / ADR-0331 — cited only to record what stays OUT
  (the Merkle sibling fork).
- `docs/state/decisions-and-forks.md` — where F3's SKU question lands if/when it needs its own picker.

## Sources (live-checked 2026-07-18)

- OSCAL latest stable release: **v1.2.2**, published 2026-04-30 —
  github.com/usnistgov/OSCAL/releases/tag/v1.2.2. Confirmed still latest (repo's last push,
  2026-06-25, is dependency/doc maintenance only — no newer model release since).
- NIST SP 800-53 rev5 OSCAL catalog: github.com/usnistgov/oscal-content, path
  `nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json`; CC0 1.0 Universal —
  github.com/usnistgov/oscal-content/blob/main/LICENSE.md. Catalog content currently expresses SP
  800-53 **Rev 5.2.0** (`oscal-version: 1.2.2`, catalog `version: 5.2.0`, last-modified 2026-05-11) —
  confirms the WR-08 catalog/mapping-version drift risk is live, not hypothetical.
- OLIR relationship vocabulary: NIST IR 8278A Rev. 1, "National Online Informative References (OLIR)
  Program: Submission Guidance for OLIR Developers" — csrc.nist.gov/pubs/ir/8278/a/r1/final. Set-theory
  relationship mapping (subset of / intersects with / equal / superset of / not related to) + rationale
  (syntactic/semantic/functional) + optional 0-10 strength-of-relationship. A separate "supportive
  relationship mapping" style also exists in the same document (supports / is supported by / identical
  / equivalent / contrary).
