# ADR-0267 — Storage WORM driver family: GCS Bucket Lock + R2 bucket-locks

**Status:** accepted · 2026-07-06 (Kickoff F, `audit-worm` track — drafted by the build, subject to
the operator's normal reconcile-at-merge renumbering). Extends **ADR-0054** (the locked
`ArtifactStore` port) and **ADR-0201** (live-transports-go-live, which proved S3 as the sole live
WORM backend and rejected R2 at the time for having no Object Lock API). Relates **ADR-0051**
(GOVERNANCE/COMPLIANCE mode) and **ADR-0230** (launch retention posture). Append-only; supersede
with a later ADR, never edit. **Tags:** `infra`, `external-system`, `security`.

## Context

ADR-0201 evaluated S3-compatible stores against two hard invariants (a per-object retention API +
`If-None-Match` conditional writes) and rejected R2 outright: "Cloudflare R2 has no Object Lock
API." That was true of R2's **S3 API surface** at the time. Two things changed the calculus for this
track:

- **Cloudflare shipped R2 bucket locks** (2025-03, REST `PUT /accounts/{account}/r2/buckets/{bucket}/lock`)
  — a **bucket-level**, rule-based retention primitive (rules keyed by prefix, each with an `Age`,
  `Date`, or `Indefinite` condition) that prevents deletion/overwrite for the ruled duration. It is
  **not** S3 Object Lock: there is no per-object retention API, no `PutObjectRetention` equivalent,
  and no way to hand one object a bespoke `retainUntil` independent of the governing rule.
- **GCS Object Retention Lock** is a true per-object primitive (JSON API `retention: { mode,
retainUntilTime }` on the object resource, set at upload or via `objects.patch`) — a direct
  structural match for the `ArtifactStore` port, functionally parallel to S3 Object Lock
  (`Unlocked`/`Locked` mirror `GOVERNANCE`/`COMPLIANCE`).

The port's `retainUntil` is mandatory per-put and arbitrary (ADR-0054) — a bucket-wide policy that
expresses only one duration for the whole bucket cannot, by itself, honor a caller-chosen date
per object. The two vendors need two different strategies to honor the same port faithfully.

## Decision

