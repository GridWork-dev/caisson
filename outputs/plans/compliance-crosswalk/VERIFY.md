# VERIFY — Compliance crosswalk: shared-control rollup, structured provenance, ISO 27001

- **Repo:** caisson · **Phase:** Act 4 (VERIFY) · **Branch:** `feature/exec-crosswalk`
- **SPEC:** `outputs/specs/compliance-crosswalk/SPEC.md` (LOCKED, amended 2026-07-13)
- **Locks:** `knowledge/decisions/ADR-0333-compliance-crosswalk-locks.md` · `ADR-0347-compliance-crosswalk-plan-locks.md`
- **Scope this wave:** Groups A, B, C, E, G. Group D (attestations) and Group F (dashboard) are
  out of scope by design (Fork D stage gate + G4; Kickoff-S `apps/site`/`packages/ui` freeze).
- **Verdict: PASS.** The SPEC Goal is achieved; the marquee scenario runs from real substrate
  evidence; every negative guard holds; goldens re-blessed only where authorized; all four required
  local gates green.

---

## 1. Goal-backward re-ask (not a task checklist)

**SPEC Goal:** "Make one piece of evidence satisfy every framework it can honestly satisfy —
visibly." The delta is (1) a pure rollup joining the packs' existing `crosswalk[]` pointers into a
per-framework coverage matrix at the honest claim level (Fork E: restates, never originates); (2)
structured `verification` provenance replacing the never-shipped `verified: boolean`; (3) ISO 27001
as a fourth `regimes.ts` crosswalk; (4) named-record attestations — staged AFTER this increment
(Fork D), correctly absent.

**Did the code achieve it?** Yes. `computeCrosswalkRollup`
(`packages/compliance-core/src/evidence/crosswalk-rollup.ts`) is a pure, injected-input, sorted,
clock-free join. The reference leg (`apps/compliance/lib/leg.ts` → `leg.test.ts`) runs the real
substrate collectors, computes the rollup, and asserts one collector run lights every co-crosswalked
requirement across all four views with mechanically-chosen claim language. The single sellable claim
— "fix once, satisfied across N frameworks" — is proven, not asserted.

---

## 2. SPEC Verification scenario (run, not narrated)

The SPEC's own scenario is executed end-to-end by `apps/compliance/lib/leg.test.ts` (real
collectors, not a synthetic fixture) and by `crosswalk-rollup.test.ts` (unit):

| SPEC requirement                                                      | Result                                                            | Evidence                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Light the RLS canonical control green                                 | ✅ `ACCESS-CONTROL.LOGICAL` → `ready`                             | leg.test.ts, rollup.test.ts §marquee          |
| Propagate maps-to/implements per Fork E across all 3 framework views  | ✅ CC6.1/CC6.2/CC6.3 `maps-to`; C1.2 `implements`                 | leg.test.ts:131-137                           |
| …plus the ISO crosswalk (fourth view)                                 | ✅ ISO A.5.15 / A.8.15 / A.8.10 lit via `canonicalControlId` join | leg.test.ts:142-150                           |
| Appear in the pack's `crosswalkRollup` section                        | ✅ required v2 manifest section, assembled by the generator       | pack-format.ts:195, generate.ts:420           |
| Claim language chosen mechanically from `verification.status`         | ✅ no editorial path; claim is a pure boolean reduction           | crosswalk-rollup.ts:272                       |
| Surface in the OSCAL SAR as report content                            | ✅ Caisson-namespaced `caisson-crosswalk-rollup` prop             | oscal-export.ts:438-442                       |
| Unresolved collector hard-blocks the pack exactly as today            | ✅ throws `EvidencePackBlockedError`, no partial pack             | generate.test.ts:241 (phase-1 scan unchanged) |
| Golden gate fails on byte drift; re-bless only where provenance lands | ✅ only `soc2-tsc.catalog.json` among catalog goldens             | §5                                            |

**The marquee `implements` cell is real, end to end.** `DATA-PROTECTION.DISPOSAL → SOC2-TSC C1.2`
reaches `implements` because all three Fork E conditions hold: the control is `ready`, its C1.2
reference carries a `reviewed` `verification` record (G3), and the SOC2 regime row for C1.2 is
`implements` with a crypto-shred proof pointer (`regimes.ts:113`). The same control's unreviewed
sibling reference (CC6.5) stays `maps-to` — per-reference, restates-never-originates confirmed.

---

## 3. Negative guards (the falsification pass)

- **ISO capped at `maps-to` — structurally, not by convention.** An ISO row joins the rollup via
  `canonicalControlId` as a contribution that never carries a `verification` record, so Fork E
  condition (b) can never hold for a cell an ISO row contributes to. Proven at maximum optimism: with
  every joined control `ready`, every ISO cell is still `maps-to` (rollup.test.ts:239; leg.test.ts:148
  shows A.8.10 stays `maps-to` even though the SAME control reached `implements` in the SOC2 view).
- **Unresolved hard-block intact.** The generator's phase-1 unresolved scan precedes all assembly and
  is untouched; `generate.test.ts:241` asserts the blocked report with no pack. The blocked golden
  changed by exactly the format-version literal (`"1"→"2"`), nothing else.
- **No `implements` without the full Fork E predicate.** `gap`/`unresolved` control status can never
  reach `implements`; no matching regime row (HIPAA, EU-AI-Act) defaults `maps-to`
  (rollup.test.ts:118-148).
