# ADR-0332 — External anchoring: trust-grade split, durable outbox, TSA v1 + Rekor v1.1

Status: accepted · 2026-07-13 (product-SPEC design session + adversarial audit round + operator
re-lock, same day. Locks the forks of `outputs/specs/external-anchoring/SPEC.md`; extends
ADR-0052/0056's reserved premium-provenance seam.)

External anchoring publishes audit-chain anchor checkpoints (`length`/`tipHash`/`genesisHash` —
hashes only, no payload) into logs outside the buyer's trust domain. The 2026-07-13 design locks
were challenged by the adversarial round (CR-01/02/03/16): TSA-default-on cannot deliver the
"outside parties detect rewrite" claim (a receipt in the buyer's own store does not defeat a
receipt-destroying insider — and ADR-0056 already RFC-3161-countersigns evidence packs), the
Rekor v2 port as sketched could not submit a valid entry (hashedrekord needs digest + signature +
verifier material, SigningConfig/TUF/shard handling), and the submit-then-persist job ordering
could irrecoverably lose receipts (Rekor v2 removed online proof retrieval). The operator
re-locked the same day.

## Decision

- **Trust grades split (the load-bearing lock):** `trusted-timestamped` (RFC-3161 TSA, private
  receipt; honest weaker claim, positioned against — not duplicating — the ADR-0056 pack
  countersignature) vs `externally-transparent` (public log — Rekor/OTS — behind a typed opt-in
  consent to irrevocable publicity; the ONLY grade whose receipts let outside parties detect
  rewrite). The sellable "even a root-privileged insider can't rewrite history without it being
  provable" line attaches only to `externally-transparent`; TSA-only deployments are never
  marketed as transparency anchoring.
- **v1 =** the pluggable `ExternalAnchorLog` port + TSA default-on under the honest weaker claim
  - the **durable outbox** — keyed `(accountId, target, anchorLength, anchorDigest)`, states
    `pending/submitted/receipted/failed`, persisted BEFORE egress; response loss resolves to an
    operator-reconciliation state, never blind duplicate public retries — + `verifyExternal`
    checking receipt existence and receipted-anchor-bytes ≡ WORM anchor.
- **Rekor ships v1.1 after a protocol spike** (signed submission shape, SigningConfig discovery,
  TUF trust roots, rotating shards, checkpoint verification, per-tenant Ed25519 signer binding);
  offline inclusion-proof verification rides the Rekor leg. The "one module ≈ sign.ts" estimate is
  retired — the tiles client is the bulk of the work.
- **Job ownership:** the scheduled anchoring handler registers from the commercial composition
  package (`packages/compliance`) or lives inside `audit-worm`; Apache-2.0 `packages/jobs` keeps
  only generic scheduling ports (ADR-0094 dependency direction).
- **Per-row honesty:** external status is chain/checkpoint-level; the hash chain has no compact
  per-row external inclusion proof (sibling ADR-0331 owns the rendering rule and the Merkle
  future fork).
- Fork record: A = pluggable port, TSA v1 / Rekor flagship v1.1 post-spike · B = periodic daily
  (configurable, hourly floor) + on-evidence-pack, never in the append path · C = buyer-configured
  direct to public-good instances, defaults included; private-Rekor deployment guide docs-only;
  caisson relay deferred until a buyer asks · D = TSA default-on under the honest weaker claim,
  public logs strictly typed opt-in · E = v1 `verifyExternal` = receipt existence + anchor-byte
  match; offline inclusion-proof verify lands with Rekor v1.1 and the UI must not over-render the
  interim state · F = the feature is named "external anchoring", target-agnostic.

## Rejected

- **Both targets + offline-verify in v1** (original A/E locks) — 2–3× the effort sketch on an
  unproven protocol surface; the spike-then-v1.1 sequence keeps the claim only as strong as its
  verification without gating the TSA tier (WR-10 vertical-slice discipline).
- **Marketing TSA receipts as external transparency** — the receipt lives in the trust domain it
  is supposed to check (CR-03).
- **Submit-before-persist job ordering** — loses the only verification bundle on a crash window
  (CR-02).
- **Anchoring handler in `packages/jobs`** — open-package upward dependency on commercial
  audit-worm (CR-16, ADR-0094).

## Binding

No egress happens before an outbox row exists; every receipt is written back to the tenant's WORM
prefix under the existing key discipline; the two trust grades are never conflated in code, UI, or
copy; public-log submission requires the typed irreversible-publicity consent (ADR-0051 pattern);
new egress sinks land in the buyer security docs and (for caisson's own deployment) gridwork's
`identity/security-surfaces.md` in the same change; Rekor work starts with the protocol spike, not
PLAN. Evidence: `outputs/specs/external-anchoring/SPEC.md` (amended 2026-07-13);
`outputs/audit/AUDIT-SYNTHESIS-2026-07-13.md` §B;
`outputs/reviews/codex-adversarial-review-2026-07-13.md` CR-01/02/03/16; ADR-0052 (premium seam);
ADR-0056 (RFC-3161 countersign); ADR-0051 (irreversible opt-in); ADR-0094 (dependency direction).
