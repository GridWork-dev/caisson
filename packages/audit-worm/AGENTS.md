# AGENTS — @caisson-sh/audit-worm

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
edition must know to wire WORM storage + the audit chain + the locked-version DB correctly. This is
the Compliance edition's evidentiary primitive; it COMPOSES the kernel integrity algebra
(`canonicalize`/`chainEntry`/`anchorChain`/`verifyChain`/`validateVersionSet`), never re-implements
it.

## Invariants (do not violate)

- **Write-once is the whole point.** A chain anchor lands under a LENGTH-keyed, write-once WORM key
  (`{account_id}/audit-chain/anchors/<padded-length>.json`). Re-anchoring an existing length is
  REFUSED (`ArtifactExistsError` → `ConflictError`). Never delete, overwrite, or "fix" an anchor —
  that is the truncation/rewrite tripwire.
- **Append-only by privilege, not convention.** `audit_chain_entry` and `locked_version` grant the
  `app` role SELECT + INSERT and WITHHOLD UPDATE/DELETE (the version table adds a BEFORE UPDATE/DELETE
  RAISE trigger belt). Never author a migration or query that mutates a committed entry/version.
- **Everything is tenant-scoped, fail-closed.** Every store method runs inside `withTenant` and every
  WORM key is prefixed `{account_id}/…` (validated by `assertSafeKey`). A forgotten filter still sees
  only the caller's chain (ADR-0005). Never call a store outside a tenant scope.
- **"Current" is DERIVED, never stored.** `LockedVersionStore` computes the current version from a
  no-successor predicate AND cross-checks it against the kernel `currentVersions` model — a drift
  flags, never guesses. Do not add a `is_current` column.
- **No live cloud on the CI path.** Cloud stores take injected clients/transports and have separately
  gated live proofs. `LocalArtifactStore` is a dev/test fs double — it IGNORES retention; never use
  it where provider-enforced retention matters.
- **Keep the exact immutable version.** When a backend returns `ArtifactMeta.versionId`, pass it to
  later `get`, `head`, and `extendRetention` calls. Never let a newer current object stand in for the
  recorded evidentiary version.
- **COMPLIANCE mode is an irreversible footgun.** S3 Object-Lock defaults to GOVERNANCE.
  COMPLIANCE (which can brick a bucket until the retention term elapses) is reachable ONLY through the
  typed `irreversibleComplianceOptIn(...)` guard and is refused outside a real deployment. Never opt
  in from a test or a generator.

## Retention floor (ADR-0054)

`retainUntilFrom(now, years)` is calendar-correct; the legal floor is 6–7 years
(`MIN_RETENTION_YEARS` / `DEFAULT_RETENTION_YEARS`) for HIPAA/SEC 17a-4. Pass a clock at the edge so
retention is deterministic + testable.

## Golden (ADR-0013)

`src/__golden__/anchor.json` pins the canonical `{length, tipHash, genesisHash}` anchor over a fixed
chain — the reproducibility the chain's tamper-evidence depends on. Update only via `BLESS=1 bun test`
(a change there is a chain-format break and must land as a reviewed diff).

## Dependencies

Down-only (ADR-0003): `@caisson-sh/kernel` (integrity algebra, errors, canonicalize) + `@caisson-sh/tenancy-rls`
(the `withTenant` scope). Never depends "up" on an edition; the Compliance edition consumes THIS.