- **Copy law.** A schema-level guard on the rollup cell `note` rejects
  "compliant"/"certified"/"verified"; the existing `postureCopy` guard is unchanged. No
  compliant/certified/verified marketing language anywhere in the ISO crosswalk or rollup.

---

## 4. Locks (ADR-0347) — each satisfied

- **G1 — `canonicalControlId` join (Option B).** `RegimeCrosswalkRow` gained the optional field
  (regime-crosswalk.ts:102); every ISO row carries one; the rollup performs the second-pass join
  (crosswalk-rollup.ts:219-248). Legal gate still caps ISO at `maps-to`.
- **G2 — crosswalk-level `seedProvenance`.** On `RegimeCrosswalk` (regime-crosswalk.ts:137-153),
  https-only URL + 64-hex digest. `iso27001Crosswalk.seedProvenance` pins the NIST OLIR **2022**
  xlsx. **The pin is real:** a live fetch of the pinned URL hashes to
  `e631de23…aff5cbd9`, byte-identical to the committed `sourceDigest` (independently re-verified this
  session). Not the retired 2013 `.docx`.
- **G3 — one reviewed record on `DATA-PROTECTION.DISPOSAL → SOC2-TSC C1.2`.** `reviewedBy: operator`,
  `status: reviewed`. Its `sourceDigest` (`e5797732…99d1cbe0`) is the real SHA-256 of the reviewed
  proof file `packages/field-crypto/src/crypto-shred.test.ts` (re-verified this session). Only
  `soc2-tsc.catalog.json` re-blessed.
- **G4 — no attestation format work now.** Format stays `v2`; no `AttestationRecord`, no `attestations`
  manifest section, no `v3`. The pack-format comment documents the deferred `v2→v3` bump.

---

## 5. Golden discipline (Fork C)

Catalog goldens changed: **only** `packages/frameworks-pack/src/__golden__/soc2-tsc.catalog.json`
(the G3 record). `hipaa-security` and `eu-ai-act` catalog goldens are byte-identical — Fork C
honored. The format-version re-bless is a SEPARATE, expected set: the evidence-pack manifest goldens
(compliance-core, compliance, signing-primitive), the OSCAL bundle goldens, and the leg goldens all
carry only the `v2` bump + the new `crosswalkRollup` section. New goldens: the ISO crosswalk
(`crosswalk-iso-27001.json`) and the binding table (`binding-table.json`). The
`signing-primitive` manifest + `.sig` re-bless is a necessary, in-scope consequence of the v2 bump
(its integration test signs a freshly generated — now v2 — pack; same fixed test key, public key
unchanged), not scope creep.

A clean `bun test` (BLESS unset) across
`packages/compliance-core/src packages/frameworks-pack/src packages/compliance/src apps/compliance/lib`
is green: **297 pass / 0 fail**.

---

## 6. Licensing / legal floor

- No ISO Annex A text: every ISO row `summary` is an own-authored paraphrase over a bare identifier.
- OLIR is CHECK DATA only — URL + hash pinned, identifiers/mapping rows only, never text; the retired
  2013 edition is not used.
- The `control.ts:5` narrowing (P7) is intact: reads "the ban is ND-specific (ADR-0057 as narrowed by
  ADR-0333)… public-domain/CC0 … may seed or check crosswalk MAPPING ROWS." ND ban untouched.

---

## 7. Determinism + gates

- **Determinism:** rollup cells sorted `(framework, reference)`, no clock, no UUIDs in the canonical
  body; input-order invariance test green (rollup.test.ts:265). The generator's existing double-run
  determinism holds; the signature over the v2 body verifies (rollup is inside the canonical body it
  already covers).
- **OSCAL:** rides the SAR as a free-string `prop/@value` under the Caisson namespace — no
  NIST-constrained token field (R1 avoided). `oscal-conformance.test.ts` green.
- **Gates:** `bunx turbo run build lint test` on all touched packages — 33 tasks, all green.
  `standards-gate` — **green (0 errors)** after the changeset-prose fix below. Full test suite green.

**One defect found and fixed in VERIFY.** The G2 changeset bodies cited ADR ids verbatim, which the
required `standards-gate`'s `changeset-prose-adr` check rejects (a changeset ships into the package
CHANGELOG and must be buyer-readable). Rewrote the four `exec-xwalk-*` changeset bodies in
buyer-readable prose (frontmatter/bumps unchanged, coverage preserved); the gate now exits 0.
Committed atomically.

**CI-deferred (not runnable locally, unaffected by this change's content):** the `deterministic`
security-scan gate (CAISSON-95) and `registry-index` byte-identity proof — no registry manifest or
scanned-surface change in this wave.

---

## 8. Out-of-scope confirmations

- **Group D (attestations)** — correctly NOT built: no `AttestationRecord`, no manifest section,
  format stays v2 (Fork D stage gate + G4). Skipped tasks: **D1, D2**.
- **Group F (dashboard)** — `apps/site` and `packages/ui` are byte-untouched this wave (Kickoff-S
  freeze). Skipped task: **F1**.

**VERDICT: PASS — goal achieved, guards hold, gates green. Ready for SHIP (REVIEW + SECURITY audit
per tags `product`,`security`).**
