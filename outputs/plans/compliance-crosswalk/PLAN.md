# PLAN — Compliance crosswalk: shared-control rollup, structured provenance, ISO 27001, named-record attestations

- **Repo:** caisson · **Phase:** Act 2 (PLAN) · **SPEC:** `outputs/specs/compliance-crosswalk/SPEC.md` (LOCKED, amended 2026-07-13)
- **Locks:** `knowledge/decisions/ADR-0333-compliance-crosswalk-locks.md` (supersedes `ADR-0057` in part — ND ban absolute, comment narrowed)
- **Tags:** `product`, `security` → SHIP fires REVIEW + SECURITY audit.
- **This session is PLAN-ONLY.** No code is modified here. EXECUTE runs in a later session.
- **Wave constraint:** `packages/ui` and `apps/site` are FROZEN this wave (owned by the parallel Kickoff-S design session). Tasks touching those trees are planned but gated (Group F).

---

## 1. Goal (goal-backward from the SPEC)

Make one green collector run visibly satisfy every framework requirement the same mechanism honestly covers. Today the three shipped framework packs are near-disjoint canonical-control catalogs (17/19/17 controls; exactly **three** control ids shared across packs) whose per-control `crosswalk[]` pointers are never joined, so evidence collected for one SOC 2 control does not "light up" the HIPAA / EU-AI-Act requirement it also covers. The delta is two moves plus one framework: (1) a **pure rollup function** in `compliance-core` that joins collector results against the existing `crosswalk[]` pointers and renders a per-framework coverage matrix at the honest claim level (Fork E: restates, never originates), surfaced first in the evidence pack's new `crosswalkRollup` section + the OSCAL SAR seam, dashboard second; (2) **structured provenance** (`verification` object) replacing the never-shipped `verified: boolean` on `CrosswalkReference`; (3) **ISO 27001** as a fourth `regimes.ts`-pattern crosswalk (bare identifiers + own paraphrase, OLIR-2022 seed as CHECK data, maps-to only until the Legal gate clears); and, staged AFTER the rollup ships (Fork D), **named-record attestations** carried in the pack manifest under the existing per-tenant signature. VERIFY (goal-backward) re-asks: does a single `rls-force` pass propagate `maps-to`/`implements` per Fork E across all three framework views + ISO, appear in the pack's `crosswalkRollup` with mechanically-chosen claim language, and hard-block on any unresolved collector — with goldens re-blessed only where a provenance field lands (Fork C)?

---

## 2. Preconditions & premise checks (grounded against the tree)

Verified during planning — EXECUTE must re-confirm, not re-derive:

| #   | Premise (SPEC claim)                                  | Ground truth                                                                                                                                                                                                                           | Status                                                                                       |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| P1  | Three shared control ids across packs                 | Enumerated by importing the packs: **`GOVERNANCE.SECURITY-RESPONSIBILITY`** (soc2-tsc + hipaa-security, SPEC-confirmed), **`AUDIT.IMMUTABLE-LOG`** (soc2-tsc + eu-ai-act), **`GOVERNANCE.DOCUMENTATION`** (hipaa-security + eu-ai-act) | ✅ WR-09 gate satisfied (see §2a)                                                            |
| P2  | Ref counts 38 / 31 / 19                               | Sum of `crosswalk[].reference` by framework LABEL = SOC2-TSC **38**, HIPAA-Security **31**, EU-AI-Act **19**                                                                                                                           | ✅ exact                                                                                     |
| P3  | `crosswalk[]` pointers already exist per control      | `packages/frameworks-pack/src/registry/control.ts:67` `crosswalk: z.array(CrosswalkReference).default([])`; populated in all three packs                                                                                               | ✅                                                                                           |
| P4  | `compliance-core` can consume the catalogs            | `packages/compliance-core/package.json:24` depends `@caisson/frameworks-pack` (workspace:\*); `pack-format.ts:25` already imports `CrosswalkReference`                                                                                 | ✅ dep exists; rollup adds no new dep                                                        |
| P5  | Open-core no-depend-up is not at risk                 | Both `frameworks-pack` (`0.3.0`) and `compliance-core` (`0.2.2`) are `LicenseRef-Caisson-Commercial`; the rollup + ISO code stays entirely inside commercial packages                                                                  | ✅ boundary N/A                                                                              |
| P6  | No OSCAL catalog-model emitter exists (grounding fix) | `oscal-export.ts` emits SAR (`assessment-results`) + POA&M only; `oscal-assessment-plan.ts` = AP fragment. No catalog emitter                                                                                                          | ✅ rollup rides SAR as report content (Fork F), not a new catalog                            |
| P7  | `control.ts:5` comment already narrowed by ADR-0333   | `control.ts:5-9` ALREADY reads "the ban is ND-specific (ADR-0057 as narrowed by ADR-0333)… public-domain/CC0 … may seed or check crosswalk MAPPING ROWS"                                                                               | ✅ obligation (7 comment-fix) already landed with ADR-0333 — EXECUTE VERIFIES, does not redo |
| P8  | Manual slots have no person identity today            | `collector.ts:36` `ManualAttachmentSlot = {id,label,required}`; fill tracked at edge (`generate.ts:71` `filledSlotIds`), no record on fill                                                                                             | ✅ attestation is net-new                                                                    |
| P9  | Pack signature covers the whole body                  | `signing-primitive/src/sign.ts:77` signs `canonicalize(manifest) ∥ chainAnchor.tipHash`; any manifest addition (rollup, attestations) is covered transitively                                                                          | ✅ no new signing surface needed                                                             |
| P10 | Golden mechanism                                      | `tooling/testing/src/golden.ts` `matchGolden`; re-bless via **`BLESS=1 bun test <path>`**                                                                                                                                              | ✅                                                                                           |
| P11 | Format version is append-only                         | `pack-format.ts:31` `EVIDENCE_PACK_FORMAT_VERSION = "1"`; ADR-0006 → bump to a new literal, old packs never rewritten                                                                                                                  | ✅                                                                                           |

