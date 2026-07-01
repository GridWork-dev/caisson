# SPEC — Edition Seam-Completion · OSCAL export

> **LOCKED DECISIONS (2026-07-01).** The three forks that blocked this build are now operator-locked:
> **ADR-0179** — emit `oscal-version` **v1.2.2** + ship a canonical per-framework Assessment-Plan (AP)
> fragment so `import-ap` resolves. **ADR-0180** — **JSON primary + an oscal-cli-driven XML converter**
> output path (NIST `oscal_<model>_json-to-xml` XSLT via `oscal-cli convert`, XML first-class alongside
> JSON; Java/Docker `oscal-cli` dep in the export tooling, not the core lib runtime; CI JSON→XML→validate
> round-trip). **ADR-0181** — **all three frameworks** (SOC2 + HIPAA + EU-AI-Act) get a
> validate-conformant export now; ADD the HIPAA `substrate.field-crypto-policy` PHI collector + the
> EU-AI-Act risk-register traversal collector; fill `manualSlots[]` via a **full dashboard attestation
> wizard** in `apps/site` (not the thin API). Build against these; the "Open design forks" section below is
> historical.

Act 1 (SPEC) of the 7-act cycle for the **OSCAL export** seam of the EDITION SEAM-COMPLETION
initiative. Process = BATCH SPECS THEN BUILD: this doc is buildable but blocked on the open forks
below (ADR-0179 / ADR-0180 / ADR-0181), which the operator locks first. Grounded in the OSCAL seam
recon (`packages/compliance/src/evidence/oscal-export.ts`, 430 LOC, T15 / ADR-0058) + the OSCAL
research brief (NIST v1.2.2, FedRAMP 1.0.4 pin). Bound by ADR-0057 (crosswalk licensing floor),
ADR-0058 (evidence-pack determinism), ADR-0047 (un-wired-seam ethos) — do not relitigate.

## Goal

Turn the pure, deterministic, un-wired OSCAL export adapter into a **verifiable, schema-conformant,
optionally-delivered** compliance artifact. WHY: the SAR + POA&M mapping is production code and
byte-stable (12 tests green), but it (a) is never validated against the real NIST OSCAL JSON schema —
so "conformant" is asserted, not proven; (b) has no live delivery path to a buyer's GRC tool; and (c)
carries several un-decided modelling forks (version, catalog binding, XML) that block a buyer from
importing the artifact into FedRAMP/GRC tooling. This seam converts "we emit an OSCAL-shaped object"
into "we emit an artifact NIST's own `oscal-cli validate` accepts, and a buyer can consume." VERIFY
re-asks: **does an exported SAR + POA&M pass `oscal-cli validate` at the locked version, and does the
UUID/last-modified discipline let a GRC tool treat a re-export as a new document version?**

## Tags

`compliance` · `ai` (evidence collectors read AI-config risk store) · `external-system` (transport
`deliver()` POST to a buyer GRC endpoint — dormant/config-gated, no live CI call) · `security` (Bearer
on transport; signature-over-OSCAL decision). Drives SHIP audits: **SECURITY** (transport auth +
signature scope) · **EVAL** (collector-construction golden tests, no eval-runner dataset). The
`external-system` transport re-enters the operator at SHIP.

## Open design forks (BLOCK build — operator locks first)

1. **ADR-0179 — OSCAL version + catalog binding (LOCKED).** Emit `oscal-version` **1.2.2** (latest
   stable) + ship a Caisson canonical **per-framework Assessment Plan fragment** so `import-ap` resolves.
2. **ADR-0180 — output format (LOCKED).** **JSON primary + an `oscal-cli`-driven XML converter** path
   (NIST `oscal_<model>_json-to-xml` XSLT); Java/Docker `oscal-cli` dep lives in export tooling + CI
   JSON→XML→validate round-trip. Never hand-rolled.
3. **ADR-0181 — collector + framework scope + attestation (LOCKED).** **All 3 frameworks**
   (SOC2/HIPAA/EU-AI-Act) get a validate-conformant export now; add the HIPAA `field-crypto` PHI-encryption
   collector + the EU-AI-Act risk-register traversal; fill `manualSlots[]` via the **full dashboard
   attestation wizard** in `apps/site`.

