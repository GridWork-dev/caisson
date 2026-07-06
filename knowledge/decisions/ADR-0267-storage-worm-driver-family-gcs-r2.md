# ADR-0267 — Storage WORM driver family: GCS retention lock + R2 bucket-locks, fail-closed retention mapping

**Status:** accepted · 2026-07-06 (Kickoff-F picker round 4, dx-demos-compat session;
operator custom answer — both drivers). One ADR per port-family. Corrects the
adapter-expansion premise that R2 is a "~trivial S3-compat reuse" — **R2 does not support
S3 Object Lock** (Cloudflare's own S3-compatibility docs; independently verified).
`ArtifactStore` stays a WORM-contract port: `retainUntil` is mandatory on every put and
audit-worm is its only consumer. Port contract unchanged (ADR-0003/0108). Append-only.
**Tags:** security (WORM/compliance guarantee), external-system (GCS/Cloudflare creds).

## Decision

1. **GCS driver:** `ArtifactStore` over Google Cloud Storage retention lock — a sibling
   driver beside `store.s3.ts`, same conformance surface. **Build correction (same
   session, pre-merge):** the picker-round text named bucket-level "Bucket Lock", but a
   bucket-level retention policy is a single fixed duration and cannot honor the port's
   per-put `retainUntil`; the driver therefore uses **per-object Object Retention Lock**
   (also a real WORM primitive) and fail-closed refuses at construction unless the
   bucket's `objectRetention.mode === "Enabled"`. Transport is hand-rolled JSON-API REST
   over `fetchWithTimeout` (four calls + an RFC 7523 JWT-bearer OAuth exchange), matching
   the repo's no-SDK vendor-driver precedent — the SDK clause was mechanics, build-owned.
2. **R2 driver, built on Cloudflare's bucket-locks API** (operator pick) — NOT the S3
   Object-Lock calls R2 lacks (the S3-compatible data plane is reused; the retention
   plane is the bucket-locks REST API). Because R2's retention is bucket/prefix-scoped
   while the port's `retainUntil` is per-put, the driver is bound fail-closed: **it must
   verify at construction (and per put) that the governing bucket-lock rule satisfies the
   requested `retainUntil`, and throw when it cannot — never silently under-retain.** The
   concrete mapping mechanics (rule discovery, horizon checks) are build-owned inside
   that bound.
3. Both drivers ship port-conformance + round-trip tests, `live/` self-skipping proofs, and
   ADR-0265 checklist rows (GCS + Cloudflare creds are operator-provisioned).

Rejected: **naive R2-as-S3-endpoint driver** (silent compliance regression — drops the
retention guarantee); **dropping storage expansion** (the tabled rec; operator chose to
build both correctly instead); **weakening the port** (making `retainUntil` optional is a
port-contract fork, forbidden without its own lock).

## Consequences

- The WORM guarantee is never weakened by breadth: any backend that cannot honor a
  requested retention throws — buyers get fewer storage choices for WORM artifacts than
  for generic blobs, by design.
- **R2 carries a real capability gap versus S3/GCS:** with no per-object retention
  mechanism, `extendRetention` can only succeed when the governing rule is `Indefinite` —
  an `Age`/`Date` rule cannot grant one object more protection than the rule already
  guarantees, and the driver refuses rather than fake success. Product-relevant before
  offering R2 as a customer-facing WORM option.
- Two new vendor surfaces enter the dependency + creds ledger (both REST via
  `fetchWithTimeout`; no new SDK dependency).
- `adapter-expansion.md`'s storage row is rewritten against this ADR (see ADR-0265 item 3).
