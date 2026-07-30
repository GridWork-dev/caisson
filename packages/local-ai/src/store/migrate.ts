// src/store/migrate.ts — edition migration assembly + the ordered, idempotent `schema_version`
// ledger (ADR-0070/0075, threat data-migration). A COMPOSITION, not a new migrator.
//
// The pure topological merge (a package never depends "up" on an edition — ADR-0003) + the single
// `schema_version` checksum is kernel's `assembleMigrations` (ADR-0070): deterministic, IO-free,
// golden-pinned in the kernel. This module does two edition-local things on top of it:
//
//   (1) DECLARES the edition's contributing migrations — `@caisson/local-store`'s retrieval tables
//       (the dim-locked `vec0` + FTS5 + the `docs` relational table) and `@caisson/local-ai`'s own
//       tables (`items` + its at-rest sealed column, then the sync-metadata tables) — as one
//       down-only `PackageMigrations[]`, and merges them into ONE global sequence + one
//       `schema_version` checksum via `assembleMigrations`.
//
//   (2) APPLIES the merged sequence to one already-open, sqlite-vec-loaded per-tenant connection
//       under a forward-only `schema_version` ledger table: each migration runs exactly once
//       (recorded by global ordinal), so a re-apply is a pure no-op. The connection is the caller's
//       to prepare — `LocalStore` owns the native-extension load; the file path is the per-tenant
//       isolation boundary (ADR-0073) the caller resolves with `tenantDbPath`/`openTenantDb`.
//
// === IRREVERSIBLE — no rollback past these (the `data-migration` tag's core assertion) ===
//
//   • The `vec0` embedding dimension (`FLOAT[DIM]`) is FIXED at table creation — sqlite-vec exposes
//     no `ALTER` to change a vector column's width. A tenant DB migrated at dim N can therefore never
//     be re-migrated at dim M ≠ N: the retrieval migration's SQL (and so its checksum) differs, the
//     ledger's drift guard fires, and `migrate` THROWS rather than silently rebuild or drop the
//     vector index (ADR-0064/0067). Changing the embedding model = a fresh store + re-index, never an
//     in-place migration.
//   • The sync-metadata columns are likewise forward-only: `sync_changelog.seq` is an
//     AUTOINCREMENT, replica-LOCAL monotonic sequence that the capture watermark advances against,
//     and `sync_meta` binds this file's `tenant_id` + stable `replica_id`. Dropping or renumbering
//     them would reset every peer's convergence watermark and break two-way sync (ADR-0064).
//
// `ChangesetLog.open` and `LocalStore.open` still create their tables idempotently (`IF NOT EXISTS`)
// so each subsystem runs standalone; this ledger is the ONE ordered home that owns the same DDL — the
// `IF NOT EXISTS` shapes coincide, and the ledger records that the canonical migration has run.
import type { Database } from "bun:sqlite";
import {
  assembleMigrations,
  ValidationError,
  type MigrationAssembly,
  type PackageMigrations,
} from "@caisson/kernel/node";

/** The contributing package slugs — the down-only DAG `assembleMigrations` topo-orders (ADR-0003). */
const LOCAL_STORE_SLUG = "@caisson/local-store";
const LOCAL_AI_SLUG = "@caisson/local-ai";

/**
 * `@caisson/local-store`'s retrieval tables — the `docs` relational row, the always-available FTS5
 * index, and the `vec0` KNN index whose `FLOAT[DIM]` width is fixed here forever (IRREVERSIBLE, see
 * the file header). DDL kept byte-for-byte in step with `LocalStore.open` so the `IF NOT EXISTS`
 * shapes coincide; the dim is the only parameter.
 */
function retrievalSql(dim: number): string {
  return [
    "CREATE TABLE IF NOT EXISTS docs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, doc_id TEXT UNIQUE NOT NULL, text TEXT NOT NULL);",
    "CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(text);",
    `CREATE VIRTUAL TABLE IF NOT EXISTS docs_vec USING vec0(rowid INTEGER PRIMARY KEY, embedding FLOAT[${dim}]);`,
  ].join("\n");
}

/**
 * The edition's relational table. `id` is a `crypto.randomUUID()` the caller supplies; `secret` holds
 * a field-crypto self-describing at-rest envelope (sealed under the per-tenant derived key BEFORE it
 * touches the file — ADR-0055), never plaintext; `doc_id` links a row to its retrieval mirror
 * in `docs`. There is intentionally NO `tenant_id` column — the file IS the tenant (file-per-tenant,
 * ADR-0073), so a cross-tenant row is unexpressible.
 */
const ITEMS_SQL = `CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  doc_id TEXT,
  secret TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);`;

/** The sync-metadata tables — byte-for-byte the DDL `ChangesetLog.open` creates (IRREVERSIBLE). */
const SYNC_METADATA_SQL = `CREATE TABLE IF NOT EXISTS sync_meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_changelog (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  tbl TEXT NOT NULL,
  pk TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('upsert','delete')),
  payload TEXT,
  updated_at INTEGER NOT NULL
);`;

