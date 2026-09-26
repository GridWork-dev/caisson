// src/version-store.ts — the append-only locked-version persistence + DERIVED current (ADR-0053).
//
// This is the DB layer ON TOP of the kernel's pure versioning algebra — it adds NO new lineage
// logic, it COMPOSES it. Every structural invariant (unique ids, no dangling supersede, no fork, no
// cycle) and every derivation (which version is "current", a version's chain) is a kernel function
// used verbatim (`validateVersionSet`/`currentVersions`/`versionChain`/`isCurrent`); this file only
// durably stores rows and reads them back fail-closed.
//
// Three properties, each enforced by a different mechanism so no single bug defeats them:
//   1. APPEND-ONLY — rows land in `locked_version`, whose migration grants the `app` role SELECT +
//      INSERT only (UPDATE/DELETE withheld + REVOKEd) AND carries a BEFORE UPDATE/DELETE RAISE
//      trigger as a belt against any role that does hold them. A committed version is
//      immutable by privilege + trigger, not by convention.
//   2. NO FORK / IN-TENANT SUPERSEDE — `UNIQUE(account_id, supersedes_id)` lets a prior be
//      superseded at most once (a fork hits 23505 → `ConflictError`), and the composite FK keeps a
//      supersede inside one tenant. Concurrent appends to one artifact serialize under an advisory
//      lock so two racers cannot both read the same tip and fork it.
//   3. CURRENT IS DERIVED, NEVER STORED — "current" comes from a no-successor SQL predicate AND from
//      the kernel `currentVersions` over the same loaded set; the two derivations are asserted to
//      agree on every read, so a drift between the DB and the pure model surfaces (flag, never guess).
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  canonicalize,
  ConflictError,
  currentVersions as kernelCurrentVersions,
  InternalError,
  isCurrent as kernelIsCurrent,
  isUniqueViolation,
  NotFoundError,
  parseStrict,
  strictObject,
  validateVersionSet,
  ValidationError,
  versionChain as kernelVersionChain,
  type JsonValue,
  type VersionRecord,
} from "@caisson-sh/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson-sh/tenancy-rls";

/** Advisory-lock namespace so version locks never collide with another subsystem's keyspace. */
const LOCK_NAMESPACE = "caisson.locked-version";

/**
 * Provenance of a locked version — WHO locked WHAT and WHY. Parsed with Zod `.strictObject` BEFORE
 * the INSERT (ADR-0053), so an unknown or malformed field is rejected at the boundary, never stored.
 */
export const provenanceSchema = strictObject({
  /** Lowercase-hex SHA-256 of the artifact bytes this version locks. */
  artifactHash: z.string().min(1).max(128),
  /** Verified subject/actor id that locked this version (from session/JWT, ADR-0015 — never params). */
  lockedBy: z.string().min(1).max(256),
  /** Human-recorded reason / changelog for minting this version (FLAGGED-evidence audit trail). */
  reason: z.string().min(1).max(4000),
});
export type Provenance = z.infer<typeof provenanceSchema>;

/** A version record as stored + read back. Superset of the kernel `VersionRecord` (id, supersedesId). */
export interface LockedVersion extends VersionRecord {
  readonly id: string;
  /** Lineage key — versions of one logical artifact share an `artifactId`. */
  readonly artifactId: string;
  /** The id this version supersedes, or `null` for the original (root of a lineage). */
  readonly supersedesId: string | null;
  readonly provenance: Provenance;
  /** Append timestamp (ISO-8601), assigned by the DB. */
  readonly createdAt: string;
}

/** Input to `insertVersion`. `provenance` is `unknown` — it is Zod-parsed before any INSERT. */
export interface InsertVersionInput {
  readonly artifactId: string;
  /** Omit (or `null`) to mint the lineage root; otherwise the prior version this one supersedes. */
  readonly supersedesId?: string | null;
  readonly provenance: unknown;
}

/** A row read back from `locked_version`. `provenance` is jsonb — already a parsed JSON value. */
interface VersionRow {
  readonly id: string;
  readonly artifact_id: string;
  readonly supersedes_id: string | null;
  readonly provenance: unknown;
  readonly created_at: unknown;
}

const SELECT_COLS =
  "id, artifact_id, supersedes_id, provenance, created_at" as const;

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  throw new InternalError("locked_version.created_at has an unexpected type");
}

