# SPEC — WORM retention escalation (Wardfile B2, pulled forward)

**Status: LOCKED — ADR-0202 (2026-07-01, editions-go-live picker).** Pulled forward from the LIFT
slice-2 queue ("Wardfile B2 audit-worm S3 Object-Lock retention escalation — Compliance
evidence-retention gate") into the editions-go-live session, same `packages/audit-worm` tree as the
ADR-0201 S3 live proof.

- **Slice:** LIFT slice 2, front-of-wave (security-critical hardening), built early.
- **Edition:** Compliance (primitive lives in `@caisson/audit-worm`, sold à-la-carte per ADR-0054).
- **Source (patterns only, firewall-clean):** Wardfile B2 — GOVERNANCE-now/COMPLIANCE-at-escalation.
- **Tags:** `security` `infra`.

## Goal (WHAT + WHY)

An evidence store that can only set retention at write time is half a lifecycle. Litigation holds and
reclassification require EXTENDING an existing artifact's retain-until and escalating
GOVERNANCE→COMPLIANCE — without any path that weakens a lock. Auditors need the escalation itself to
be evidence, not an application log line.

## Scope

**In:**

- `extendRetention(key, newRetainUntil)` on the `ArtifactStore` port (S3: `PutObjectRetention`,
  mode-preserving; Local: records, never enforces). Strictly later than the current retention or
  fail-closed `ValidationError`. Never shortens, never clamps.
- Mode escalation GOVERNANCE→COMPLIANCE on an existing object behind the exact ADR-0051 gate
  (typed `irreversibleComplianceOptIn` naming the bucket + `NODE_ENV === "production"` + never under
  a test runner). No de-escalation path exists.
- A chain-evidenced escalation helper: extend/escalate + append
  `{ kind: "retention.escalated", key, from, to, mode }` to the tenant's `AuditChainStore` in the
  same operation; a failed chain append fails the escalation (fail-closed).
- Row==object invariant preserved: the helper returns the authoritative new date for the DB
  `retain_until` update.

**Out (defer):** shorten/bypass tooling (break-glass IAM concern, not a port method); a buyer-facing
escalation UI; compliance-edition collector surfacing beyond what the existing worm-retention
collector already reports (queue as follow-up if an auditor asks for a dedicated escalation control).

## Tasks (for PLAN)

1. Port + `LocalArtifactStore` + `S3ArtifactStore` `extendRetention` with the strictly-later guard
   (unit tests: later passes / equal+earlier refuse / mode preserved / 404 fail).
2. GOVERNANCE→COMPLIANCE escalation path reusing `assertComplianceAllowed` semantics (unit tests:
   refused without opt-in, refused outside production, refused under test runner).
3. `escalateRetention` chain-evidenced helper over store + `AuditChainStore` (integration test on
   PGlite + LocalArtifactStore: success appends a verifiable record; a throwing chain sink fails the
   escalation).
4. Live-proof leg added to the ADR-0201 S3 `live/` test: extend on the real bucket + never-shorten
   refusal observed against real `GetObjectRetention`.

## Verify (goal-backward)

- No reachable code path shortens or de-escalates retention (typecheck + tests).
- One escalation produces exactly one chain record and the chain verifies.
- `bun run check` green; changeset names `@caisson/audit-worm`.
