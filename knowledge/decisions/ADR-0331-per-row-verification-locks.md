# ADR-0331 — Per-row verification UI: anchor-aware states, redaction honesty, proof-endpoint auth contract

Status: accepted · 2026-07-13 (product-SPEC design session + adversarial audit round + operator
re-lock, same day. Locks the forks of `outputs/specs/per-row-verification-ui/SPEC.md`.)

The per-row tamperproof verification UI turns audit-worm's existing per-length WORM anchors
(`anchor(i+1).tipHash === row.hash` — minted on every append since ADR-0052) into visible per-row
proof. The 2026-07-13 design locks were challenged by the adversarial round (CR-04/CR-06/CR-07):
redacted rows cannot satisfy "verified locally" (the client cannot recompute a hash over a payload
it never receives), the proof-bundle endpoint had no authorization contract, and a hash chain has
no compact per-row EXTERNAL inclusion proof. The operator accepted all four amendments.

## Decision

- **State model:** `verified` · `tampered` · `unverifiable` · `pending` · `genesis` · **plus
  `anchor-confirmed-original-not-disclosed`** for redacted rows — the per-length anchor check
  confirms the stored hash, but the local-verification seal is NEVER rendered for a row whose
  original payload the client cannot recompute. The "verified locally" vs server-asserted
  provenance distinction is DELIBERATE v1 scope (formerly a deferred fork-b option, now
  un-smuggled into the state chips and receipts).
- **Proof-bundle endpoint auth contract:** `accountId` derives exclusively from the authenticated
  session; `seq` is a strict bounded row sequence; the WORM anchor key is constructed server-side
  (`assertSafeKey` discipline — no client-supplied keys); responses are Zod-strict; cross-tenant
  denial and missing-anchor fail-closed behavior are required tests (the `identity/security.md`
  route-auth floor).
- **Receipts:** carry versioned RAW proof material; `checks`/`verifiedAt` are derived, untrusted
  display fields; the standalone verifier recomputes every assertion it can and never trusts an
  embedded verdict.
- **External status renders at chain/checkpoint level in v1** — a Merkle commitment for compact
  per-row external proofs is a written future fork; budgeted prefix replay is the recorded
  alternative.
- Fork record: a = per-row anchor-aware via the existing per-length anchors (no schema change) ·
  b = client re-runs the pure kernel checks over a server-shipped proof bundle (WebCrypto async
  hash helper), with the deliberate verified-locally distinction · c = UI + evidence-pack receipts
  - standalone verifier + site demo, demo sequenced after product surfaces · d = pure check
    helpers open in Apache-2.0 `kernel`, UI commercial · e = honest marking + the
    `anchor-confirmed-original-not-disclosed` state; dual-hash reconsidered only if auditors reject
    it · f = anchor fetch on proof-panel open.
- **Motion sequencing gates:** the Living Chain moment consumes this spec's state vocabulary (or
  stays swap-ready); Seal-on-Proof fires on a `verified` state that does not exist until this
  ships and targets `apps/admin`, outside the motion kickoff's scope — gated accordingly.

## Rejected

- **Rendering the local-verification seal on redacted rows** — honest prose cannot fix a state
  model that claims client-recomputability the client does not have (CR-06).
- **Client-supplied account ids or WORM keys on the proof endpoint** — an IDOR/path boundary the
  security floor forbids (CR-07).
- **Claiming per-row EXTERNAL anchoring on the hash chain** — no compact inclusion proof exists
  without a Merkle structure the design deliberately rejected (CR-04); chain-level honesty instead.

## Binding

The six-state model above ships as specified; no state chip or receipt over-claims recomputability
or external inclusion; the proof endpoint implements the full auth contract with cross-tenant
denial tests before any UI consumes it; kernel check helpers stay Apache-2.0 while surfaces stay
commercial; the site demo and both motion moments wait for the product surfaces and the state
vocabulary. Evidence: `outputs/specs/per-row-verification-ui/SPEC.md` (amended 2026-07-13);
`outputs/audit/AUDIT-SYNTHESIS-2026-07-13.md` §B;
`outputs/reviews/codex-adversarial-review-2026-07-13.md` CR-04/CR-06/CR-07; ADR-0052 (per-append
anchors); ADR-0054 (WORM ArtifactStore); ADR-0094 (open-core split); ADR-0250 (ChainViewer).
