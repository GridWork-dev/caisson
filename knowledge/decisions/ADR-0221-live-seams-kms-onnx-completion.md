# ADR-0221 — live seams: cloud-KMS envelope proof + ONNX on-device disposition

**Status:** accepted · 2026-07-02 (deferred-respec picker round, operator-locked).
**Relates:** SPECs `outputs/specs/deferred-respec/SPEC-live-seam-kms-envelope.md` +
`SPEC-local-ai-onnx-live-seam.md` (the locked drafts) · **extends ADR-0201** (adds cloud KMS as a
4th live transport under the identical `live/` + `skipIf` convention; resolves §3's
availability-gated ONNX bet) · ADR-0045/0171 (field-crypto envelope + per-tenant CMK) · ADR-0215
(guardrails egress gate — the shared `EgressGuard` the ONNX backend now routes through).

## Context

field-crypto's KMS envelope path and local-ai's ONNX embedding backend are both fully implemented
but unproven against their real external surfaces. ADR-0201 proved three live transports and left
these two seams open.

## Decision (five forks across the two seams, operator-locked)

**KMS (field-crypto):**

- **KMS-1 = A1:** one shared "live-proof prover" principal — the KMS statements join the existing
  WORM prover's policy (tag-scoped, least-privilege per statement); no second credential to mint
  and rotate.
- **KMS-2 = B2:** the provisioner is **print-only**; the live test self-provisions throwaway CMKs.
  The persistent production default CMK is deferred to first-customer time — no idle speculative
  resource.

**ONNX (local-ai):**

- **G1 = A:** the operator signs off (recorded here) that a **never-committed throwaway install**
  of the reference embedding dependency for the proof run is a permitted carve-out from
  ADR-0201's rejected-dependency clause. Nothing lands in `package.json` or the lockfile.
- **F1 = A:** on a green proof, flip `docs/build-state.md` + `docs/state/readiness-and-backlog.md`
  only — no further ADR; ADR-0201 (as extended here) governs the bet.
- **F2 = B (operator override of the spec recommendation):** the T14 unification lands in-slice —
  the ONNX backend's inline `#guardedFetch` is replaced by the shared `EgressGuard`
  (`model-fetch` sink kind) with a new guard test leg. This touches shipped security-sensitive
  code and therefore carries the `security` tag → full audit at SHIP.

## Rejected

- **A2 dedicated KMS prover** — tighter per-identity blast radius not worth a second credential
  lifecycle at this scale.
- **B1 persistent CMK now** — ~$1/mo idle spend for a row-closure the print-only path defers
  without risk.
- **F2 = A (defer the guard unification)** — the spec's recommendation; the operator chose to
  close T14 now and pay the re-audit.
