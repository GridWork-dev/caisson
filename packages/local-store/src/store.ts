// src/store.ts — local hybrid retrieval (ADR-0067). Raw `bun:sqlite` over sqlite-vec `vec0`
// (FLOAT[N], dimension fixed at table creation) + FTS5, fused by Reciprocal Rank Fusion (RRF_K=60).
// The FTS5 path is ALWAYS available; when no query vector is supplied — or the vec leg is
// missing/fails — retrieval degrades to FTS5-only and still returns. The embedding that produces a
// vector is an INJECTED SEAM — this module never calls a model, opens no socket, and is
// deterministic for a fixed input (golden-pinned at `src/__golden__/rrf-ranking.json`).
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import * as sqliteVec from "sqlite-vec";
import { ValidationError } from "@caisson-sh/kernel";
import { fuseByRrf } from "./rrf.ts";

/**
 * macOS ships a system SQLite with extension loading DISABLED (the Apple build), so a bare
 * `bun:sqlite` `loadExtension(sqlite-vec)` throws "does not support dynamic extension loading".
 * `Database.setCustomSQLite` points bun:sqlite at a build that allows it; it is process-global and
 * MUST run before any `new Database()`, so we apply it once, lazily, on the first open. Homebrew's
 * sqlite (a buyer/CI prerequisite on macOS) supports extensions. No-op on Linux — Bun's bundled
 * SQLite already allows extension loading (ADR-0067). If no extension-capable SQLite is found, the
 * original clear `loadExtension` error still surfaces (fail-closed, never silent).
 */
let customSqliteApplied = false;
function ensureExtensionCapableSqlite(): void {
  if (customSqliteApplied || process.platform !== "darwin") return;
  customSqliteApplied = true;
  const candidates = [
    "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib", // Apple Silicon Homebrew
    "/usr/local/opt/sqlite/lib/libsqlite3.dylib", // Intel Homebrew
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      Database.setCustomSQLite(p);
      return;
    }
  }
}

/** A document to index: a stable string id, its FTS text, and an OPTIONAL embedding (the seam). */
export interface StoreDoc {
  id: string;
  text: string;
  embedding?: number[];
}

/** A hybrid-search request. `queryVector` omitted (or a failed vec leg) ⇒ FTS5-only retrieval. */
export interface HybridSearchOptions {
  queryText: string;
  queryVector?: number[];
  limit?: number;
  /**
   * Multiplier on the FTS (bm25) leg's RRF contribution; the vec leg stays 1.0. Default 1.0 —
   * symmetric fusion, byte-identical to the pre-option behavior (the committed RRF golden). Raise
   * above 1 when exact-term evidence should outrank semantic-neighborhood evidence
   * (a corpus dense with near-duplicate sections buries the canonical exact-match page on the vec
   * leg). Must be a positive finite number; anything else THROWS (flag-never-guess).
   */
  ftsWeight?: number;
}

/** A fused result: the document id and its RRF score (higher = better). */
export interface SearchHit {
  id: string;
  score: number;
}

/** A page request for {@link LocalStore.list} — a plain enumeration, not a ranked query. */
export interface ListOptions {
  limit?: number;
  offset?: number;
}

/** One listed document: id + text only (no score — `list` is not a ranked retrieval). */
export interface ListedDoc {
  id: string;
  text: string;
}

const LIST_DEFAULT_LIMIT = 50;
const LIST_MAX_LIMIT = 500;

/** Clamp a caller-supplied limit into `[1, LIST_MAX_LIMIT]`; a bad/absent value falls back to the default. */
function clampListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return LIST_DEFAULT_LIMIT;
  return Math.min(LIST_MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

/** Clamp a caller-supplied offset to a non-negative integer; a bad/absent value is `0`. */
function clampListOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}

interface RowId {
  rowid: number;
}

export class LocalStore {
  private constructor(
    private readonly db: Database,
    private readonly dim: number,
  ) {}