1. **`GcsArtifactStore` (`store.gcs.ts`) uses per-object Object Retention Lock, not a bucket-level
   retention policy.** Object Retention Lock is the only GCS primitive that correctly honors an
   arbitrary per-put `retainUntil` (a bucket-level policy is a single fixed duration and cannot).
   Construction (an async factory, `GcsArtifactStore.create` — the port's constructor is sync
   everywhere else in this package, but verifying bucket capability requires I/O) reads the
   bucket's metadata and **fail-closed refuses** (`ConfigError`) unless
   `objectRetention.mode === "Enabled"`. `put` sets `retention.mode: "Unlocked"` (mirrors S3's
   GOVERNANCE default — bypassable by a privileged override, never COMPLIANCE-equivalent
   `"Locked"` from this driver, matching the ADR-0051 posture that no build-time path selects the
   irreversible mode) + `retainUntilTime` via a multipart insert with `ifGenerationMatch=0` (GCS's
   create-only precondition, the `IfNoneMatch:'*'` equivalent — a 412/409 becomes
   `ArtifactExistsError`). `extendRetention` mirrors S3's strictly-monotonic PATCH.
   Transport: hand-rolled REST over `fetchWithTimeout`, not `@google-cloud/storage`. The SDK's
   surface (and its transitive `gaxios`/`google-auth-library` weight) buys nothing this driver
   needs beyond four JSON-API calls; a service-account JWT-bearer OAuth exchange
   (RFC 7523) is ~40 lines of `node:crypto` (RS256 sign) + one `fetchWithTimeout` POST, with the
   same bounded, auditable, no-new-dependency posture as every other billing/webhook driver in
   this repo (`billing/src/polar.ts`, `paddle.ts`). The HTTP call itself is injected as a single
   `GcsSendable` function (attaches the bearer token), the same DI shape as `S3Sendable` — so CI
   never makes a live Google call; only the real transport
   (`createGcsServiceAccountTransport`) is un-exercised by design, the established seam-real
   precedent (ADR-0047 `field-crypto`'s `kms.ts`, `S3ArtifactStore`).

2. **`R2ArtifactStore` (`store.r2.ts`) splits data plane from retention plane.** R2's S3-compatible
   API (`@aws-sdk/client-s3`, reusing the `S3Sendable` DI seam verbatim) carries `put`/`get`/`head`
   — including the conditional `IfNoneMatch:'*'` write-once precondition R2 supports on its S3 API.
   It carries **no** `ObjectLockMode`/`ObjectLockRetainUntilDate` fields (R2 implements neither;
   `GetObjectLockConfiguration` is unimplemented and bucket creation has no
   `x-amz-bucket-object-lock-enabled`) — this driver never calls `PutObjectRetention` or
   `GetObjectRetentionCommand` against R2. Retention is instead enforced by a **bucket lock rule**
   (Cloudflare's REST `lock` endpoint, Bearer API-token auth, an injected `R2LockReader` read
   at construction — same async-factory pattern as GCS, same DI shape as `S3Sendable`).
   **Fail-closed bound (BINDING):**
   - At construction, the store's declared `keyPrefix` (default `""`, the whole bucket) must be
     covered by at least one **enabled** rule whose `prefix` is a prefix of `keyPrefix` — no
     covering rule at all is refused (`ConfigError`), never a store that silently writes
     unprotected objects.
   - Per `put`/`extendRetention`, the guaranteed horizon is computed from the best matching
     enabled rule for the actual key: `Indefinite` → unbounded; `Date` → the fixed date;
     `Age` → the reference time (the object's own creation time — "now" at `put`,
     the object's real `LastModified` at `head`/`get`/`extendRetention`) plus `maxAgeSeconds`.
     `retainUntil > horizon` throws (`ConfigError`) **before any write** — never silently
     under-retains by accepting a date the rule cannot back.
   - Because R2 offers **no per-object retention mechanism**, `extendRetention` can only ever
     succeed when the governing rule is `Indefinite` (any later date is still `<= Infinity`) or
     when the requested date is already within the existing rule-derived horizon and strictly
     later than what `head` currently reports — an `Age`/`Date` rule cannot grant one object more
     protection than the rule already provides, and the driver refuses (fail-closed) rather than
     pretend to. This is a real capability gap versus S3/GCS, documented here rather than papered
     over with a fake per-object extend.
   - `ArtifactMeta.retainUntil` from `get`/`head` reports the rule-derived guaranteed horizon
     (there is no true per-object stored value to read back), computed from the object's actual
     `LastModified`.

3. **Both drivers stay strictly inside the locked `ArtifactStore` port** — `put`/`get`/`head`/
   `extendRetention` only. Neither implements an S3-`escalateToCompliance`-equivalent; that
   feature is specific to S3 Object Lock's `GOVERNANCE`→`COMPLIANCE` hardening and out of scope
   for a first cut of two additional backends.

4. **Live-test convention (ADR-0201) applies unchanged:** `live/store.gcs.live.test.ts` and
   `live/store.r2.live.test.ts` join `live/store.s3.live.test.ts` — outside `./src`, run only via
   `test:live`, self-skip (`test.skipIf`) without their respective creds. `test:live` already runs
   `bun test ./live` (no script change needed; new files are picked up automatically).

## Rejected

- **`@google-cloud/storage` as a dependency for GCS** — the full client pulls in
  `google-auth-library` + `gaxios` + `teeny-request` for four REST calls this driver hand-rolls in
  ~150 lines; every other vendor integration in this repo (billing, email, GCS's own OAuth
  exchange) is a no-SDK `fetchWithTimeout` driver, and the SDK's opacity cuts against the
  audit-worm package's "prove the exact wire call" posture already established for S3.
- **Treating a GCS bucket-level retention policy as sufficient** — a single bucket-wide duration
  cannot express an arbitrary caller-chosen `retainUntil` per object; silently clamping every put
  to the policy's duration would be an unannounced under- or over-retention versus what the
  caller asked for. Object Retention Lock is required instead.
- **A fake per-object `extendRetention` for R2** — synthesizing success by writing an advisory
  value nobody enforces would be a silent under-retain the first time the "extended" object is
  actually challenged; the driver fails closed instead.

## Consequences

- `packages/audit-worm` gains two backends (`store.gcs.ts`, `store.r2.ts`), each with
  port-conformance + fail-closed-path unit tests (injected fakes, no live call) and a self-skipping
  `live/` proof (env + credential gated).
- `docs/build-state.md`'s WORM backend row gains two more selectable drivers behind the same
  `ArtifactStore` port; which backend a given deployment/edition uses is a separate, later
  operator choice — this ADR only proves the drivers are correct, not that any edition defaults
  to them.
- A future buyer wanting R2 for cost/egress reasons inherits the `extendRetention` capability gap
  above as a documented, not hidden, limitation.