**Blocking premise for the SPEC's Verification scenario:** `rls-force` collector default control id is `ACCESS-CONTROL.LOGICAL` (`collectors/rls-force.ts:38`), which crosswalks to `SOC2-TSC` `CC6.1/CC6.2/CC6.3`; the soc2 regime row for `CC6.1` is `maps-to` (`crosswalks/regimes.ts:41`). So the Verification scenario correctly yields **`maps-to`** cells — no `implements` is required to pass VERIFY. (The only framework-pack ref that could ever reach `implements` under Fork E is `DATA-PROTECTION.DISPOSAL → SOC2-TSC C1.2`, since `C1.2` is the one `implements` soc2 regime row — see Fork G3.)

### 2a. WR-09 evidence gate — exact shared control ids (SCRIPTED)

Enumerated by importing the real pack objects (not grep) — script archived at
`outputs/plans/compliance-crosswalk/` working notes; reproduce with:

```bash
bun -e 'import {soc2Tsc} from "./packages/frameworks-pack/src/frameworks/soc2-tsc.ts";
import {hipaaSecurity} from "./packages/frameworks-pack/src/frameworks/hipaa-security.ts";
import {euAiAct} from "./packages/frameworks-pack/src/frameworks/eu-ai-act.ts";
const m=new Map<string,string[]>();
for(const [s,p] of Object.entries({["soc2-tsc"]:soc2Tsc,["hipaa-security"]:hipaaSecurity,["eu-ai-act"]:euAiAct}))
  for(const c of p.controls){const a=m.get(c.id)??[];a.push(s);m.set(c.id,a);}
console.log([...m].filter(([,v])=>v.length>1).sort());'
```

Result (locked into the rollup test fixtures):

| Shared canonical control id          | Packs                      | Requirement refs that co-light                 |
| ------------------------------------ | -------------------------- | ---------------------------------------------- |
| `GOVERNANCE.SECURITY-RESPONSIBILITY` | soc2-tsc + hipaa-security  | SOC2-TSC `CC1.3` ↔ HIPAA `164.308(a)(2)`       |
| `AUDIT.IMMUTABLE-LOG`                | soc2-tsc + eu-ai-act       | SOC2-TSC `CC4.1`/`CC7.2` ↔ EU-AI-Act `Art. 12` |
| `GOVERNANCE.DOCUMENTATION`           | hipaa-security + eu-ai-act | HIPAA `164.316(*)` ↔ EU-AI-Act `Art. 18`       |

These three are the golden-path demonstrations of the "fix once, satisfied across N frameworks" move — the rollup test asserts each lights all co-crosswalked requirements from one control's status.

---

## 3. Task decomposition (atomic; lane per task)

Lanes: **sonnet** = bounded implementation; **opus** = review-grade / cross-cutting-correctness work; never fable for fan-out. Sizes: S ≤ ~60 LOC, M ≤ ~150, L ≤ ~300.

### Group A — Structured provenance (foundation; do first)

**A1 — `verification` object on `CrosswalkReference`**

- Files: `packages/frameworks-pack/src/registry/control.ts`
- Change: add an OPTIONAL `verification` field to the `CrosswalkReference` `strictObject` (there is no existing `verified: boolean` to remove — this is the field the SPEC calls "replacing the proposed boolean"). Shape (SPEC §"Structured provenance"): `strictObject({ status: z.enum(["unreviewed","reviewed","expert-reviewed"]), relationship: z.enum(["related","partial","equivalent"]), sourceId: z.string().trim().min(1).max(120), sourceVersion: z.string().trim().min(1).max(80), sourceDigest: z.string().regex(SHA256_HEX), reviewedBy: z.string().trim().min(1).max(200), reviewedAt: z.string().trim().min(1).max(40) }).optional()`. Export the inferred type. Keep `.strict()`/`strictObject` (additive optional field is `.strict()`-safe).
- Verify: `bun test packages/frameworks-pack/src/registry/control.test.ts` (add cases: valid verification parses; unknown field rejected; bad digest rejected). `bun run check` typechecks.
- Size: **S** · Lane: **sonnet**

