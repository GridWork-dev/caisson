# ADR-0058 — Evidence-pack output format, determinism, and flag-never-guess

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Pins the shape, byte-stability,
and integrity model of P2's single largest net-new build — the compliance evidence-pack generator.)

P2 (the Compliance hero) is mostly Wave-0 wiring, but the control-evidence-pack generator is net-new
(Wardfile has no generic one to harvest). ADR-0006 says "signed ZIP" and "unresolved flags block
generation" but leaves the artifact shape, its determinism story, and the gap-gate undecided — and
ADR-0006/0013 require golden-file regression BEFORE any evidence logic, so these forks gate the
fixtures that gate the generator. This ADR locks all three.

## Decision

- **Output format.** The generator emits a typed artifact: a canonical `manifest.json` indexing
  **control → bound evidence** (the deterministic core) + per-control evidence (JSON) + a generated
  auditor summary. This is exactly ADR-0006's "signed bundle" shape, golden-pinnable, the lighter
  vendor-neutral bundle the market is converging on — **the net-new P2 generator under ADR-0006/0013,
  golden-file-before-logic**: the format + determinism land as blessed golden fixtures BEFORE any
  evidence-collection logic ships.
- **OSCAL interop seam.** v1 emits the vendor-neutral bundle; an OSCAL SAR/POA&M **EXPORT adapter
  ships as an un-wired, seam-tested boundary** (the `kms.ts`/ADR-0047 ethos), reserved as a
  Compliance-Updates subscription upsell — interop onto the roadmap without v1 spec weight.
- **Determinism.** The canonical golden representation **excludes real timestamps and signatures**:
  the clock is injected at the edge, the signature is a separate non-golden layer (ADR-0058 does not
  decide the signing scheme — that is the operator-gated ADR amending ADR-0006), and both are
  asserted in their own tests. The pack body is canonicalized via `kernel/src/audit-chain.ts`
  `canonicalize` (recursive key-sort) so it is **byte-stable for golden-file regression** (ADR-0013,
  `BLESS=1`) and chain-anchorable.
- **Flag-never-guess.** Per-evidence status. When a control's evidence is missing or ambiguous the
  generator **FLAGS a gap** — an explicit `evidence not found / manual attestation required` item —
  and never fabricates or infers compliance. **UNRESOLVED hard-blocks generation** (throws, no
  partial pack ever written, mirroring `versioning.ts` throw-not-guess); **FLAGGED** requires a
  recorded resolution reason captured into pack provenance (Wardfile Tier-2). Ship a golden fixture
  of the BLOCKED case.
- **Public-language guardrail.** Generated pack text — and the apps/site + docs copy around it — uses
  **readiness / posture / controls** language, never "compliant / certified"; a flagged pack emits a
  gap/POA&M item, never a green claim (dovetails ADR-0040's compliance voice).

## Rejected

- **Embedding live timestamps/signatures in the golden body** — defeats determinism. Clocks,
  randomness, and signature bytes are non-deterministic and break byte-stability, the exact thing
  ADR-0013's golden inputs forbid; the timestamp is injected and the signature is pinned (if at all)
  as a separate layer, never inside the canonical body.
- **Silent best-effort evidence inference** — a compliance-integrity violation: a fabricated or
  inferred control status is a false attestation. The generator flags, it does not guess.
- **OSCAL-native (SAR/POA&M) as the v1 artifact** — speaks-auditor-natively but heavyweight and
  FedRAMP-shaped, more than a SOC2/HIPAA SMB buyer needs day one. OSCAL stays an export seam, not the
  v1 spine.

## Binding

The evidence pack is a deterministic **control → evidence** artifact whose canonical body (manifest +
per-control evidence) excludes timestamps and signatures and is byte-stable under the golden harness;
any non-deterministic input is injected at the edge and asserted separately. The generator **FLAGS,
never guesses** — missing or ambiguous evidence yields an explicit gap, any unresolved flag
hard-blocks generation (no partial pack), and no generated text or surrounding copy claims
certification. OSCAL export exists only as an un-wired seam in v1. Future evidence-engine code and
agents MUST honor all four invariants; the golden fixtures (including the BLOCKED case) land before
the generator logic. Evidence: ADR-0006:19 ("signed ZIP") + :25 (unresolved flags block generation,
golden before evidence logic); ADR-0013 (golden harness, `BLESS=1`); ADR-0046:23 (JSON = the golden
representation); ADR-0040 (entitlement-scoped framework modules; readiness/posture compliance voice;
Vanta/Drata interop); `kernel/src/audit-chain.ts:42-68` (`canonicalize` already shipped);
`kernel/src/versioning.ts:6-8` (throws not guesses); Wardfile flag engine + `report-version.ts`
resolved-flag provenance; `outputs/research/wave1-forks.md` (P2-14/P2-15/P2-17/P2-23).