function toVersion(row: VersionRow): LockedVersion {
  // Re-validate provenance on read-back: the stored shape is exactly the validated object, so a
  // mismatch means the row was tampered out-of-band (flag, never guess — ADR-0053).
  return {
    id: row.id,
    artifactId: row.artifact_id,
    supersedesId: row.supersedes_id,
    provenance: parseStrict(provenanceSchema, row.provenance),
    createdAt: toIso(row.created_at),
  };
}

async function loadRows(
  tx: TenantExecutor,
  accountId: string,
  artifactId?: string,
): Promise<VersionRow[]> {
  if (artifactId !== undefined) {
    const r = await tx.query<VersionRow>(
      `SELECT ${SELECT_COLS} FROM locked_version
        WHERE account_id = $1 AND artifact_id = $2
        ORDER BY created_at ASC, id ASC`,
      [accountId, artifactId],
    );
    return r.rows;
  }
  const r = await tx.query<VersionRow>(
    `SELECT ${SELECT_COLS} FROM locked_version
      WHERE account_id = $1
      ORDER BY created_at ASC, id ASC`,
    [accountId],
  );
  return r.rows;
}

/** True iff the two sets carry exactly the same ids (the never-drift cross-check). */
function sameIds(
  a: readonly { id: string }[],
  b: readonly { id: string }[],
): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((v) => v.id));
  return b.every((v) => ids.has(v.id));
}

export interface LockedVersionStoreOptions {
  /** A transactor over the tenant DB (PGlite, node-postgres, Drizzle) — reads/writes run under RLS. */
  readonly db: Transactor;
}

/**
 * Append-only locked-version store over a per-tenant `locked_version` table. One instance binds a
 * tenant DB transactor; every method is tenant-scoped through `withTenant`, so a forgotten filter
 * still sees only the caller's versions (ADR-0005, fail-closed). "Current" is always DERIVED.
 */
export class LockedVersionStore {
  private readonly db: Transactor;

  constructor(opts: LockedVersionStoreOptions) {
    this.db = opts.db;
  }