**A2 — provenance stale-on-source-change invariant (test-encoded)**

- Files: `packages/frameworks-pack/src/registry/control.test.ts` (+ a tiny helper in `control.ts` only if needed)
- Change: encode the SPEC invariant "a source-digest change automatically invalidates dependent verification (reverts to `unreviewed`)". In v1 this is a **documented + tested convention**, not a runtime recompute (no external source is ingested at runtime — ponytail: don't build a recompute engine for zero live sources). Add a test asserting the intended semantics via a small pure helper `isVerificationStale(ref, currentSourceDigest): boolean` (returns true when `ref.verification.sourceDigest !== currentSourceDigest`) that the rollup consults.
- Verify: `bun test packages/frameworks-pack/src/registry/control.test.ts`.
- Size: **S** · Lane: **sonnet**

> Note: authoring actual `verification` records onto specific pack references is **Fork G3** (operator-gated content decision) — A1/A2 only add the capability. With no records authored, every catalog golden is byte-identical (Fork C: re-bless only where it lands → zero catalog golden churn).

### Group B — Rollup pure function + pack/OSCAL rendering (the core v1 delta)

**B1 — `computeCrosswalkRollup` pure function**

- Files (new): `packages/compliance-core/src/evidence/crosswalk-rollup.ts` (+ `crosswalk-rollup.test.ts`)
- Change: a pure, deterministic function
  ```
  computeCrosswalkRollup(input: {
    catalogs: readonly Framework[];                          // the 3 shipped packs, injected (not imported) — pure
    controlStatuses: ReadonlyMap<string, "ready"|"gap"|"unresolved">;  // per canonical control id
    regimeCrosswalks: readonly RegimeCrosswalk[];            // Fork E gate reference (soc2/pci/gdpr/iso)
  }): CrosswalkRollup
  ```
  Output (Zod-typed schema in the same file, `.strict()`): per framework LABEL → cells `{ framework, reference, canonicalControlIds: string[], status, claim, evidencePointers: string[], note? }`. Cell status = worst-of the mapping canonical controls' statuses. **Fork E propagation (binding):** `claim = "implements"` iff (a) EVERY canonical control that maps to the requirement is `ready`, AND (b) the mapping `CrosswalkReference.verification.status ∈ {reviewed, expert-reviewed}` and is not stale (A2), AND (c) a `regimeCrosswalks` row for the same requirement (joined via the label→regime map, B2) exists AND its `claim === "implements"`; otherwise `claim = "maps-to"`. "Where one exists": **no matching regime row ⇒ `maps-to`** (restates, never originates). Attach the NIST-OLIR subjective/incomplete warning as `note` on any cell whose reference verification `sourceId` is an OLIR seed.
- Ponytail: pure join over in-memory data; no I/O, no clock, no new dep. `// ponytail:` comment on the worst-of-status reduction (naive O(controls×refs) scan — fine at 53 controls).
- Verify: `bun test packages/compliance-core/src/evidence/crosswalk-rollup.test.ts` — assert (i) the three shared ids co-light (§2a); (ii) an `rls-force`-pass fixture yields `maps-to` on CC6.1/CC6.2/CC6.3; (iii) a `ready` + `reviewed` + regime-`implements` ref (synthetic C1.2) yields `implements`; (iv) `unresolved` control status propagates `unresolved`.
- Size: **L** · Lane: **opus** (claim-posture correctness is the security-sensitive heart of the feature; CR-10/Fork E logic)

**B2 — framework-label ↔ regime-id join helper**

- Files: `packages/compliance-core/src/evidence/crosswalk-rollup.ts` (co-located) OR `packages/frameworks-pack/src/crosswalks/regimes.ts`
- Change: a tiny explicit map `{"SOC2-TSC":"soc2","HIPAA-Security": <none>,"EU-AI-Act": <none>,"ISO-27001":"iso-27001"}`. Only SOC2 and ISO have a regime crosswalk today; HIPAA/EU-AI-Act have none → their cells always `maps-to` (correct). Keep it a bare literal, not a config file (ponytail).
- Verify: covered by B1 tests.
- Size: **S** · Lane: **sonnet**

**B3 — pack-format v2 with `crosswalkRollup` section**

- Files: `packages/compliance-core/src/evidence/pack-format.ts` (+ `pack-format.test.ts`)
- Change: bump `EVIDENCE_PACK_FORMAT_VERSION` `"1" → "2"` (ADR-0006 append-only). Add `crosswalkRollup` to `evidencePackManifestSchema` (import the rollup schema from B1; make it **required** in v2). Keep the blocked-report schema's `formatVersion` literal in sync ("2"). No removal of any existing field. Update the format-version comment block.
- Verify: `bun test packages/compliance-core/src/evidence/pack-format.test.ts`; parse round-trip of a v2 body with a rollup.
- Size: **M** · Lane: **sonnet**

**B4 — generator emits the rollup**

- Files: `packages/compliance-core/src/evidence/generate.ts` (+ `generate.test.ts`)
- Change: `GenerateEvidencePackInput` gains `crosswalkRollup: CrosswalkRollup` (caller-computed via B1 — keeps the generator pure and free of concrete-catalog imports, matching the "facts injected at the edge" ethos of `collector.ts`). Assemble it into the v2 manifest before `parseEvidencePackManifest`. Rollup is derived-not-asserted like the summary; it never enters the signature path differently (it's inside the canonical body, so the existing signer covers it — P9).
- Verify: `bun test packages/compliance-core/src/evidence/generate.test.ts` — v2 manifest carries the rollup; determinism (two runs byte-identical) preserved; blocked path still throws before assembly.
- Size: **M** · Lane: **sonnet**

**B5 — OSCAL SAR carries the rollup as report content (Fork F)**

- Files: `packages/compliance-core/src/evidence/oscal-export.ts` (+ `oscal-export.test.ts`, `oscal-export-xml.ts` if the XML mirror needs the field)
- Change: render `manifest.crosswalkRollup` into the SAR as **report content, not a new catalog artifact** — the smallest honest option is one Caisson-namespaced `prop` per rollup cell under the `result` (or a single back-matter resource carrying the rollup JSON). Do NOT emit an OSCAL catalog model (grounding fix P6; that is the deferred fork). Keep `EXAMINE`/readiness-language invariants. Deterministic given injected `now`/`newId`.
- Ponytail: reuse the existing `OscalProp` + back-matter machinery; add no new transport. `// ponytail:` on the chosen carrier.
- Verify: `bun test packages/compliance-core/src/evidence/oscal-export.test.ts`; `bun test packages/compliance-core/src/evidence/oscal-conformance.test.ts` (oscal-cli validate still green on Blacksmith).
- Size: **M** · Lane: **opus** (OSCAL XSD conformance is brittle; SECURITY/audit-facing artifact)

**B6 — re-bless evidence-pack + OSCAL goldens (v2)**

- Files: `packages/compliance-core/src/__golden__/{evidence-pack.manifest.json, oscal-*.bundle.json, oscal-assessment-plan-*.json}`; `packages/compliance/src/__golden__/evidence-pack.manifest.json`; `apps/compliance/lib/__golden__/{leg-evidence-pack.json, leg-evidence-pack-hipaa.json, leg-oscal-bundle.json}`
- Change: these re-bless **wholesale** because the format version bumped to "2" and the rollup section is new — this is expected under append-only (a new format version), and is a DIFFERENT golden set from the framework-pack catalog goldens (Fork C's "only where it lands" governs the _catalog_ goldens, not the format-version bump). Update the caller edges (`apps/compliance/lib/leg.ts`, `packages/compliance/src/evidence/oscal-bundle.ts`) to compute + pass the rollup.
- Verify: `BLESS=1 bun test packages/compliance-core/src packages/compliance/src apps/compliance/lib` then a clean `bun test` (BLESS unset) is green; review each golden diff shows ONLY the version bump + rollup addition.
- Size: **M** · Lane: **sonnet** (mechanical re-bless + edge wiring; opus already covered the logic)

### Group C — ISO 27001 as a fourth regimes.ts crosswalk

**C1 — extend `RegimeId` + seed-provenance on `RegimeCrosswalk`**

- Files: `packages/frameworks-pack/src/crosswalks/regime-crosswalk.ts` (+ `crosswalks.test.ts`)
- Change: extend `RegimeId = z.enum([...,"iso-27001"])` (additive; existing three goldens unaffected). Add an OPTIONAL crosswalk-level `seedProvenance` to `RegimeCrosswalk`: `strictObject({ sourceId: z.literal("nist-sp800-53r5-iso27001-2022-olir"), sourceVersion: string, sourceUrl: https-only URL, sourceDigest: SHA256_HEX })` — this is where the OLIR-2022 URL+hash pin lives (distinct from A1's per-reference `verification`, because regime rows use `RegimeCrosswalkRow`, not `CrosswalkReference`). `.strict()`-safe optional.
- Verify: `bun test packages/frameworks-pack/src/crosswalks/crosswalks.test.ts`.
- Size: **S** · Lane: **sonnet**

**C2 — author `iso27001Crosswalk`**

- Files: `packages/frameworks-pack/src/crosswalks/regimes.ts` (+ new golden `__golden__/crosswalk-iso-27001.json`)
- Change: author a `RegimeCrosswalk` for ISO/IEC 27001:2022 Annex A — bare Annex A identifiers (`A.5.x`/`A.8.x` …) as `control`, own-authored one-sentence paraphrases as `summary`, real Caisson mechanism per row, `buyerResponsibility` always present. **All rows `claim: "maps-to"`** (Legal gate — never `implements`, never `expert-reviewed` in v1). Set `seedProvenance` to the OLIR-2022 xlsx URL + SHA-256 (CHECK data only — the xlsx is NEVER ingested as text; identifiers + own paraphrase only). Add `iso27001Crosswalk` to the exported `regimeCrosswalks` array (`regimes.ts:319`). Author the ISO `regimeSpecificDisclaimer` (standalone product cannot be ISO-certified; identifiers are factual citations). Extend the file header to record the OLIR seed provenance + the NEVER-the-2013-docx rule.
- **Legal/copy guard (plan-level):** no "verified"/"compliant"/"certified" language; status stays maps-to; ADR-0319 legal answer + Fork B expert review gate any future `expert-reviewed`/marketing "verified" claim.
- Verify: `BLESS=1 bun test packages/frameworks-pack/src/crosswalks` → then clean green; assert every ISO row is `maps-to`; assert `seedProvenance.sourceUrl` is https + digest is 64-hex.
- Size: **L** · Lane: **opus** (own-authored legal-sensitive content; clean-room paraphrase discipline; licensing floor)

**C3 — wire ISO into the rollup (fourth view)** — _depends on Fork G1 lock_

- Files: `packages/compliance-core/src/evidence/crosswalk-rollup.ts`
- Change: per the Fork G1 recommendation (authored maps-to view rendered as a parallel fourth framework in the rollup, no live-collector join in v1), include the ISO crosswalk's rows as rollup cells carrying their authored `maps-to` claim + `seedProvenance`-derived OLIR note. If the operator locks G1 option (b) instead (ISO rows gain an optional `canonicalControlId` pointer for live-collector join), this task grows to add that pointer to `RegimeCrosswalkRow` + the join.
- Verify: `bun test packages/compliance-core/src/evidence/crosswalk-rollup.test.ts` (ISO view present; all maps-to; OLIR note attached).
- Size: **S** (option a) / **M** (option b) · Lane: **sonnet**

### Group D — Named-record attestations (STAGE GATE: only after Group B ships — Fork D)

> **Explicit stage gate:** Group D does not begin until Group B (rollup) is merged. Fork D locks attestations as "a distinct migration step, not the same wave." A second pack-format bump is likely (Fork G4).

**D1 — `AttestationRecord` schema**

- Files: `packages/compliance-core/src/evidence/pack-format.ts` (or new `attestation.ts`) (+ test)
- Change: `AttestationRecord = strictObject({ slotId, statement, actor: strictObject({ identity, role }), evidenceDigest: SHA256_HEX, packId, signedAt })`. Additive optional `attestations: z.array(AttestationRecord)` on the manifest. Because it's a new manifest section under append-only, bump format version again (`"2" → "3"`) OR land as optional-in-v2 — **Fork G4** (operator lock).
- Verify: schema round-trip test.
- Size: **M** · Lane: **sonnet**

**D2 — record attestations at manual-slot fill (edge)**

- Files: `packages/compliance-core/src/evidence/generate.ts`; edge callers (`apps/compliance/lib/leg.ts`, `packages/compliance/src/evidence/oscal-bundle.ts`)
- Change: when a manual slot is filled with an actor+statement, build an `AttestationRecord` (authenticated actor identity from the edge — NOT self-asserted-only; the record proves "the tenant asserted person X attested", covered transitively by the ADR-0056 per-tenant signature, P9). No per-person Ed25519 key (explicit non-goal). Buyer-facing copy must state that distinction verbatim.
- Verify: `bun test packages/compliance-core/src/evidence/generate.test.ts`; re-bless the affected goldens.
- Size: **M** · Lane: **opus** (honesty-of-claim + signature-coverage reasoning; CR-05 is why this is opus)

### Group E — Binding-table derived artifact

**E1 — control→collector binding table (derived doc)**

- Files (new): a generator script under `packages/compliance-core/` (e.g. `src/evidence/binding-table.ts` exporting a pure `buildBindingTable(collectors): BindingRow[]`) + a golden/doc output; wire into `docs/compliance/control-traceability.md` neighborhood as a derived artifact (NOT a new config layer — the code IS the table, per Scope 6 / em-dash tool-bindings analog).
- Change: enumerate each shipped collector's `{ id, controlId, manualSlots }` → a deterministic table. Collectors + their default control ids (grounded): `substrate.tenant-isolation-force → ACCESS-CONTROL.LOGICAL`, `substrate.audit-chain-integrity → AUDIT.IMMUTABLE-LOG`, `substrate.worm-retention → DATA-PROTECTION.DISPOSAL`, `substrate.field-crypto-policy → DATA-PROTECTION.ENCRYPTION`, `substrate.ai-risk-register → RISK-MANAGEMENT.AI-LIFECYCLE`, `substrate.impersonation-dual-audit → ACCESS-CONTROL.LOGICAL` (all overridable via `controlId` option).
- Ponytail: pure derivation + one golden; no config file.
- Verify: `bun test` on the binding-table test (byte-stable golden); a check that every collector's controlId resolves to a real canonical control in some pack.
- Size: **M** · Lane: **sonnet**

### Group F — Dashboard coverage matrix (LATER STAGE — apps/site FROZEN)

**F1 — buyer-dashboard coverage matrix (canonical controls × frameworks)**

- Files: `apps/site/**` (buyer dashboard) — **FROZEN this wave (Kickoff-S).**
- **Sequencing constraint (hard):** DO NOT touch `apps/site` (or `packages/ui`) this wave. F1 is planned but blocked on (a) the Kickoff-S design-session freeze lifting AND (b) Group B merged (Fork F: dashboard is second). When unblocked, render the `crosswalkRollup` section as a coverage matrix; consume the pack's rollup (no recompute in the app). Design/craft routes through `gw-frontend-designer` + `impeccable` per gridwork doctrine.
- Verify (later): matrix renders from a v2 pack fixture; a11y + contrast gates; no client/server bundle leak.
- Size: **L** · Lane: **opus** (public surface; UI review tag) — deferred, not scheduled this wave.

### Group G — Guards, changesets, state (cross-cutting)

**G1 — legal/copy guard tests**

- Files: `packages/frameworks-pack/src/crosswalks/crosswalks.test.ts`, `packages/compliance-core/src/evidence/crosswalk-rollup.test.ts`
- Change: assert (i) no ISO crosswalk row is `expert-reviewed`; (ii) rollup never emits `implements` for an ISO cell in v1; (iii) `postureCopy`/rollup copy never contains "compliant"/"certified"/"verified"-as-marketing (extend the existing `pack-format.ts:158` refine coverage to the rollup rendering).
- Verify: the guard tests fail if a future edit crosses the Legal gate.
- Size: **S** · Lane: **sonnet**

**G2 — changesets + state docs**

- Files: `.changeset/*.md` (minor bumps: `@caisson/frameworks-pack`, `@caisson/compliance-core`, `@caisson/compliance`; + `apps/compliance` if the changeset gate requires apps — per memory `changeset-gate-covers-private-pkgs`, `packages/*` changes REQUIRE a changeset); `docs/build-state.md`; `docs/state/outstanding-work.md`; `docs/adr-index.md` (ceiling already 0333 — no new ADR needed; ADR-0333 governs). Run `bun run sot`.
- Change: naming changesets for every touched `packages/*`; note the two format-version bumps.
- Verify: `bun run sot` green; `changeset status --since=origin/main` passes.
- Size: **S** · Lane: **sonnet**

---

## 4. Task ordering / dependency graph

```
A1 ─┬─> A2
    │
    ├─> B1 ──> B2(inline) ──> B3 ──> B4 ──> B6
    │           └─────────────────────> B5 ──> B6
    │
C1 ─┴─> C2 ──> C3        (C3 needs B1 + Fork G1 lock)
                 │
   B6 + C3 ──────┴──> [Group B+C VERIFY green] ══ STAGE GATE ══> D1 ──> D2
                                                                  │
E1 (independent, after A1 for control-id resolution) ────────────┤
                                                                  │
G1 (after C2 + B1) · G2 (last, after all code) ───────────────────┘

F1 (apps/site) — BLOCKED on Kickoff-S freeze lift + Group B merge (later stage)
```

- **Critical path:** A1 → B1 → B3 → B4 → B6 → (VERIFY) → D1 → D2.
- **Parallelizable:** Group C (C1→C2) runs alongside Group B until C3 (needs B1). E1 runs alongside once A1 lands. B5 forks off B1 in parallel with B3/B4, rejoins at B6.
- **Hard gates:** Fork G1 must be locked before C3; Fork G4 before D1; Group B fully merged before Group D (Fork D stage gate); Kickoff-S freeze lift before F1.

---

## 5. Open forks & operator gates

The SPEC's six lettered forks (A–F) are already LOCKED in ADR-0333 — restated in §8 as guards, not re-opened. PLAN surfaces these **implementation sub-forks** the locked forks leave to PLAN. Each carries a recommendation + confidence; none is auto-decided.

> **LOCKED 2026-07-13 (operator picker) → ADR-0347.** G1 = **Option B, the `canonicalControlId`
> join** (overrides the parallel-view recommendation — C3 builds the join; the Legal gate still
> caps ISO cells at maps-to until cleared). G2 = **crosswalk-level `seedProvenance`**.
> G3 = **Option B, one reviewed record** on DATA-PROTECTION.DISPOSAL → SOC2-TSC C1.2 (re-bless
> soc2-tsc golden only; operator is reviewer of record). G4 = **bump "2" → "3" at Group D**.

**Fork G1 — How the ISO regime-crosswalk participates in the rollup.**
The rollup core joins the three framework PACKS' canonical-control `crosswalk[]` pointers; ISO is a `regimes.ts` RegimeCrosswalk (no canonical-control pointers). VERIFY requires ISO to appear "as a fourth view."

- **Option A (Recommended, confidence: med-high):** ISO rows render as a parallel fourth view carrying their authored `maps-to` claim + OLIR note; no live-collector join. Evidence: Legal gate forces `maps-to` regardless (C2), so a live-collector `implements` path is unreachable in v1 — building the join is dead flexibility (ponytail rung 1). Smallest diff; VERIFY's "plus the ISO crosswalk" is satisfied by presence.
- **Option B (confidence: low):** add an optional `canonicalControlId` to `RegimeCrosswalkRow` so a collector pass lights ISO rows like the packs. More surface, and still capped at `maps-to` by the Legal gate — no v1 payoff.
- **OPERATOR LOCK REQUIRED before EXECUTE** (gates C3).

**Fork G2 — Where ISO seed-provenance lives.**
Per-reference `verification` (A1) is on `CrosswalkReference` (framework packs), but ISO rows are `RegimeCrosswalkRow`.

- **Option A (Recommended, confidence: high):** crosswalk-level `seedProvenance` on `RegimeCrosswalk` (C1). Evidence: the OLIR pin is one seed for the whole ISO crosswalk, not per-row; matches the URL+hash-pin obligation; additive `.strict()`-safe.
- Option B: per-row provenance (verbose, no benefit — the seed is uniform). Option C: doc-only (loses machine-checkability).
- **OPERATOR LOCK REQUIRED before EXECUTE** (gates C1/C2). _(Recommendation is strong; folded into C1 unless the operator objects.)_

**Fork G3 — Which framework-pack references get authored `verification` records in v1 (Fork C golden-re-bless scope).**

- **Option A (Recommended, confidence: med):** author NONE in v1 — the `verification` capability ships (A1) but no record is placed, so every catalog golden stays byte-identical (zero churn, Fork C honored) and every rollup cell is `maps-to`. VERIFY passes (its scenario needs no `implements`).
- **Option B (confidence: med):** author a single `reviewed` record on `DATA-PROTECTION.DISPOSAL → SOC2-TSC C1.2` (the one framework-pack ref whose regime row is `implements`, `regimes.ts:99`), re-blessing only `soc2-tsc.catalog.json` — this makes the rollup demonstrate one real `implements` cell (crypto-shred), proving the Fork E propagation end to end.
- Trade-off: A is smallest + zero content risk; B proves the marquee "implements" path but requires an operator-reviewed provenance record (operator is the reviewer of record → `reviewedBy`).
- **OPERATOR LOCK REQUIRED before EXECUTE.**

**Fork G4 — Format version for attestations (Group D).**

- **Option A (Recommended, confidence: med):** attestations bump `"2" → "3"` when Group D ships (rollup already took `"1" → "2"`). Evidence: cleanest append-only lineage; Fork D stages attestations as a separate migration anyway.
- Option B: land `attestations?` as optional-in-v2 up front (one bump total) — smaller version churn but couples two staged features into one format version, muddying the Fork D stage boundary.
- **OPERATOR LOCK REQUIRED before EXECUTE** (gates D1). Not needed until Group B is merged.

---

## 6. Risks & unknowns

- **R1 — OSCAL XSD conformance (B5).** Adding rollup content to the SAR can trip `oscal-cli validate` (the `oscal-conformance` CI gate) if placed in a slot NIST's XSD constrains (free prose in a token field bit us before — `oscal-export.ts:103`). Mitigation: carry the rollup as Caisson-namespaced `prop`s or a back-matter resource (allowed), never in constrained token fields; B5 runs `oscal-conformance.test.ts` before B6.
- **R2 — Determinism regression (B4/B5).** The rollup must be byte-stable (sorted cells, no clock, no UUIDs in the canonical body). A Map-iteration-order or unsorted-array slip breaks the golden + the signature reproducibility. Mitigation: sort cells by `(framework, reference)`; the generator's existing double-run determinism test (`generate.ts:499-500` pattern) covers it.
- **R3 — Two golden sets conflated (Fork C).** Re-blessing framework-pack CATALOG goldens wholesale (instead of only where `verification` lands) would violate Fork C. Mitigation: G3-Option-A ⇒ zero catalog churn; if G3-Option-B, re-bless ONLY `soc2-tsc.catalog.json`. The format-bump re-bless (B6) is a SEPARATE, expected set (evidence-pack + OSCAL goldens).
- **R4 — ISO clean-room paraphrase (C2).** Own-authored summaries must not be recognizable derivations of ISO Annex A text; the OLIR xlsx is CHECK data (identifiers only), never a text source, and never the retired 2013 `.docx`. Mitigation: opus lane; author from the identifier + Caisson's own control knowledge; SECURITY/legal guard tests (G1) + the ADR-0319 legal answer gate any "verified" claim.
- **R5 — apps/site freeze collision (F1).** The buyer dashboard lives in the frozen `apps/site`. Mitigation: F1 is explicitly deferred; Group B ships the pack+OSCAL rollup with zero `apps/site` edits, so the feature is sellable/demoable via the pack before the dashboard lands.
- **R6 — `regimes.ts` header + label-map drift.** ISO adds a fourth regime; the label→regime map (B2) and the `regimeCrosswalks` array must both include it or the rollup silently omits ISO. Mitigation: B2 map + C2 array edit are in the same wave; G1 rollup test asserts all four views present.
- **R7 — Unknown: OLIR 2022 xlsx exact URL + digest.** C2 needs the canonical NIST OLIR SP 800-53r5 ↔ ISO 27001:2022 xlsx URL and its SHA-256. EXECUTE must fetch + hash-pin it (read-only; record in `seedProvenance`). If the current OLIR revision differs from what the SPEC assumes, pin the actual current one and note the version.

---

## 7. Goal-backward verification plan (Act 4 will re-ask the SPEC Goal)

VERIFY does NOT tick task boxes — it re-asks the SPEC's stated Goal + runs the SPEC's own Verification section against the merged diff:

1. **The marquee scenario (SPEC §Verification):** a single `rls-force`-pass fixture, fed through `generateEvidencePack`, must (a) light `ACCESS-CONTROL.LOGICAL` green; (b) propagate across every crosswalked requirement in all three framework views + ISO, with claim language chosen MECHANICALLY from `verification.status` per Fork E (`maps-to` here, since no reviewed record on those refs); (c) appear in the pack's `crosswalkRollup` section; (d) surface in the OSCAL SAR as report content; (e) an `unresolved` collector still hard-blocks the pack exactly as today (`generate.ts:361` phase-1 scan unchanged). Runnable: `bun test packages/compliance-core/src packages/compliance/src apps/compliance/lib`.
2. **Fix-once-satisfied-across-N proof:** assert each of the three shared control ids (§2a) lights ALL its co-crosswalked requirements from one control's status — the core sellable claim.
3. **Fork E honesty:** assert no rollup cell renders `implements` unless (verification reviewed+ ∧ regime row implements); ISO cells never `implements` (Legal gate). If G3-Option-B was locked, assert the C1.2 crypto-shred cell IS `implements` and links its proof.
4. **Golden discipline (Fork C):** `bun test` (BLESS unset) green; catalog goldens changed ONLY where a `verification` record landed (zero, or one file under G3-B); evidence-pack + OSCAL goldens show only the v2 bump + rollup.
5. **Determinism + signature:** two generations byte-identical; `signEvidencePack` over the v2 body still verifies (rollup is inside the canonical body it already covers).
6. **Licensing/legal floor:** no ISO/AICPA/PCI control TEXT anywhere; ISO = identifiers + own paraphrase; OLIR is check-data only; `control.ts:5` narrowing intact (P7); ND ban untouched. `oscal-conformance` + `standards-gate` + `bun run sot` green.
7. **SHIP audits (tags `product`,`security`):** `gw-code-reviewer` (opus) + `gw-security-auditor` (fable on the claim-posture/provenance seams) run the branch diff before PR — Fork E propagation and the attestation honesty-of-claim (CR-05) are the audit focal points.

---

## 8. Out-of-scope confirmations (SPEC non-goals restated as guards)

Any EXECUTE task that does these is a defect:

- **No spine consolidation, no vendored 800-53 catalog, no OSCAL catalog-model emitter.** The rollup is a pure join over existing pointers; OSCAL rendering rides the SAR as report content only (Fork F). The dual-catalog OSCAL spine stays a WRITTEN deferred fork gated on a real FedRAMP ask.
- **No new framework except ISO 27001.** ISO ships as a fourth `regimes.ts` crosswalk; no other framework is added.
- **No per-person cryptographic attestation identity** (enrollment authority, revocation, key custody) — v1 is honest named-records under the existing per-tenant signature only. Per-person keys = a separate future program.
- **No per-row chain-verification UI, no external anchoring** (sibling SPECs `SPEC-per-row-verification-ui.md`, `SPEC-rekor-anchoring.md`) — only interfaces named.
- **No "compliant"/"certified" language, no "verified" ISO marketing claim** before the Fork B expert review AND the ADR-0319 legal answer land. ISO stays `maps-to` / status ≤ `reviewed`.
- **No em-dash adoption / no ingestion of its community mappings** (its own labels admit "unverified by a domain expert" — the trap this spec avoids).
- **No pack restructuring / wholesale golden migration** (Fork C) — v1 touches no pack STRUCTURE; catalog goldens re-bless only where a `verification` record lands.
- **No `apps/site` or `packages/ui` edits this wave** (Kickoff-S freeze) — the dashboard matrix (F1) is planned but deferred.

```

```
