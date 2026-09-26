// src/store.pg.ts — DB-backed, append-only KeyVersionStore + WrappedKeyStore (ADR-0055, ADR-0043,
// ADR-0014). The persistent siblings of the in-memory defaults: `PgKeyVersionStore` tracks a
// tenant's current key version (the derived-key path) and `PgWrappedKeyStore` stores each version's
// KEK-wrapped DEK (the KMS path), both over the `0001_field_keys.sql` tables.
//
// KERNEL-ONLY (ADR-0043/0003, locked SPEC dep graph): this file imports ONLY @caisson-sh/kernel — never
// @caisson-sh/tenancy-rls. The RLS boundary is the caller's to establish: every store takes a
// PRE-TENANT-SCOPED executor (a connection/transaction the caller already opened via
// `withTenant` — SET ROLE app + the `app.current_account` GUC bound). field-crypto therefore stays a
// pure primitive whose `manifest.dependencies` is `["@caisson-sh/kernel"]`; the RLS policy lives in the
// hand-authored migration, not in an emitted `buildTenantPolicySql` call.
//
// APPEND-ONLY per version (ADR-0046, lazy re-encrypt): a (tenant, version) → wrapped-DEK mapping,
// once written, is immutable, so OLD VERSIONS STAY DECRYPTABLE forever — rotation only appends a
// higher version, and the next write to a field re-encrypts under the new current. The migration
// withholds the UPDATE/DELETE grant + carries a belt trigger; this store treats a same-version
// re-wrap with DIFFERENT bytes as a hard `ConflictError` (never overwrite key material), and an
// identical re-wrap as an idempotent no-op.
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  ConflictError,
  isUniqueViolation,
  ValidationError,
} from "@caisson-sh/kernel";
import type { WrappedKeyStore } from "./kms.ts";

/**
 * The minimal SQL surface these stores need: a `query` over a connection/transaction that is ALREADY
 * tenant-scoped by the caller (`withTenant` from @caisson-sh/tenancy-rls — SET ROLE app + GUC bound). A
 * structural subset of that package's `TenantExecutor` (and of the test harness's `PgExec`), so a
 * scoped `tx` is assignable here WITHOUT field-crypto importing tenancy-rls. Fail-closed: with no GUC
 * bound, RLS yields zero rows.
 */
export interface PgExecutor {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

/**
 * The async, DB-backed analogue of `registry.ts` `KeyVersionStore` (which is synchronous for the
 * in-process default). A Postgres read cannot be synchronous, so the persisted store exposes the same
 * get/set role with Promise-returning signatures; pure in-process callers keep the sync registry.
 */
export interface AsyncKeyVersionStore {
  /** The tenant's current key version, or `undefined` if none has been recorded. */
  get(tenantId: string): Promise<number | undefined>;
  /** Record `version` as a key version for the tenant (append-only, idempotent). */
  set(tenantId: string, version: number): Promise<void>;
}

/** Reject an empty tenant id before any query — never run an unscoped key lookup (fail-closed). */
function assertTenantId(tenantId: string): void {
  if (tenantId.length === 0) {
    throw new ValidationError("field-crypto: tenantId is required");
  }
}

/** Bound the version to the envelope's uint16 key-version field (ADR-0046). */
function assertKeyVersion(keyVersion: number): void {
  if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 0xffff) {
    throw new ValidationError(
      `field-crypto: key version must be an integer in [1, 65535], got ${JSON.stringify(keyVersion)}`,
    );
  }
}

/** Constant-time byte compare for stored key material (house rule: never `===`/`equals` on keys). */
function safeBytesEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The current (greatest) recorded key version for a tenant — versions mint monotonically. */
async function readCurrentVersion(
  exec: PgExecutor,
  tenantId: string,
): Promise<number | undefined> {
  assertTenantId(tenantId);
  const res = await exec.query<{ mx: number | null }>(
    `SELECT MAX(key_version) AS mx FROM field_key_version WHERE account_id = $1`,
    [tenantId],
  );
  const mx = res.rows[0]?.mx;
  return mx === null || mx === undefined ? undefined : mx;
}

