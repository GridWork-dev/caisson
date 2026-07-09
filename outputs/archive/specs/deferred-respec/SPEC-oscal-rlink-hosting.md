# SPEC — OSCAL Assessment-Plan `rlink` resolution: author the 3 APs + signed evidence bundle (no hosted route)

**Status: DRAFT — operator lock REQUIRED before any code.** This SPEC directly contradicts a
locked won't-fix — ADR-0208 §4 (`accepted`, 2026-07-02): "OSCAL back-matter `rlink` hosting is
won't-fix… external href resolution is explicitly outside the conformance gate; a dead citation
link does not justify a route" (`ADR-0208-ops-hardening-locks.md:27-29`, mirrored verbatim at
`oscal-export.ts:48-51`) — and amends ADR-0179's locked `import-ap` resolution path. Per the
append-only ADR convention (`CLAUDE.md`: `knowledge/decisions/` is "never edited — supersede with
a later ADR"; "never auto-decide a fork"), **Task 1 is a superseding ADR** (next free number,
expected **ADR-0218** — ceiling 0217, re-check `main` per ADR-0088) that must reverse ADR-0208 §4
**and** amend ADR-0179 in one lock. **No product-code task may start until it is locked.** The
Option-1-vs-2 fork in Design is the operator's to lock; nothing here pre-binds it.

- **Package:** `packages/compliance` (compliance edition, `LicenseRef-Caisson-Commercial`); the
  OSCAL export lives at `src/evidence/*`. Reuses `@caisson/kernel`'s `canonicalize` + the
  in-package Ed25519 signer — no new dependency, no new crypto.
- **Type:** NEW CONTENT + HARDEN IN PLACE — authors the 3 per-framework OSCAL Assessment-Plan
  documents ADR-0179 §B promised and never delivered, plus a signed-bundle assembler that rewrites
  the AP `rlink` to a relative in-bundle path with a SHA-256 `hashes[]` binding. No new package, no
  hosted service, no new public route or egress sink (Option 1).
- **Tags:** `compliance`, `security` (per-tenant Ed25519 signature + SHA-256 integrity binding over
  the exported bundle). `external-system` applies **only** if the operator picks a served-bundle
  sub-variant — which then also demands a same-commit `identity/security-surfaces.md` row.

## Goal (WHAT + WHY)

The deferred-item brief frames this as "rlink hrefs that point at buyer-local artifact paths."
**That is not the code, and correcting it is load-bearing.** The ONLY `rlink` Caisson emits is a
single per-framework Assessment-Plan (AP) citation URL —
`caissonAssessmentPlanUrl(framework.id)` → `https://caisson.sh/oscal/assessment-plan/<framework>.json`
(`oscal-export.ts:53-55`) — placed on one SAR back-matter resource's `rlinks[0].href`
(`oscal-export.ts:322-328`). No per-evidence-item artifact href exists anywhere: `EvidenceItem`
(`collector.ts:46-59`) carries only `summary`/`facts`/`manualSlots`, no `href`. The real gap is
narrower and worse than "hosting a link": the AP document that URL points at **was never
authored** — ADR-0179 §B committed to "author + maintain the three AP stubs" and "Adds three
per-framework AP fixtures" (`ADR-0179…:24-26,36`), and `find`/`grep` across `packages/compliance`
returns zero `assessment-plan` JSON fixtures. So this is a **dead link Caisson ships in a product
it sells as compliance evidence**, and the content behind it does not exist.

