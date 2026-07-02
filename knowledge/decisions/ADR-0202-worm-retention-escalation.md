# ADR-0202 — WORM retention escalation: extend-only retention + gated COMPLIANCE escalation, chain-evidenced

**Status:** accepted · 2026-07-01 (editions-go-live session, operator picker — pulled forward from the
LIFT slice-2 queue, Wardfile B2). **Extends ADR-0051** (GOVERNANCE default + typed COMPLIANCE opt-in)
and **ADR-0054** (ArtifactStore port + retention floor); composes **ADR-0052** (audit chain).
Wardfile's GOVERNANCE-now/COMPLIANCE-at-escalation pattern informs the seam — patterns only, no
implementation carried. Append-only; supersede with a later ADR, never edit. **Tags:** `security`,
`infra`.

## Context

ADR-0051 locked the retention MODE surface (GOVERNANCE default, per-evidence-class COMPLIANCE behind a
typed irreversible opt-in) but the store can only set retention **at write time**. A compliance buyer's
evidence lifecycle needs the second half — the escalation path: extending an existing artifact's
retain-until (litigation hold, reclassification) and escalating an existing object's mode
GOVERNANCE→COMPLIANCE — without ever weakening a lock. S3 permits both: `PutObjectRetention` may set a
LATER `RetainUntilDate` in either mode and may switch GOVERNANCE→COMPLIANCE, while COMPLIANCE can never
be shortened or reversed by anyone including root. The LIFT slice-plan queued this as slice-2
front-of-wave ("Compliance evidence-retention gate"); the editions-go-live picker pulled it forward
into the same audit-worm tree as the ADR-0201 S3 work.

## Decision

`@caisson/audit-worm` gains a **retention-escalation surface — strictly monotonic, fail-closed,
chain-evidenced**:

- **`extendRetention(key, newRetainUntil)` on the `ArtifactStore` port.** Extend-only: the store reads
  the object's current retention and REFUSES any date not strictly later (fail-closed
  `ValidationError` — never silently clamps, mirroring the ADR-0054 floor). `S3ArtifactStore` issues
  `PutObjectRetention` preserving the store's mode; `LocalArtifactStore` records the new date but (per
  ADR-0054) enforces nothing — never court-admissible.
- **Mode escalation GOVERNANCE→COMPLIANCE on an existing object** rides the SAME three-belt gate as
  write-time COMPLIANCE (ADR-0051): a typed `irreversibleComplianceOptIn` naming the bucket, never
  under a test runner, never outside `NODE_ENV === "production"`. No path de-escalates; COMPLIANCE→
  GOVERNANCE does not exist in the port.
- **Every escalation is itself evidence:** the escalation helper appends a
  `{ kind: "retention.escalated", key, from, to, mode }` record to the tenant's audit chain
  (`AuditChainStore`, ADR-0052) in the same call — an unrecorded retention change is a failed
  escalation (sink-throws ⇒ operation fails), so the evidence-retention gate is provable from the
  chain + `GetObjectRetention`, not from application logs.
- **DB `retain_until` stays provably equal to the object `RetainUntilDate`** across escalation (the
  ADR-0006/0051 row-AND-object invariant): the helper returns the authoritative new date for the
  caller's row update.

## Rejected

- **Shorten-with-bypass support (GOVERNANCE)** — S3 allows it with `s3:BypassGovernanceRetention`,
  but a WORM product surface that can shorten retention is a compliance liability; bypass stays a
  break-glass IAM concern outside the port (cleanup tooling only, per ADR-0201's prover policy).
- **Escalation as a compliance-edition feature only** — the primitive sells à-la-carte (ADR-0054);
  the escalation mechanics belong in `audit-worm`, with the Compliance edition surfacing them as
  evidence (collectors) rather than owning them.
- **A separate mutable "retention policy" table as the source of truth** — the object lock IS the
  truth; a DB row that disagrees with S3 is the failure mode the row==object invariant exists to
  prevent.

## Consequences

- `ArtifactStore` implementations (S3, Local, test doubles) grow `extendRetention`; the audit-worm
  live proof (ADR-0201) exercises extend + the never-shorten refusal against the real bucket.
- The worm-retention evidence story now covers the full lifecycle: floor at write (ADR-0054), mode
  gate (ADR-0051), monotonic escalation with chain evidence (this ADR).
- Golden/unit tests pin: extend-later passes, extend-earlier/equal refuses, GOVERNANCE→COMPLIANCE
  demands the opt-in + production, every success carries a chain record.
