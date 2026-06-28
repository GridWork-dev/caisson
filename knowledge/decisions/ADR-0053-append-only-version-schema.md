# ADR-0053 — Append-only locked-version DB schema + immutability mechanism

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Binds the DB-layer schema +
immutability mechanism for the locked-version spine the kernel already validates.)

The kernel's `versioning.ts` (ADR-0006) validates the `supersedesId` chain in application code, but
the rows backing a locked compliance version must be **physically** immutable — app-layer purity
does not stop a stray `UPDATE`/`DELETE` from rewriting a court-admissible record under the app's
feet. This ADR locks the version-table schema and the mechanism that makes a locked row immutable.

## Decision

A single **append-only version table**; a change mints a new row that supersedes the prior via a
`supersedes_id` FK — nothing is ever mutated or destroyed.

- **Row immutability is enforced at the grant level: `REVOKE UPDATE, DELETE` on the table from the
  application role** (the Wardfile pattern — a privilege boundary, not a trigger). `INSERT`/`SELECT`
  only; the role physically cannot rewrite a locked row, so immutability holds even against a code
  bug or a compromised query path.
- **The `supersedes_id` chain is validated by `kernel/versioning.ts` on read** (`validateVersionSet`:
  unique ids, every `supersedes_id` resolves, no cycles, at-most-one successor) — the same pure
  functions the Compliance edition reuses verbatim over its locked-version tables.
- **"Current" is DERIVED, never stored** — a no-successor SQL predicate (`NOT EXISTS (SELECT 1 FROM v
s WHERE s.supersedes_id = v.id)`), mirroring `versioning.ts`'s `isCurrent`/`currentVersions`. A
  derived tip cannot drift out of sync with the chain.
- **A `provenance` JSONB column is parsed by a Zod `.strictObject` schema BEFORE `INSERT`** — unknown
  keys rejected at the boundary (engineering invariant ADR-0002); the row is never written with an
  unvalidated shape, because it can never be corrected afterward.
- **Optional defense-in-depth belt** (per-table, opt-in for the highest-assurance Compliance buyer): a
  `BEFORE UPDATE OR DELETE` trigger that `RAISE`s, plus a per-org `pg_advisory_xact_lock` serializing
  supersede writes within a lineage. The `REVOKE` is the primary gate; the trigger is redundancy.
- **This persists `kernel/versioning.ts` under ADR-0006.** "Derived current" and "linear-only — throw
  on fork" (`successorOf` rejects a second successor) **confirm** ADR-0006's append-only model at the
  DB layer; they are not re-decided here.

## Rejected

- **(c) Artifacts only in the WORM ArtifactStore with Postgres holding bare refs** — loses the
  queryable version spine (no SQL over the lineage) and forfeits `versioning.ts` structural validation
  (chain/cycle/fork checks) on the relational side. The WORM store still backs the immutable _bytes_
  (ADR-0006); it does not replace the queryable version table.
- **Storing `current` as a boolean/pointer column** — can drift from the `supersedes_id` chain on any
  partial write or missed flip; a derived predicate cannot. Rejected.

## Binding

Locked versions live in one append-only table whose application role holds `INSERT`/`SELECT` only
(`UPDATE`/`DELETE` revoked); the `supersedes_id` lineage is linear (fork throws) and validated by
`kernel/versioning.ts` on every read; "current" is computed from the no-successor predicate and is
never persisted; the `provenance` JSONB is Zod-`.strictObject`-parsed before insert. Future code and
agents MUST NOT add an `UPDATE`/`DELETE` grant, store a `current` column, or write a version row that
bypasses the pre-insert provenance parse. Evidence: ADR-0006 (append-only versioning + WORM chain),
`packages/kernel/src/versioning.ts` (`validateVersionSet`/`isCurrent`/`currentVersions`, fork-rejecting
seam), the Wardfile REVOKE-grant immutability pattern, ADR-0002 (Zod `.strict()` at every boundary),
and `outputs/research/wave1-forks.md`.
