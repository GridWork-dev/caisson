// src/store.ts — local hybrid retrieval (ADR-0067). Raw `bun:sqlite` over sqlite-vec `vec0`
// (FLOAT[N], dimension fixed at table creation) + FTS5, fused by Reciprocal Rank Fusion (RRF_K=60).
// The FTS5 path is ALWAYS available; when no query vector is supplied — or the vec leg is
// missing/fails — retrieval degrades to FTS5-only and still returns. Rebuilt CLEAN from the PUBLIC
// gridwork-core `memory-vec.ts` `hybridSearch` PATTERN (RRF_K=60, vec0 + FTS5 → degrade); the
// embedding that produces a vector is an INJECTED SEAM — this module never calls a model, opens no
// socket, and is deterministic for a fixed input (golden-pinned at `src/__golden__/rrf-ranking.json`).
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { ValidationError } from "@caisson/kernel";

/** RRF constant — standard 60; dampens the weight of any single ranking (gridwork-core parity). */
export const RRF_K = 60;

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
}

/** A fused result: the document id and its RRF score (higher = better). */
export interface SearchHit {
  id: string;
  score: number;
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

  /**
   * Hybrid retrieval: rank by vector KNN and by FTS5 independently, then fuse by RRF. The vec leg is
   * skipped when no `queryVector` is given and is caught-and-skipped on a backend failure (degrade to
   * FTS5-only, the always-available floor); the FTS leg runs whenever `queryText` is non-empty. A
   * query vector of the wrong dimension is an explicit caller error and THROWS.
   */
  hybridSearch(opts: HybridSearchOptions): SearchHit[] {
    const limit = opts.limit ?? 10;
    const legLimit = Math.max(limit * 8, 50);

    const vecRanks = this.vecLeg(opts.queryVector, legLimit);
    const ftsRanks = this.ftsLeg(opts.queryText, legLimit);

    // RRF fusion: every leg a doc appears in contributes 1/(RRF_K + rank); sum across legs.
    const fused = new Map<number, number>();
    for (const [rowid, rank] of vecRanks)
      fused.set(rowid, (fused.get(rowid) ?? 0) + 1 / (RRF_K + rank));
    for (const [rowid, rank] of ftsRanks)
      fused.set(rowid, (fused.get(rowid) ?? 0) + 1 / (RRF_K + rank));

    const ranked = [...fused.entries()]
      // score descending; deterministic tie-break by rowid ascending (stable, env-free).
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, limit);
    if (ranked.length === 0) return [];

    return ranked.map(([rowid, score]) => ({ id: this.docId(rowid), score }));
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

/** Wrap the query as an FTS5 phrase string literal so caller text cannot inject FTS operators. */
function sanitizeFts(query: string): string {
  return `"${query.trim().replace(/"/g, '""')}"`;
}