  /**
   * Append a new locked version. `provenance` is Zod-`.strictObject`-parsed BEFORE the INSERT. When
   * `supersedesId` is given, the prior must exist in the SAME artifact lineage and not already be
   * superseded — a fork hits the unique belt and rolls back as `ConflictError` (never a partial).
   */
  async insertVersion(
    accountId: string,
    input: InsertVersionInput,
  ): Promise<LockedVersion> {
    if (input.artifactId.length === 0) {
      throw new ValidationError("artifactId is required");
    }
    const provenance = parseStrict(provenanceSchema, input.provenance);
    // Build an explicit JsonValue and store its canonical bytes so what we keep is deterministic.
    const provJson: { [key: string]: JsonValue } = {
      artifactHash: provenance.artifactHash,
      lockedBy: provenance.lockedBy,
      reason: provenance.reason,
    };
    const provText = canonicalize(provJson);
    const supersedesId = input.supersedesId ?? null;

    return withTenant(this.db, accountId, async (tx) => {
      // Serialize appends for THIS (tenant, artifact) for the txn's life — two racers can't both
      // read the same tip and fork it. UNIQUE(account_id, supersedes_id) is the hard belt under it.
      await tx.query(
        `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
        [`${LOCK_NAMESPACE}:${input.artifactId}`, accountId],
      );

      if (supersedesId !== null) {
        // The predecessor must be visible under THIS tenant (RLS) and in the SAME lineage — a
        // cross-tenant or cross-artifact supersede is refused before the INSERT (defense-in-depth
        // with the composite FK, which also blocks cross-tenant at the constraint level).
        const pred = await tx.query<{ artifact_id: string }>(
          `SELECT artifact_id FROM locked_version WHERE id = $1`,
          [supersedesId],
        );
        const predRow = pred.rows[0];
        if (predRow === undefined) {
          throw new NotFoundError("superseded version not found", {
            accountId,
          });
        }
        if (predRow.artifact_id !== input.artifactId) {
          throw new ValidationError(
            "cannot supersede a version from a different artifact lineage",
          );
        }
      }

      const id = randomUUID();
      try {
        const res = await tx.query<VersionRow>(
          `INSERT INTO locked_version (id, account_id, artifact_id, supersedes_id, provenance)
           VALUES ($1, $2, $3, $4, $5::jsonb)
           RETURNING ${SELECT_COLS}`,
          [id, accountId, input.artifactId, supersedesId, provText],
        );
        const row = res.rows[0];
        if (row === undefined) {
          throw new InternalError("locked_version insert returned no row");
        }
        return toVersion(row);
      } catch (err) {
        if (isUniqueViolation(err)) {
          // Two versions tried to supersede the same prior → fork. Reject, never fork the lineage.
          throw new ConflictError(
            "version already superseded; the lineage cannot fork",
            { accountId },
          );
        }
        throw err;
      }
    });
  }

  /** Load the tenant's full version set, validated by the kernel (throws on structural corruption). */
  async loadAll(accountId: string): Promise<LockedVersion[]> {
    return withTenant(this.db, accountId, async (tx) => {
      const versions = (await loadRows(tx, accountId)).map(toVersion);
      validateVersionSet(versions); // kernel: duplicate id / dangling / fork / cycle → throw
      return versions;
    });
  }

  /**
   * Every current version (one tip per lineage), DERIVED two independent ways that must agree:
   * a no-successor SQL predicate AND the kernel `currentVersions` over the loaded set. A divergence
   * means the DB and the pure model drifted — surfaced as an error, never silently reconciled.
   */
  async currentVersions(accountId: string): Promise<LockedVersion[]> {
    return withTenant(this.db, accountId, async (tx) => {
      const all = (await loadRows(tx, accountId)).map(toVersion);
      validateVersionSet(all);

      const sqlRes = await tx.query<VersionRow>(
        `SELECT ${SELECT_COLS} FROM locked_version v
          WHERE v.account_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM locked_version s
               WHERE s.account_id = v.account_id AND s.supersedes_id = v.id)
          ORDER BY v.created_at ASC, v.id ASC`,
        [accountId],
      );
      const sqlCurrent = sqlRes.rows.map(toVersion);

      if (!sameIds(sqlCurrent, kernelCurrentVersions(all))) {
        throw new InternalError(
          "derived current drifted from the pure version model",
        );
      }
      return sqlCurrent;
    });
  }

  /**
   * The current tip of one artifact's lineage, or `null` if the artifact has no versions. The SQL
   * no-successor predicate and the kernel derivation must agree on the single tip (never drifts).
   */
  async currentVersion(
    accountId: string,
    artifactId: string,
  ): Promise<LockedVersion | null> {
    return withTenant(this.db, accountId, async (tx) => {
      const lineage = (await loadRows(tx, accountId, artifactId)).map(
        toVersion,
      );
      if (lineage.length === 0) return null;
      validateVersionSet(lineage);

      const tips = kernelCurrentVersions(lineage);
      if (tips.length !== 1) {
        throw new InternalError("artifact lineage resolved to multiple tips");
      }
      const tip = tips[0] as LockedVersion;

      const sqlRes = await tx.query<VersionRow>(
        `SELECT ${SELECT_COLS} FROM locked_version v
          WHERE v.account_id = $1 AND v.artifact_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM locked_version s
               WHERE s.account_id = v.account_id AND s.supersedes_id = v.id)`,
        [accountId, artifactId],
      );
      if (sqlRes.rows.length !== 1 || sqlRes.rows[0]?.id !== tip.id) {
        throw new InternalError(
          "derived current drifted from the pure version model",
        );
      }
      return tip;
    });
  }

  /** An artifact's lineage, oldest (root) → newest (current tip), via the kernel `versionChain`. */
  async chainFor(
    accountId: string,
    artifactId: string,
  ): Promise<LockedVersion[]> {
    return withTenant(this.db, accountId, async (tx) => {
      const lineage = (await loadRows(tx, accountId, artifactId)).map(
        toVersion,
      );
      if (lineage.length === 0) return [];
      validateVersionSet(lineage);
      const tips = kernelCurrentVersions(lineage);
      if (tips.length !== 1) {
        throw new InternalError("artifact lineage resolved to multiple tips");
      }
      const tip = tips[0] as LockedVersion;
      return kernelVersionChain(lineage, tip.id) as LockedVersion[];
    });
  }

  /** True iff `id` exists in the tenant's set and nothing supersedes it (kernel `isCurrent`). */
  async isCurrent(accountId: string, id: string): Promise<boolean> {
    return withTenant(this.db, accountId, async (tx) => {
      const all = (await loadRows(tx, accountId)).map(toVersion);
      return kernelIsCurrent(all, id); // throws if `id` is unknown to the set
    });
  }
}
