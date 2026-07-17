# ADR-0353 — External anchoring v1.1 Rekor leg: execution locks

Status: accepted · 2026-07-17 (Kickoff-U Lane 1 build, CAISSON-115, PR #251; extends
ADR-0332/0346. Locks recorded from the R1 de-risk evidence + operator picker rounds; filed at the
reconcile sitting per the ADR-0328 wave convention.)

## Decision

1. **Fork R-β → HAND-ROLL** (evidence-resolved by R1, not taste). `@sigstore/sign@5` exposes no
   v2 self-managed-key submit surface and `@sigstore/verify@4.1` only TUF-rooted bundle
   verification; the self-contained-receipt design (embedded checkpoint key, no TUF freshness)
   discards exactly what those libs provide. The hand-rolled RFC-6962 §2.1.1 inclusion +
   C2SP signed-note checkpoint verify (~90 lines, proven against a golden fixture) is new code —
   `kernel/audit-chain.ts` is a prevHash list, not a Merkle tree — and avoids a Node-targeted
   dependency tree on a sold package. `@sigstore/*` NOT adopted; `@noble/curves` added to
   signing-primitive only; audit-worm's offline verify stays on `node:crypto`.
2. **Fork R-α confirmed in code** — a deployment-level `Ed25519PhSigner` (env
   `CAISSON_REKOR_ANCHORING_KEY`, base64 raw 32-byte seed; distinct name from audit-worm's
   `Ed25519AnchorSigner`). ed25519ph interop proven live from Bun against the public v2 shard
   (HTTP 201, logIndex 27980982); the ADR-0346 ECDSA-P256 fallback stays unused. `log2025-1` is
   never hardcoded in source (fixtures/config only — grep-asserted in test).
3. **Fork R-γ** — `OpenTimestampsAnchorLog` shipped as minimal submit-leg code + stub behind the
   same `TransparencyLog` port; OTS offline verify is a documented Bitcoin-header seam, so
   `verifyExternal` fails closed honestly for an OTS target (never claims a grade it can't prove).
4. **Self-contained receipt (spike decision) implemented** — the WORM receipt embeds the
   checkpoint, inclusion proof, log checkpoint-signing key, and origin; verify enforces no TUF
   freshness, so stored receipts survive shard turndown.
5. **Fork D** — a branded `IrreversiblePublicityOptIn` (mirroring the ADR-0051
   COMPLIANCE-acknowledgement pattern, runtime-checked) gates every public-log submission; TSA
   stays the default; the inert `CAISSON_ANCHOR_TARGET` seam in services/license refuses a
   non-TSA selection it cannot wire. **The ADR-0346 arming trio stays operator-gated — nothing
   armed by this leg.**

## Follow-ups

- `ANCHOR_OUTBOX_SCHEMA_SQL` re-export from `services/license/src/index.ts` — DONE in the same
  wave (reconcile session, on the PR #251 branch), beside the other `*_SCHEMA_SQL` provisioning
  constants.
- gridwork `identity/security-surfaces.md` egress rows for `*.rekor.sigstore.dev` +
  `tuf-repo-cdn.sigstore.dev` (+ OTS calendars) land when the public-log sink is ARMED — cross-repo,
  deferred with the arming act.
- The fixture `trusted_root.json` refreshes on the pinned-registry sweep cadence; stored-receipt
  verify is freshness-independent by design.

## Rejected

- **Adopting `@sigstore/*` as dependencies** — no usable v2 self-managed-key surface, and the
  TUF-bundle machinery is exactly what the self-contained receipt discards.
- **Per-tenant signer binding** — already superseded at the mechanics level by ADR-0346 Fork R-α;
  the build confirms the deployment-key model end to end.
