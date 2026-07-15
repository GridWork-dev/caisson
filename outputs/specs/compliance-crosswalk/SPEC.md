# SPEC — Compliance crosswalk: shared control spine, cross-framework rollup, named-person attestations

- **Repo:** caisson · **Tags:** `product`, `security` · **Status:** SHIPPED (PR #238, 2026-07-15; forks locked → ADR-0333, which also supersedes ADR-0057 in part; PLAN locks ADR-0347)
- **Prior art:** em-dash (github.com/aanishs/em-dash, MIT, 9★) — 800-53-rev5 catalog spine + frameworks-as-filter-files + tool-bindings.json + signed attestations. Studied, not adopted.
- **Builds on (partly superseded):** ADR-0057 (canonical control model + licensing floor — ADR-0333 supersedes IN PART, see "ADR-0057 relationship" below), ADR-0277 (regime crosswalk data), ADR-0279 (claim posture), ADR-0058 (collectors, flag-never-guess), ADR-0056 (per-tenant detached Ed25519 pack signing).

## Amendment record (2026-07-13)

Four independent audit lanes converged on the descope below: the 18-agent red-team crosswalk/spine
lane, the cross-consistency lane, Codex `gpt-5.6-sol` adversarial review, and the operator re-lock
round. Evidence: `AUDIT-SYNTHESIS.md` §B ("Crosswalk/spine — the big one, four independent lanes
converge"); `codex-adversarial-review.md` CR-05 (attestation has no named-person identity), CR-10
(`verified: boolean` cannot substantiate an audit-facing mapping), CR-11 (locked design contradicted
the SPEC's own non-goals and ADR-0057), WR-08 (OSCAL spine lacks a coherent source-version
lifecycle); `FORK-LOCKS.md` ✅ RE-LOCKS row "Crosswalk/spine — Descope + deferred fork". Locks
recorded as ADR-0333.

What changed from the 2026-07-13 draft:

- **v1 descopes** to a pointer-row rollup over the catalogs as they ship today — no spine
  consolidation, no vendored 800-53 catalog, no OSCAL catalog-model emitter. This is the SPEC's own
  original Fork A option 1, independently reconfirmed as smallest/highest-confidence.
- **ISO 27001 ships in v1** as a fourth `regimes.ts`-pattern crosswalk (this reverses the original
  non-goal "no new frameworks in this spec" — see Non-goals).
- **`verified: boolean` is replaced by structured provenance** (status/relationship/source/reviewer).
- **Named-person attestation is replaced by an honest named-record design**; per-person
  cryptographic identity (enrollment, revocation, key custody) is a separate future program.
- **Grounding corrected:** three shared control ids across packs (not one); ref counts 38 (SOC2) /
  31 (HIPAA) / 19 (EU-AI-Act) (not 32/27/19); no OSCAL catalog-model emitter exists today (ADR-0179
  machinery is SAR/AP-fragment only — the original "the seam exists" framing overstated reuse).
- **The dual-catalog OSCAL spine survives** as a written, FedRAMP-gated deferred fork — not deleted,
  not built now.
- **Non-goals reconciled** so they no longer contradict the locks; the `control.ts:5` comment
  over-statement is corrected in the same change that lands ADR-0333.

## Goal

Make one piece of evidence satisfy every framework it can honestly satisfy — visibly. Today caisson's three framework packs are near-disjoint catalogs (53 controls, three shared ids across packs) with sparse pairwise crosswalk pointers, so evidence collected for a SOC 2 control does not "light up" the HIPAA or EU-AI-Act requirement the same mechanism covers. This spec computes the cross-framework evidence rollup ("fix once, see it satisfied across N frameworks" — the em-dash move) over the catalogs' existing crosswalk pointers, adds a fourth framework (ISO 27001) on the same own-authored pattern, and adds named-record attestations so manual evidence carries an honest human record, not just a filled slot. The sellable claim: a buyer running the Compliance bundle sees a coverage matrix — canonical controls × frameworks — where one green collector run propagates to every crosswalked requirement at the honest claim level, inside the dashboard and the exported evidence pack.

## Current state (grounded)

| Layer                         | What exists                                                                                                                                                                                                                                                                                                                                                                                                                  | Path                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Canonical control model       | `defineControl`/`defineFramework`, per-control `crosswalk: CrosswalkReference[]` (pointers to external requirement ids; unique on (framework, reference))                                                                                                                                                                                                                                                                    | `packages/frameworks-pack/src/registry/control.ts` (ADR-0057)                 |
| Framework packs               | 3 own-authored catalogs: soc2-tsc (38 SOC2 refs), hipaa-security (31 HIPAA refs), eu-ai-act (19 EU refs); cross-refs are sparse (3–4 pairwise); three shared control ids across packs (not the originally reported one) — `GOVERNANCE.SECURITY-RESPONSIBILITY` (soc2+hipaa) confirmed, the other two enumerate at PLAN (WR-09 evidence gate: script the exact ids); **no NIST-800-53 axis in v1** (deferred fork, see below) | `packages/frameworks-pack/src/frameworks/*.ts`                                |
| Buyer-facing regime crosswalk | Five-column SOC2/PCI-DSS/GDPR mapping, `implements`(+mandatory proof pointer) vs `maps-to` discriminated union; renderers pick language mechanically; own-authored summaries over bare regime identifiers (the pattern ISO 27001 rides)                                                                                                                                                                                      | `packages/frameworks-pack/src/crosswalks/regime-crosswalk.ts` (ADR-0277/0279) |
| Control→collector binding     | ALREADY EXISTS as code: every `EvidenceCollector` declares `controlId` (1:1, e.g. `substrate.audit-chain-integrity`); 6 collectors shipped                                                                                                                                                                                                                                                                                   | `packages/compliance-core/src/evidence/collector.ts` (ADR-0058)               |
| Manual evidence               | `ManualAttachmentSlot` (id/label/required); fill-tracking at the generator edge; **no person identity, no record on the fill**                                                                                                                                                                                                                                                                                               | same file                                                                     |
| Signing                       | Per-tenant detached Ed25519 over `canonicalize(manifest) ∥ chainTipHash`, RFC-3161 countersign; signs the WHOLE pack, not individual statements                                                                                                                                                                                                                                                                              | `packages/signing-primitive/src/sign.ts` (ADR-0056)                           |
| OSCAL export                  | SAR/AP report-fragment emitter only (ADR-0179/0180) — **no OSCAL catalog-model emitter exists today**; catalog emission is new work, not reuse (grounding fix)                                                                                                                                                                                                                                                               | `packages/compliance-core/src/evidence/oscal-export*.ts`                      |
| Traceability                  | Grep-able `Control: ADR-NNNN` docstring convention — deliberately not a framework                                                                                                                                                                                                                                                                                                                                            | `docs/compliance/control-traceability.md` (ADR-0229)                          |

**The v1 delta is therefore two moves, not a platform:** (1) rollup computation — a pure join over
the crosswalk pointers the catalogs already carry, rendered as a coverage matrix (data model already
supports it; nothing computes it); (2) attestation records — honest named-record over a
canonicalized statement when a manual slot is filled. Spine consolidation, the 800-53 axis, and an
OSCAL catalog emitter are deferred (see "Deferred fork" below).

## Scope

1. **Cross-framework rollup (v1, no spine):** a pure function in `compliance-core` — input: collector results + the EXISTING per-control `crosswalk[]` pointers on the three shipped packs (no catalog consolidation); output: per-framework coverage (requirement id → status → evidence pointer → claim level). Rendered in (a) the evidence pack's new `crosswalkRollup` section + OSCAL export (the existing SAR/AP-fragment seam carries it as report content — not a new catalog artifact), (b) the compliance app dashboard matrix second.
2. **Structured provenance replacing `verified: boolean`:** every `CrosswalkReference` gains an optional `verification` field (shape below) instead of a boolean. Additive, `.strict()`-safe via a new schema rev.
3. **Claim-posture propagation** (binding, from ADR-0279, sharpened by CR-10): a rollup cell NEVER upgrades a claim. `pass` evidence on a control ⇒ at most `implements` on requirements whose crosswalk reference carries `verification.status` of `reviewed` or `expert-reviewed` AND whose underlying regime-crosswalk row (where one exists) is already `implements`; default propagation is `maps-to`. Language stays mechanical. NIST OLIR's own warning — its mappings are subjective, incomplete, and not equivalence claims — is recorded alongside any OLIR-seeded reference.
4. **ISO 27001 as a fourth `regimes.ts`-pattern crosswalk:** bare requirement identifiers (factual citations) + own-authored paraphrase summaries — never ISO Annex A text. Seeded, as CHECK data only, from NIST's **2022-edition** OLIR mapping (SP 800-53 rev5 ↔ ISO/IEC 27001:2022; URL + hash-pinned). The previously researched `.docx` mapping targets the **retired 27001:2013** edition and must not be used as the seed.
5. **Named-record attestations** (amended, CR-05): `AttestationRecord = { slotId, statement, actor: {identity, role}, evidenceDigest, packId, signedAt }` recorded in the pack manifest at manual-slot fill; NO per-person Ed25519 key. The existing per-tenant pack signature (ADR-0056) covers the record transitively. The record proves "the tenant asserted person X attested," not individual cryptographic identity — that distinction is stated in the buyer-facing copy, never elided. Staged AFTER the rollup increment ships (Fork D).
6. **Binding-table visibility:** generate the control→collector table (the em-dash tool-bindings.json analog) as a derived artifact from collector declarations — documentation output, not a new config layer (the code IS the table).

## Non-goals

- **No spine consolidation, no vendored 800-53 catalog, no OSCAL catalog-model emitter in v1** — written as a deferred fork gated on a real FedRAMP ask, not built now (reverses the original "no 800-53 catalog text ingestion" framing, which conflated the licensing floor with the descope; the licensing floor itself is unchanged and absolute — see ADR-0057 relationship).
- **ISO 27001 is explicitly IN scope** as a fourth crosswalk (supersedes the original blanket "no new frameworks in this spec" — the descope re-lock reverses this non-goal for ISO specifically; no other new framework is in scope).
- No per-person cryptographic attestation identity (enrollment authority, revocation, key custody) — a separate future program; v1 ships the honest named-record design only.
- No per-row chain verification UI (sibling spec `SPEC-per-row-verification-ui.md`) and no external anchoring (sibling `SPEC-rekor-anchoring.md`); interfaces named in Dependencies.
- No "compliant/certified" language anywhere — readiness/posture only (ADR-0080 copy law).
- No em-dash adoption or ingestion of its community mappings (its own labels say "unverified by a domain expert" — the trap this spec is designed to avoid).
- No "verified" marketing claim for the ISO crosswalk before the Legal gate below clears.

## Structured provenance shape (CR-10)

```ts
verification: {
  status: "unreviewed" | "reviewed" | "expert-reviewed";
  relationship: "related" | "partial" | "equivalent";
  sourceId: string;
  sourceVersion: string;
  sourceDigest: string;
  reviewedBy: string;
  reviewedAt: string;
}
```

A catalog or source-digest change automatically invalidates dependent verification (the reference
reverts to `unreviewed` until re-checked). Claim propagation gates on `status` per Scope item 3.

## Data-model delta & migration (v1, descoped)

- **No pack restructuring in v1** — the three shipped packs stay exactly as they ship today; no golden churn from consolidation, because there is no spine to consolidate into.
- `CrosswalkReference` gains the optional `verification` object above, replacing the originally proposed `verified: boolean`. Goldens are re-blessed only for the packs where a reference actually carries a verification record (Fork C), not wholesale.
- Grounding correction: three shared control ids across packs, not one — see Current state table.
- Evidence-pack format gains a `crosswalkRollup` section — additive; ADR-0006 append-only versioning applies (new pack format version, old packs never rewritten).
- ISO 27001 ships as a new pack (`iso-27001`, `regimes.ts` pattern) — bare identifiers + own-authored paraphrase, seeded from the 2022-edition OLIR xlsx as check data.

## ADR-0057 relationship (amended, CR-11)

ADR-0333 supersedes ADR-0057 **in part**. What stays absolute: the ND/NoDerivatives ban — SCF and
any CC-BY-ND-licensed catalog is never ingested, zero exceptions. What narrows: the over-broad
reading of "or any third-party catalog JSON" in the ADR-0057-citing comment at
`packages/frameworks-pack/src/registry/control.ts:5`. Public-domain / CC0 reference material (NIST
OLIR mapping rows, SP 800-66r2) MAY seed or check **mapping rows** (pointers + provenance metadata)
— never control **text**. The comment fix lands in the SAME CHANGE that lands ADR-0333; do not ship
one without the other. v1 itself does not exercise this narrowed boundary (it ingests no external
catalog at all, per the descope) — the boundary matters for the ISO crosswalk's OLIR seed and for
the deferred fork below.

## Legal (ISO identifier / EU database-right question)

Whether bare ISO 27001 control identifiers plus own-authored paraphrase summaries can ship
commercially, and whether ISO's EU sui-generis database right creates exposure even over
identifiers-only extraction, is routed to the **existing** lawyer engagement (ADR-0319 scope) — not
a new one. Binding gate: no "verified" marketing claim for the ISO crosswalk (dashboard, evidence
pack, or GTM copy) before (a) expert review per Fork B and (b) the legal answer lands. Until then the
ISO crosswalk ships at `verification.status: "unreviewed"` or `"reviewed"` only, never
`"expert-reviewed"`, and buyer-facing claim language stays `maps-to`.

## Deferred fork: dual-catalog OSCAL spine (gated on a real FedRAMP ask)

Written down so it survives, not scheduled. `SPINE-hybrid-oscal-research.md`'s recommended design —
one data model, two catalogs, mappings as first-class data — is a deferred fork, not dropped:

1. The caisson canonical catalog stays own-authored and gains a **generated** OSCAL expression (product-specific controls — RLS-force, AI-evals, WORM, crypto-shred — live here natively, never force-fit into 800-53).
2. The NIST 800-53 rev5 OSCAL catalog (confirmed CC0, public domain worldwide) is vendored hash-pinned as a reference axis — a mapping target, never the authoring model.
3. OLIR-style mapping rows join the two; the rollup computes across them plus the existing per-framework crosswalks.
4. New frameworks (NIS2, DORA, FedRAMP, HITRUST) extend the same recipe later; FedRAMP additionally inherits OSCAL baseline/profile artifacts.
5. Licensing guardrails (binding for v1 AND this fork): ND ban absolute; ISO/AICPA/PCI text never ships — identifiers + own paraphrase only; every vendored external catalog must be public-domain/CC0 and hash-pinned; mapping rows carry provenance (`source: nist-sp800-53r5-iso-mapping` vs `own-authored`); the rollup only restates claims, never originates one (locked Fork E).

**Gate to open this fork:** a real FedRAMP buyer ask (ADR-0277's demand-driven posture — FedRAMP's
OSCAL mandate, effective Sept 30 2026 per ADR-0179's own citation, makes it the natural trigger, not
a reason to pre-build).

**Preconditions before this fork reaches PLAN (WR-08, binding):**

1. A coherent pinned **source bundle** — catalog version, mapping version, and their hashes travel together, not as independently pinned artifacts that can drift out of semantic sync (the OLIR ISO mapping already cites SP 800-53 rev 5.1.1 while the vendored catalog continues to rev; hash-pinning guarantees repeatability, not semantic compatibility).
2. A defined update/diff/re-review lifecycle for when NIST revises the catalog or the mapping.
3. No "FedRAMP nearly free" claim — ADR-0179 already defers the 1.0.4 down-convert target, and the SSP/SAP/SAR/POA&M package work is separate from a catalog spine.

## Competitive note

em-dash proves demand and the architecture shape at 9★/MIT; its weakness is exactly what caisson's locked posture already forbids — shipping unverified mappings as if they were evidence. Caisson's differentiator: claim-postured, proof-pointed mappings (ADR-0279) wired into a real evidence engine with deterministic packs and per-tenant signing. The crosswalk rollup makes that visible; the attestation feature closes the manual-evidence gap em-dash covers with user attestations — honestly, this time, about what a tenant-scoped signature actually proves.

## Forks (LOCKED — recorded as ADR-0333)

**A. Spine choice** — LOCKED: caisson-native canonical ids + crosswalk pointer rows for v1 (the
SPEC's original Fork A option 1 — independently reconfirmed by four audit lanes as
smallest/highest-confidence: zero licensing risk, no ADR supersession beyond the narrow comment fix,
smallest diff). No spine consolidation, no vendored 800-53 catalog, no OSCAL catalog-model emitter in
v1. The dual-catalog OSCAL spine is a deferred fork gated on a real FedRAMP ask (see above).

**B. Mapping provenance** — LOCKED: own-authored + operator review, seeded from public-domain
sources (NIST OLIR, SP 800-66r2) as CHECK data only, never ingested text. Structured provenance
replaces the boolean gate. Expert-review gate before any "verified" marketing claim — binding for the
ISO crosswalk specifically, pending the ADR-0319 legal answer (see Legal).

**C. Retrofit scope** — LOCKED (re-scoped from "full retrofit, one change"): v1 touches no pack
structure. The rollup computes over the existing per-pack `crosswalk[]` pointers as they ship today;
goldens are re-blessed only where the new provenance field actually lands on a reference, not as a
wholesale spine migration. Full-pack consolidation is folded into the deferred OSCAL-spine fork.

**D. Attestations** — LOCKED: stay in this spec, as honest named-records (see Scope item 5), staged
AFTER the rollup increment ships — a distinct migration step, not the same wave. Per-person
cryptographic identity (enrollment, revocation, key custody) is an explicit separate future program.

**E. Rollup claim semantics** — LOCKED: the rollup restates, never originates. A rollup cell may
render `implements` on a crosswalked requirement only when the reference's `verification.status` is
`reviewed` or `expert-reviewed` AND the underlying regime-crosswalk row (where one exists) is already
`implements`. Default propagation is `maps-to`.

**F. Where the rollup renders first** — LOCKED: evidence pack + OSCAL export first (the existing
SAR/AP-fragment seam — carries the rollup as report content, not a new catalog artifact), dashboard
matrix second.

## Dependencies / adjacent

- `SPEC-per-row-verification-ui.md`: renders per-evidence verification; consumes the rollup's evidence pointers.
- `SPEC-rekor-anchoring.md`: anchored chain roots strengthen what an attestation timestamp means; no hard coupling.
- OSCAL seam (`compliance-core/src/evidence/oscal-export*.ts`) is a SAR/AP report-fragment emitter (ADR-0179/0180) — the natural carrier for the rollup as report content, NOT a catalog-model emitter (grounding fix; catalog emission is new work, reserved for the deferred fork). OLIR's 2022-edition xlsx (URL+hash-pinned) is a possible future _import_ check-format for ISO (Fork B) — never a text source.
- `SPINE-hybrid-oscal-research.md` is retained as the design record for the deferred dual-catalog fork, not implemented by this spec.
- Kickoff placement: caisson-platform kickoff, product-stub track (SPEC → operator lock → PLAN fanout).

## Verification (goal-backward, when built)

A single collector run (`rls-force` pass) must: light the RLS canonical control green; propagate
`maps-to`/`implements` per Fork E across every crosswalked requirement in all three shipped framework
views plus the ISO crosswalk; appear in the pack's `crosswalkRollup` section with claim language
chosen mechanically from `verification.status`; fail the golden gate if any shipped pack export
byte-drifts (goldens re-blessed only where the provenance field lands, per Fork C). An unresolved
collector must hard-block the pack exactly as today (flag-never-guess unchanged).