function assertDim(dim: number): void {
  if (!Number.isInteger(dim) || dim <= 0) {
    throw new ValidationError(
      "local-ai migration embedding dim must be a positive integer",
      { received: dim },
    );
  }
}

/**
 * The edition's down-only migration contribution set: `@caisson/local-store` (retrieval tables) then
 * `@caisson/local-ai` (its `items` + sync-metadata tables), each depending only DOWNWARD. Feed this
 * to {@link assembleEditionMigrations} (or kernel `assembleMigrations` directly) for the merged
 * sequence + ledger. The `dim` is baked into the retrieval migration, so it is part of the schema
 * identity (a different dim ⇒ a different assembled checksum — the dim-lock guard).
 */
export function editionMigrations(dim: number): PackageMigrations[] {
  assertDim(dim);
  return [
    {
      slug: LOCAL_STORE_SLUG,
      dependsOn: [],
      migrations: [{ name: "0001_retrieval.sql", sql: retrievalSql(dim) }],
    },
    {
      slug: LOCAL_AI_SLUG,
      dependsOn: [LOCAL_STORE_SLUG],
      migrations: [
        { name: "0001_items.sql", sql: ITEMS_SQL },
        { name: "0002_sync_metadata.sql", sql: SYNC_METADATA_SQL },
      ],
    },
  ];
}

/**
 * Compose the edition's contributing migrations into ONE ordered sequence + one `schema_version`
 * checksum via kernel's pure `assembleMigrations` (topo-merge by the down-only DAG, global renumber,
 * single sha256-chained `schemaVersion`). Pure + deterministic — the same `dim` always yields the
 * byte-identical assembly.
 */
export function assembleEditionMigrations(dim: number): MigrationAssembly {
  return assembleMigrations(editionMigrations(dim));
}

/** Options for {@link migrate}: the locked embedding `dim` and an injectable clock (tests). */
export interface MigrateOptions {
  /** The `vec0` embedding dimension — fixed at table creation, IRREVERSIBLE thereafter. */
  readonly dim: number;
  /** `applied_at` source (ms epoch). Defaults to `Date.now`; injectable for deterministic tests. */
  readonly now?: () => number;
}

/** The result of a {@link migrate} call. */
export interface MigrateResult {
  /** The assembled single-checksum schema identity ("is this DB at the expected schema"). */
  readonly schemaVersion: string;
  /** Global ordinals applied THIS call — empty on an idempotent re-apply (the no-op). */
  readonly applied: readonly number[];
}

/** The forward-only ledger: one row per applied global ordinal (ADR-0014/0070). */
const LEDGER_DDL = `CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);`;

interface LedgerRow {
  checksum: string;
}

/**
 * Apply the assembled edition migrations to one already-open, sqlite-vec-loaded per-tenant SQLite
 * connection under the forward-only `schema_version` ledger. Idempotent: each global ordinal runs at
 * most once (inside a transaction, recorded atomically with its content checksum), so a re-apply is a
 * pure no-op (`applied: []`).
 *
 * Fail-closed on IRREVERSIBLE drift: if an already-applied ordinal's recorded checksum no longer
 * matches the freshly-assembled one — e.g. re-running at a different `vec0` dim — `migrate` THROWS a
 * `ValidationError` (redaction-safe: ordinal + filename only, never SQL) rather than silently rebuild
 * past a point with no rollback (the dim-lock / sync-metadata contract in the file header).
 *
 * The caller owns the connection: load the native extension (via `LocalStore`) and resolve the
 * per-tenant file path (`tenantDbPath`/`openTenantDb`, ADR-0073) BEFORE calling this.
 */
export function migrate(db: Database, opts: MigrateOptions): MigrateResult {
  const now = opts.now ?? Date.now;
  const assembly = assembleEditionMigrations(opts.dim);

  db.exec(LEDGER_DDL);

  const readRow = db.prepare(
    "SELECT checksum FROM schema_version WHERE version = ?",
  );
  const insertRow = db.prepare(
    "INSERT INTO schema_version(version, filename, checksum, applied_at) VALUES (?, ?, ?, ?)",
  );

  const applied: number[] = [];
  for (const entry of assembly.sequence) {
    const existing = readRow.get(entry.seq) as LedgerRow | null;
    if (existing !== null) {
      if (existing.checksum !== entry.checksum) {
        throw new ValidationError(
          "irreversible schema drift: an applied migration's content changed",
          { version: entry.seq, filename: entry.filename },
        );
      }
      continue; // already applied — the idempotent no-op
    }
    db.transaction(() => {
      db.exec(entry.sql);
      insertRow.run(entry.seq, entry.filename, entry.checksum, now());
    })();
    applied.push(entry.seq);
  }

  return { schemaVersion: assembly.schemaVersion, applied };
}
