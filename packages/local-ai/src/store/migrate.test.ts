// Edition migration assembly + the ordered, idempotent `schema_version` ledger (ADR-0070/0075,
// threat data-migration). In-process, deterministic, NO network: a real sqlite-vec-loaded in-memory
// `bun:sqlite` connection. Proves the merge composes `@caisson/local-store`'s retrieval tables BELOW
// the edition's tables (topo-order), that apply is idempotent (a re-apply is a pure no-op that
// preserves data), and that the IRREVERSIBLE `vec0` dim-lock fails closed (no rollback past it).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { ValidationError } from "@caisson/kernel";
import {
  assembleEditionMigrations,
  editionMigrations,
  migrate,
} from "./migrate.ts";

const DIM = 8;
/** A fixed `applied_at` source — the ledger's timestamp is not asserted, only its determinism. */
const NOW = () => 1_000;

/** Open an in-memory connection with sqlite-vec loaded — the connection contract `migrate` requires. */
function openVecDb(): Database {
  const db = new Database(":memory:");
  db.loadExtension(sqliteVec.getLoadablePath());
  return db;
}

/** Does a table (or virtual table) exist in this connection? */
function tableExists(db: Database, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | null;
  return row !== null;
}

function ledgerCount(db: Database): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM schema_version").get() as {
      n: number;
    }
  ).n;
}

let db: Database;
beforeEach(() => {
  db = openVecDb();
});
afterEach(() => {
  db.close();
});

describe("edition migration assembly (ADR-0070/0075, compose-time merge)", () => {
  test("topo-merges local-store's retrieval tables BELOW the edition tables", () => {
    const { sequence } = assembleEditionMigrations(DIM);
    expect(sequence.map((m) => [m.sourcePackage, m.sourceName])).toEqual([
      ["@caisson/local-store", "0001_retrieval.sql"],
      ["@caisson/local-ai", "0001_items.sql"],
      ["@caisson/local-ai", "0002_sync_metadata.sql"],
    ]);
    // Globally renumbered into one sequence (ADR-0070): the original ordinals are replaced.
    expect(sequence.map((m) => m.filename)).toEqual([
      "0001_retrieval.sql",
      "0002_items.sql",
      "0003_sync_metadata.sql",
    ]);
  });

  test("the assembled schemaVersion is a single sha256 that is dim-sensitive (the dim-lock)", () => {
    const v8 = assembleEditionMigrations(8).schemaVersion;
    const v16 = assembleEditionMigrations(16).schemaVersion;
    expect(v8).toMatch(/^[0-9a-f]{64}$/);
    expect(v16).toMatch(/^[0-9a-f]{64}$/);
    // The vec0 dim is baked into the retrieval migration ⇒ part of the schema identity.
    expect(v8).not.toBe(v16);
  });

  test("editionMigrations rejects a non-positive / non-integer dim (fail-closed boundary)", () => {
    expect(() => editionMigrations(0)).toThrow(ValidationError);
    expect(() => editionMigrations(-1)).toThrow(ValidationError);
    expect(() => editionMigrations(1.5)).toThrow(ValidationError);
  });
});

describe("migrate apply (idempotent forward-only ledger)", () => {
  test("a fresh apply creates every table under one ordered ledger", () => {
    const result = migrate(db, { dim: DIM, now: NOW });

    expect(result.applied).toEqual([1, 2, 3]);
    expect(result.schemaVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(ledgerCount(db)).toBe(3);

    // local-store retrieval tables + the edition tables, all present on one connection.
    for (const t of [
      "docs",
      "docs_fts",
      "docs_vec",
      "items",
      "sync_meta",
      "sync_changelog",
    ]) {
      expect(tableExists(db, t)).toBe(true);
    }
  });

  test("re-apply is a pure no-op (apply idempotent; re-apply no-op — the verify clause)", () => {
    const first = migrate(db, { dim: DIM, now: NOW });
    const second = migrate(db, { dim: DIM, now: NOW });

    expect(first.applied).toEqual([1, 2, 3]);
    expect(second.applied).toEqual([]); // nothing re-runs
    expect(second.schemaVersion).toBe(first.schemaVersion);
    expect(ledgerCount(db)).toBe(3); // no duplicate ledger rows
  });

  test("a re-apply preserves existing rows (no table is rebuilt)", () => {
    migrate(db, { dim: DIM, now: NOW });
    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO items (id, doc_id, secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, "doc-1", "sealed-envelope", 1, 1);

    migrate(db, { dim: DIM, now: NOW }); // the no-op re-apply

    const row = db.prepare("SELECT id FROM items WHERE id = ?").get(id) as {
      id: string;
    } | null;
    expect(row?.id).toBe(id);
  });

  test("an embedding row stored under the locked dim survives a re-apply", () => {
    migrate(db, { dim: DIM, now: NOW });
    db.prepare("INSERT INTO docs (doc_id, text) VALUES (?, ?)").run("d1", "hi");
    db.prepare("INSERT INTO docs_vec (rowid, embedding) VALUES (?, ?)").run(
      1,
      new Float32Array(DIM).fill(0.5),
    );

    migrate(db, { dim: DIM, now: NOW });

    const n = (
      db.prepare("SELECT COUNT(*) AS n FROM docs_vec").get() as { n: number }
    ).n;
    expect(n).toBe(1);
  });
});

describe("migrate IRREVERSIBLE dim-lock (data-migration — no rollback past the vec0 dim)", () => {
  test("re-migrating a DB at a different vec0 dim fails closed", () => {
    migrate(db, { dim: 8, now: NOW });
    // The vec0 FLOAT[N] width is fixed at creation; re-running at a new dim is irreversible drift.
    expect(() => migrate(db, { dim: 16, now: NOW })).toThrow(
      /irreversible schema drift/,
    );
    // The original schema is untouched — the guard threw before any mutation.
    expect(ledgerCount(db)).toBe(3);
  });
});