## Scope (post-lock — the buildable set)

**T-OSCAL-1 — schema conformance gate (always, regardless of forks):**

- Pull `oscal_assessment-results_schema.json` + `oscal_plan-of-action-and-milestones_schema.json` for
  the locked version from the NIST release assets; run `json-schema-to-typescript` to derive typed
  interfaces (reconcile against the existing hand-typed `OscalObservation`/`OscalFinding`/`OscalPoamItem`).
- Add a CI test that runs `oscal-cli validate` (Java, `ghcr.io/metaschema-framework/oscal-cli` Docker
  image) against a golden exported bundle — the ground-truth conformance check the recon calls out as
  NOT MODELED (Zod alone misses OSCAL Metaschema _constraints_). This is the one non-negotiable task.

**T-OSCAL-2 — UUID + last-modified discipline (per research pitfall #1):**

- Regenerate the document-root `uuid` + bump `metadata.last-modified` on every export whose content
  changed; hold observation/risk/finding UUIDs stable across a SAR→POA&M pair so POA&M
  `related-observations` are cross-document UUID references, not re-serialized copies (research §6).
- Test: two exports of the same pack → identical doc UUID + last-modified (byte-stable); a changed pack
  → new doc UUID + bumped last-modified.

**T-OSCAL-3 — version + catalog binding (gated on ADR-0179):**

- Emit the locked `oscal-version`; if compat-mode is locked, `oscal-version` carries 1.0.4 and the
  validate gate runs the 1.0.4 schema too.
- Resolve `import-ap` per the lock (ship a canonical AP fragment per framework, or keep the overridable
  local fragment). Register the Caisson prop namespace explicitly (`https://caisson.sh/ns/oscal`) — never
  omit `ns` on a non-core prop (research pitfall #4).

**T-OSCAL-4 — XML converter path (ADR-0180, first-class output):**

- Add an `oscal-cli convert` step for XML output alongside JSON; run NIST's canonical
  `oscal_<model>_json-to-xml` XSLT — do NOT hand-roll it (research pitfall #7). The Java/Docker `oscal-cli`
  dependency lives in the export tooling + CI, never the core lib runtime.
- CI round-trip gate: JSON → XML (`oscal-cli convert`) → `oscal-cli validate` at the locked version passes.

**T-OSCAL-5 — collectors + attestation (gated on ADR-0181):**

- If HIPAA field-crypto collector is locked: add `substrate.field-crypto-policy` collector reading
  `@caisson/field-crypto` tenant encryption scope (mirrors the 3 existing framework-agnostic collectors).
- If EU-AI-Act risk-register is in scope: collector traversing the `ai-config` risk store.
- Attestation: wire `manualSlots[]` fill per the locked mechanism (endpoint / UI / GRC import).

**T-OSCAL-6 — transport (optional, `external-system`, config-gated, no live CI):**

- Implement `OscalExportTransport.deliver()` — `fetchWithTimeout` (never native `AbortSignal.timeout`),
  Bearer-gated, validate against the schema before POST. Stays dormant behind config; test with a fake
  transport double. Live TSA (RFC-3161) + live GRC POST remain deploy-time seams.

**OUT OF SCOPE (stays seam):** live RFC-3161 TSA call; live GRC endpoint provisioning; SSP model
(`import-ssp`); POA&M milestone/target-date/responsible-party tracking (GRC tools add these client-side).

## Verify commands

```bash
bun test packages/compliance/src/evidence/oscal-export.test.ts   # existing 12 + new determinism
bun run --filter @caisson/compliance check
# conformance gate (Docker, CI):
docker run --rm -v "$PWD/fixtures:/w" ghcr.io/metaschema-framework/oscal-cli \
  validate /w/oscal-sar.golden.json    # exit 0 = NIST-conformant at locked version
```

## Failure modes

`oscal-cli validate` fails on a Metaschema constraint the Zod schema passed → the constraint is the
authority, fix the emitter. Re-export reuses a doc UUID → GRC tool silently treats it as the same
immutable document (research pitfall #1) → the T-OSCAL-2 test must fail first. Crosswalk copies external
framework text → ADR-0057 licensing-floor violation, keep opaque `reference` strings only.