  /**
   * Open a store. `dim` fixes the `vec0` vector width at table creation (ADR-0067) — every indexed
   * embedding must match it. `path` defaults to an in-memory DB (tests); a per-tenant file path is
   * resolved by `tenant-db.ts` (ADR-0073), where the path itself IS the isolation boundary.
   */
  static open(opts: { dim: number; path?: string }): LocalStore {
    if (!Number.isInteger(opts.dim) || opts.dim <= 0) {
      throw new ValidationError("local-store dim must be a positive integer", {
        received: opts.dim,
      });
    }
    ensureExtensionCapableSqlite();
    const db = new Database(opts.path ?? ":memory:");
    db.loadExtension(sqliteVec.getLoadablePath());
    db.exec(
      "CREATE TABLE IF NOT EXISTS docs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, doc_id TEXT UNIQUE NOT NULL, text TEXT NOT NULL)",
    );
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(text)");
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS docs_vec USING vec0(rowid INTEGER PRIMARY KEY, embedding FLOAT[${opts.dim}])`,
    );
    return new LocalStore(db, opts.dim);
  }

  /**
   * Insert or replace a document. The FTS row is ALWAYS written; the vec row is written only when an
   * embedding is supplied. A mismatched embedding dimension THROWS (flag-never-guess) — never padded
   * or truncated.
   */
  upsert(doc: StoreDoc): void {
    if (doc.embedding !== undefined && doc.embedding.length !== this.dim) {
      throw new ValidationError("embedding dimension mismatch", {
        expected: this.dim,
        received: doc.embedding.length,
      });
    }
    const existing = this.db
      .prepare("SELECT rowid FROM docs WHERE doc_id = ?")
      .get(doc.id) as RowId | null;
    if (existing) this.deleteRow(existing.rowid);

    const info = this.db
      .prepare("INSERT INTO docs(doc_id, text) VALUES (?, ?)")
      .run(doc.id, doc.text);
    const rowid = Number(info.lastInsertRowid);
    this.db
      .prepare("INSERT INTO docs_fts(rowid, text) VALUES (?, ?)")
      .run(rowid, doc.text);
    if (doc.embedding !== undefined) {
      this.db
        .prepare("INSERT INTO docs_vec(rowid, embedding) VALUES (?, ?)")
        .run(rowid, new Float32Array(doc.embedding));
    }
  }

  /** Insert a corpus atomically. Besides all-or-nothing semantics, one transaction avoids an fsync
   * per document when producing a file-backed build artifact. */
  upsertMany(docs: readonly StoreDoc[]): void {
    this.db.transaction((batch: readonly StoreDoc[]) => {
      for (const doc of batch) this.upsert(doc);
    })(docs);
  }

  /**
   * Hybrid retrieval: rank by vector KNN and by FTS5 independently, then fuse by RRF. The vec leg is
   * skipped when no `queryVector` is given and is caught-and-skipped on a backend failure (degrade to
   * FTS5-only, the always-available floor); the FTS leg runs whenever `queryText` is non-empty. A
   * query vector of the wrong dimension is an explicit caller error and THROWS.
   */
  hybridSearch(opts: HybridSearchOptions): SearchHit[] {
    const limit = opts.limit ?? 10;
    const legLimit = Math.max(limit * 8, 50);
    const ftsWeight = opts.ftsWeight ?? 1;
    // The option's own boundary guard, kept HERE (not delegated to `fuseByRrf`'s leg-weight floor)
    // so a bad caller value still throws under its own name BEFORE either leg queries the database.
    if (!Number.isFinite(ftsWeight) || ftsWeight <= 0) {
      throw new ValidationError("ftsWeight must be a positive finite number", {
        received: ftsWeight,
      });
    }

    const vecRanks = this.vecLeg(opts.queryVector, legLimit);
    const ftsRanks = this.ftsLeg(opts.queryText, legLimit);

    // RRF fusion (rrf.ts — the ONE implementation): every leg a doc appears in contributes
    // weight/(RRF_K + rank); sum across legs, score descending, rowid-ascending tie-break. The FTS
    // contribution is scaled by `ftsWeight` (default 1 — the symmetric classic form).
    const ranked = fuseByRrf(
      [
        { ranks: vecRanks, weight: 1 },
        { ranks: ftsRanks, weight: ftsWeight },
      ],
      { limit },
    );
    if (ranked.length === 0) return [];

    return ranked.map(({ key, score }) => ({ id: this.docId(key), score }));
  }

  /**
   * Page recent documents newest-first (by insertion `rowid`) — a plain enumeration companion to
   * {@link hybridSearch}, for a read-only consumer that wants "what's in here" rather than a ranked
   * query (e.g. an agent-memory inspector's `/memory` view). `limit`/`offset` are clamped, never
   * thrown on — a bad page request degrades to the default page rather than erroring a dev tool.
   */
  list(opts: ListOptions = {}): ListedDoc[] {
    const limit = clampListLimit(opts.limit);
    const offset = clampListOffset(opts.offset);
    const rows = this.db
      .prepare(
        "SELECT doc_id, text FROM docs ORDER BY rowid DESC LIMIT ? OFFSET ?",
      )
      .all(limit, offset) as { doc_id: string; text: string }[];
    return rows.map((r) => ({ id: r.doc_id, text: r.text }));
  }

  close(): void {
    this.db.close();
  }

  // --- internal ---

  private deleteRow(rowid: number): void {
    this.db.prepare("DELETE FROM docs_fts WHERE rowid = ?").run(rowid);
    this.db.prepare("DELETE FROM docs_vec WHERE rowid = ?").run(rowid);
    this.db.prepare("DELETE FROM docs WHERE rowid = ?").run(rowid);
  }

  /** Vector KNN leg → rowid→rank (1-based). Empty when no vector, no stored vectors, or a leg fault. */
  private vecLeg(
    queryVector: number[] | undefined,
    legLimit: number,
  ): Map<number, number> {
    const ranks = new Map<number, number>();
    if (queryVector === undefined) return ranks;
    if (queryVector.length !== this.dim) {
      throw new ValidationError("query embedding dimension mismatch", {
        expected: this.dim,
        received: queryVector.length,
      });
    }
    const count = (
      this.db.prepare("SELECT COUNT(*) AS n FROM docs_vec").get() as {
        n: number;
      }
    ).n;
    const k = Math.min(legLimit, count);
    if (k <= 0) return ranks;
    try {
      const rows = this.db
        .prepare(
          "SELECT rowid FROM docs_vec WHERE embedding MATCH ? AND k = ? ORDER BY distance ASC",
        )
        .all(new Float32Array(queryVector), k) as RowId[];
      rows.forEach((r, i) => ranks.set(r.rowid, i + 1));
    } catch {
      // Vec backend hiccup (e.g. extension fault) → degrade to FTS5-only (the available floor).
    }
    return ranks;
  }

  /** FTS5 leg → rowid→rank (1-based). Empty when the query is blank or fails to parse. */
  private ftsLeg(queryText: string, legLimit: number): Map<number, number> {
    const ranks = new Map<number, number>();
    if (!queryText.trim()) return ranks;
    try {
      const rows = this.db
        .prepare(
          "SELECT rowid FROM docs_fts WHERE docs_fts MATCH ? ORDER BY bm25(docs_fts) ASC LIMIT ?",
        )
        .all(sanitizeFts(queryText), legLimit) as RowId[];
      rows.forEach((r, i) => ranks.set(r.rowid, i + 1));
    } catch {
      // FTS parse error → skip this leg; the vec leg still contributes.
    }
    return ranks;
  }

  private docId(rowid: number): string {
    const row = this.db
      .prepare("SELECT doc_id FROM docs WHERE rowid = ?")
      .get(rowid) as { doc_id: string } | null;
    if (!row) throw new ValidationError("missing doc row for fused id");
    return row.doc_id;
  }
}

/**
 * Sanitize caller text into an FTS5 query that cannot inject operators: each whitespace-split
 * token becomes its own quoted phrase, OR-joined. Quoting the WHOLE query as one phrase (the
 * previous behavior) demanded the tokens appear adjacent in order — every natural-language
 * multi-word query ("refund policy", "how do I install") matched zero rows, silently killing
 * the FTS leg of hybrid retrieval. OR keeps recall high; bm25 still ranks multi-term matches
 * first.
 */
function sanitizeFts(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" OR ");
}