Ship an **honestly resolvable** AP reference: author the 3 per-framework AP documents, package
them into a **signed evidence bundle exported alongside the SAR/POA&M** with the AP back-matter
`rlink` rewritten to a **relative path into that bundle** plus a SHA-256 `hashes[]` integrity
binding. Zero hosted service, zero new public route, zero new egress sink — reuse the Ed25519
signer + `canonicalize` + WORM store already in-repo. A buyer's GRC tooling (`oscal-cli
resolve-profile`, `viewer.oscal.io`) then resolves the reference relative to the doc's own
location — exactly as the OSCAL spec resolves relative URIs — with no Caisson URL to serve.

**Why now:** GRC consumers that resolve `import-ap`/back-matter refs (the "complete, self-contained
resolved document" path) hit a 404 today; ADR-0179's original rationale for the AP was precisely
"so the exported SAR is complete + importable without buyer wiring," which ADR-0208 reversed on
cost/priority, not on a finding the target is unneeded. The `oscal-conformance` job is now a
required branch-protection check (ADR-0208 §2) that passes only **because** constraint validation —
which would try to resolve the dead rlink — is deliberately disabled
(`--disable-constraint-validation`, `oscal-export-xml.ts`). Making the target real is the
prerequisite to ever proving resolution in that gate. The operator has explicitly asked for a
buildable story despite the won't-fix.

## Scope

**In:** author the 3 per-framework OSCAL v1.2.2 AP documents (SOC2 / HIPAA / EU-AI-Act) + golden
fixtures; a bundle assembler (SAR + POA&M + 3 APs + T13 manifest + its detached signature, laid out
relative, with `canonicalize`-stable SHA-256 per AP); an `OscalExportOptions.assessmentPlan?:
{ rlinkHref; sha256? }` emitter extension that rewrites the default back-matter `rlink` to a
caller-supplied relative href + `hashes[]`; reuse `signEvidencePack()` unchanged; update the 3
golden bundle fixtures off the dead absolute URL.

**Out:** a hosted Caisson service / public `/oscal/assessment-plan/*` route (the exact shape ADR-0208
§4 declined — Option 1 needs none); per-evidence-item artifact hosting (no such href exists in the
model — `collector.ts:46-59`); a FedRAMP 1.0.4 dual-target down-convert (out per ADR-0179 §A — open
a later ADR if a design-partner names it); the ADR-0181 attestation/dashboard wizard (a natural
future home for a buyer-facing bundle download, not pulled in here); flipping
`--disable-constraint-validation` **on** (a SWEEP-worthy follow-up and an ADR-0180 amendment, not a
task here); new DB tables / migrations (the export stays a pure function — ADR-0058 seam ethos).

## Design

**The open fork (operator locks — not pre-bound).** Both shapes are spec-legal and both require the
same un-skippable prerequisite: authoring the 3 AP documents (Task 2).

- **Option 1 — signed evidence bundle, relative rlinks, no hosted service (RECOMMENDED, medium
  confidence).** The export ships the OSCAL JSON/XML doc plus a co-located bundle containing the 3
  real per-framework AP JSON docs, the T13 evidence-pack manifest, and its detached Ed25519
  signature. The AP back-matter resource's `rlink.href` becomes a **relative path** into the bundle
  (e.g. `./assessment-plan/soc2-tsc.json`) with a `hashes[]` SHA-256 binding it to the exact bundled
  bytes. Zero new hosting surface, zero new egress sink (no `security-surfaces.md` row); reuses
  `sign.ts` + `canonicalize`, and the WORM `store.s3.ts` for durable archival if the buyer wants it
  — Caisson never serves the artifact. Precedent: the `evidentia` OSCAL tool signs its bundle,
  embeds hashed back-matter resources, and recommends WORM S3/Azure/GCS as the store — structurally
  identical to Caisson's own `store.s3.ts` + `sign.ts` primitives. **Sub-fork** (bundle wire format:
  sibling directory vs single `.tar`) — recommend a **sibling directory** (a `.tar` wrapper is a
  trivial later add); flagged, operator's call.
- **Option 2 — buyer-hosted static evidence directory convention.** Caisson documents (not code) a
  convention: the buyer publishes the AP at a URL of their choosing and supplies it via the
  **already-existing** `assessmentPlanHref` override (`oscal-export.ts:218-223`; when set, `import-ap`
  points at the buyer-hosted AP and no Caisson back-matter resource is emitted, `309-311`). Literally
  zero new export code, but still requires authoring the 3 AP documents and produces **no**
  Caisson-signed bundle — a weaker sell for a compliance product, pushing the "is it resolvable"
  burden onto the buyer.
- **Recommendation: Option 1.** Once both options must author the 3 APs, Option 1 is only marginally
  more code than Option 2 — packaging + a relative-path rewrite + hash stamping, each reusing an
  existing primitive — and it ships something honestly resolvable out of the box. Net-new code is a
  builder + one bundle module + AP fixtures.

**Shape (Option 1 — the recommended build).**

1. **AP builder** — `toOscalAssessmentPlan(framework)` emits a minimal-but-valid OSCAL v1.2.2
   `assessment-plan` document per framework, **deterministic** via the same injected-`now`/`newId`
   seam the SAR/POA&M mapper already uses (non-determinism would make `hashes[]` and goldens
   unstable). This is the never-authored content ADR-0179 §B promised.
2. **Bundle assembler** — a new pure function takes the SAR + POA&M + 3 AP docs + the T13 manifest +
   its signature, lays them out (`./assessment-plan/<framework>.json`, `./sar.json`, `./poam.json`,
   `./manifest.json`, `./manifest.sig`), computes `canonicalize`-stable SHA-256 over each AP's bytes,
   and produces the SAR with its AP `rlink.href` rewritten to the relative path +
   `hashes[]: [{ algorithm: "SHA-256", value: <hex> }]`.
3. **Emitter extension** — extend `OscalExportOptions` with a bounded `assessmentPlan?: { rlinkHref:
string; sha256?: string }` so the default back-matter resource emits a caller-supplied relative
   href + `hashes[]` instead of `caissonAssessmentPlanUrl()`. The existing `assessmentPlanHref`
   no-resource override (Option 2's seam) stays untouched.
4. **Signing** — reuse `signEvidencePack()` unchanged; the bundle carries the existing detached
   signature. No new crypto.

**Reused primitives (all in-repo, verified).** `canonicalize()` (`kernel/audit-chain.ts:66`,
ADR-0052 — the byte-stable JSON serializer the pack and every bundled AP run through);
`signEvidencePack()` (`sign.ts:210` — per-tenant Ed25519 detached signature over
`evidenceSignablePayload()`, live TSA still an un-wired P7 seam); the `packSha256` discipline
already stamped (`oscal-export.ts:245-256`). The durable archival target is
`packages/audit-worm/src/store.s3.ts` — a live S3 Object-Lock WORM store whose **design lineage** is
ADR-0054/0051 (store shape) + ADR-0052/TM-H (write-once WORM / chain-anchor) + ADR-0202 (monotonic
retention escalation); **ADR-0201 is the went-live lock that proved it against real infra, not the
store's design ADR.** It is buyer/tenant-scoped (write-once, retention-locked, per-tenant SSE-KMS),
never a public `caisson.sh` route — where a durable signed bundle lands if the buyer wants it.

**OSCAL semantics (load-bearing, verified).** Relative `rlink.href` is spec-legal — "a relative URI
will be resolved relative to the location of the document containing the link" (usnistgov/OSCAL
#1254; NIST OSCAL v1.2.2 assessment-results). `rlink` is preferred over inline `base64` (GSA FedRAMP
OSCAL attachment pattern) — bundle the AP as a sibling file, don't base64-inline it. `rlink.hashes[]`
(SHA-256) is the FedRAMP-recommended integrity binding — Caisson already has the SHA-256 discipline,
so extending it to the bundled AP is near-zero new mechanism.

**Current wiring (verified).** No route or handler in `apps/site` generates or serves an OSCAL
export — `grep` for the function names `toOscalBundle|generateEvidencePack` across `apps/site`
returns zero hits (the prose term "evidence-pack" appears there only in marketing copy, not in any
route/handler). No `assessment-plan` JSON fixture exists (`find`/`grep` zero). The export is a
library-level, golden-tested, un-wired seam exactly as its own doc comment states
(`oscal-export.ts:12-16`); `apps/compliance/lib/harness.ts:96-105` is an internal CI reference
harness (PGlite + `LocalArtifactStore`, refuses `NODE_ENV=production`), not buyer-facing.

## Tasks

1. **[BLOCKING, not code] Author + operator-lock the superseding ADR** (expected **ADR-0218**;
   check `main` first per ADR-0088). It must: (a) reverse ADR-0208 §4 won't-fix; (b) amend ADR-0179's
   locked `import-ap` resolution path (absolute `caisson.sh` URL → relative bundle path + `hashes[]`);
   (c) record the Option-1-vs-2 lock; (d) note "no `security-surfaces.md` row" for Option 1. Update
   `docs/state/decisions-and-forks.md`. **No product-code task below starts until this is locked.**
   Verify: `test -f knowledge/decisions/ADR-0218-*.md && grep -q 0218 docs/adr-index.md`.
2. **Author the 3 per-framework AP documents.** New
   `packages/compliance/src/evidence/oscal-assessment-plan.ts` (`toOscalAssessmentPlan`) + 3 golden
   fixtures `packages/compliance/src/__golden__/oscal-assessment-plan-{soc2,hipaa,eu-ai-act}.json`,
   deterministic (injected `now`/`newId`). Verify:
   `bun test packages/compliance/src/evidence/oscal-assessment-plan.test.ts`.
3. **AP conformance gate.** Extend the OSCAL round-trip so each AP JSON passes `oscal-cli validate`
   at v1.2.2 when `oscalCliAvailable()` (skip-if-absent per ADR-0180). Verify:
   `bun test packages/compliance/src/evidence/oscal-export-xml.test.ts`.
4. **Bundle assembler + relative-rlink rewrite + hash stamping.** New
   `packages/compliance/src/evidence/oscal-bundle.ts`; extend `OscalExportOptions` with
   `assessmentPlan?: { rlinkHref; sha256? }` in `oscal-export.ts`. Verify:
   `bun test packages/compliance/src/evidence/oscal-bundle.test.ts` (asserts the rlink is relative
   AND `hashes[0].value` equals SHA-256 of the bundled AP bytes).
5. **Wire the detached signature into the bundle.** Reuse `signEvidencePack()`; assert a sign/verify
   round-trip over the assembled bundle. Verify:
   `bun test packages/compliance/src/evidence/oscal-bundle.test.ts` (round-trip case).
6. **Update the 3 golden bundle fixtures** to assert the new relative `rlink.href` + `hashes[]` in
   place of the dead absolute URL. Verify:
   `bun test packages/compliance/src/evidence/oscal-export.test.ts`.
7. **Changeset + full gate.** Changeset naming `@caisson/compliance` (minor). Verify: `bun run check`
   green in `packages/compliance` && `bunx changeset status --since=origin/main`.

## Verify (goal-backward)

- The 3 per-framework AP documents **exist as real OSCAL v1.2.2 `assessment-plan` bodies** and each
  passes `oscal-cli validate` (when available) — closing the never-delivered ADR-0179 §B promise (the
  _content_ exists, not just a URL string).
- An exported SAR's AP back-matter `rlink.href` is a **relative path into the bundle** with a
  `hashes[]` SHA-256 that matches the exact bundled AP bytes — resolvable by `oscal-cli
resolve-profile` / `viewer.oscal.io` relative to the doc's own location, with **no Caisson URL
  served**.
- `grep -rn "caisson.sh/oscal/assessment-plan" packages/compliance/src` returns hits only in Option-2
  override docs/tests, never as the default emitted rlink.
- No new public route or egress sink → `identity/security-surfaces.md` unchanged (Option 1); a served
  sub-variant would require a same-commit row.
- The AP builder is deterministic (injected `now`/`newId`), so `hashes[]` and the goldens are stable.
- `bun run check` + `oscal-conformance` green; golden fixtures updated, not bypassed (constraint
  validation stays off — flipping it is a SWEEP follow-up / ADR-0180 amendment, not this SPEC).

## Effort: M (~1–2 days, dominated by authoring 3 valid OSCAL Assessment-Plan documents; the bundle/rewrite/hash/sign path is thin reuse of existing primitives). Value: MEDIUM — turns a dead link Caisson ships in a sold compliance product into an honestly-resolvable, signed, integrity-bound artifact and pays down the ADR-0179 §B content debt. Gated entirely on the Task-1 supersede lock.