/** Append a (tenant, version) row idempotently — recording the same version twice is a no-op. */
async function recordVersion(
  exec: PgExecutor,
  tenantId: string,
  keyVersion: number,
): Promise<void> {
  assertTenantId(tenantId);
  assertKeyVersion(keyVersion);
  await exec.query(
    `INSERT INTO field_key_version (id, account_id, key_version)
     VALUES ($1, $2, $3)
     ON CONFLICT (account_id, key_version) DO NOTHING`,
    [randomUUID(), tenantId, keyVersion],
  );
}

/**
 * DB-backed current-key-version store over `field_key_version`, append-only. Construct it with a
 * pre-tenant-scoped executor; "current" is the greatest recorded version (never a mutable pointer).
 */
export class PgKeyVersionStore implements AsyncKeyVersionStore {
  constructor(private readonly exec: PgExecutor) {}

  async get(tenantId: string): Promise<number | undefined> {
    return readCurrentVersion(this.exec, tenantId);
  }

  async set(tenantId: string, version: number): Promise<void> {
    await recordVersion(this.exec, tenantId, version);
  }
}

/** A wrapped-DEK row read back from `field_wrapped_dek`. bytea decodes to a `Uint8Array`. */
interface WrappedRow {
  readonly wrapped: Uint8Array;
}

interface InsertedRow {
  readonly id: string;
}

/**
 * DB-backed wrapped-DEK store over `field_wrapped_dek` (+ `field_key_version` for the current
 * pointer), append-only. Implements the `WrappedKeyStore` interface (`kms.ts`) so `KmsKeyProvider`
 * is unchanged. Construct it with a pre-tenant-scoped executor; every read/write runs under the
 * caller's RLS scope. A minted wrapped DEK is immutable — a different-bytes re-wrap is a hard
 * conflict, so a field encrypted under any prior version stays decryptable forever.
 */
export class PgWrappedKeyStore implements WrappedKeyStore {
  constructor(private readonly exec: PgExecutor) {}

  async getWrapped(
    tenantId: string,
    keyVersion: number,
  ): Promise<Buffer | undefined> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const res = await this.exec.query<WrappedRow>(
      `SELECT wrapped FROM field_wrapped_dek WHERE account_id = $1 AND key_version = $2`,
      [tenantId, keyVersion],
    );
    const row = res.rows[0];
    return row === undefined ? undefined : Buffer.from(row.wrapped);
  }

  async putWrapped(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<void> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    // Check first, then insert. A caught UNIQUE violation would abort the caller's transaction
    // (Postgres semantics), so the idempotent same-version re-put is resolved by a SELECT that keeps
    // the transaction usable: an identical re-put is a no-op; a DIFFERENT-bytes put would brick every
    // field encrypted under this version, so it is refused — a minted DEK is never overwritten.
    const existing = await this.getWrapped(tenantId, keyVersion);
    if (existing !== undefined) {
      if (safeBytesEqual(existing, wrapped)) return;
      throw new ConflictError(
        "field-crypto: a different wrapped DEK already exists for this tenant/version (append-only)",
        { tenantId, keyVersion },
      );
    }
    try {
      await this.exec.query(
        `INSERT INTO field_wrapped_dek (id, account_id, key_version, wrapped)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), tenantId, keyVersion, wrapped],
      );
    } catch (err) {
      // A concurrent writer minted the same version between the check and the insert — the UNIQUE
      // belt fires (23505). Terminal: the surrounding transaction rolls back, never a partial write.
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          "field-crypto: wrapped DEK for this tenant/version was concurrently created (append-only)",
          { tenantId, keyVersion },
        );
      }
      throw err;
    }
  }

  async putWrappedIfAbsent(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<boolean> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const result = await this.exec.query<InsertedRow>(
      `INSERT INTO field_wrapped_dek (id, account_id, key_version, wrapped)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id, key_version) DO NOTHING
       RETURNING id`,
      [randomUUID(), tenantId, keyVersion, wrapped],
    );
    return result.rows.length === 1;
  }

  async currentVersion(tenantId: string): Promise<number | undefined> {
    return readCurrentVersion(this.exec, tenantId);
  }

  async setCurrentVersion(tenantId: string, keyVersion: number): Promise<void> {
    await recordVersion(this.exec, tenantId, keyVersion);
  }
}
