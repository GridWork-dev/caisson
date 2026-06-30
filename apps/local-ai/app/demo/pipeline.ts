// apps/local-ai/app/demo/pipeline.ts — the Local-first AI edition reference DEMO (T22, ADR-0044).
//
// This is the P4a exit artifact's engine: ONE offline, zero-egress pass that COMPOSES the shipped
// edition (`@caisson/local-ai`) end-to-end — it builds no new product module and imports no provider
// SDK. The route handler (`app/api/demo/route.ts`) and the RSC page (`app/page.tsx`) are thin wrappers
// over `runDemo()`; `pipeline.test.ts` is the CI proof that the demo returns hybrid results with zero
// outbound fetch (the verify clause), exercised deterministically under Bun — no live server needed.
//
// Every Database instance comes from the edition's file-per-tenant seam (`openTenantDb` / `AtRestStore`);
// `bun:sqlite` is imported TYPE-ONLY (erased at compile), so the Next bundler never sees a runtime
// `bun:sqlite` import — the native store stays inside the externalized `@caisson/*` packages.
//
// The five demonstrated guarantees map 1:1 to the SPEC exit gate:
//   1. hybrid sqlite-vec + FTS5 RRF retrieval (and the FTS-only degrade) — the literal ADR-0064 gate;
//   2. two-way sync convergence (LWW/CRDT + tombstone, no resurrection) over a test-doubled transport;
//   3. offline Ed25519 license verify — valid → pro, tampered/absent → community (fail-safe);
//   4. zero egress — the privacy gate blocks every host (empty allowlist), and the whole pass fetches 0×;
//   5. at-rest field-crypto + file-per-tenant isolation — a tenant-B context cannot open a tenant-A row.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import {
  AtRestStore,
  ChangesetLog,
  DerivedKeyProvider,
  EMBEDDING_DIM,
  LocalStore,
  StubInferenceBackend,
  ZERO_EGRESS_POLICY,
  assembleEditionMigrations,
  canonicalize,
  createEgressGuard,
  openTenantDb,
  parseChangeset,
  reconcileWithTombstones,
  tenantDbPath,
  verifyLicense,
  type Changeset,
  type JsonValue,
  type RowValues,
  type Tombstone,
} from "@caisson/local-ai";

/**
 * The one-line reconciliation for the `specs/01` §2 doc-tension. `specs/01-architecture.md` (lines
 * 43–44) says the execution plane uses "hosted inference via API (no local models)" — that governs the
 * SELLER PLATFORM's Python plane (support-bot + buyers' optional cloud workers), NOT this buyer-side
 * edition, which ships REAL on-device models behind a zero-egress gate ("your data never leaves the device").
 */
export const RECONCILIATION_NOTE =
  "specs/01 §2 'hosted inference via API (no local models)' governs the SELLER platform's Python execution plane (support-bot + buyers' optional cloud workers) — not this buyer-side local-first edition, which runs real on-device models behind a zero-egress gate.";

/** The two seeded tenant files (the file-per-tenant isolation boundary, ADR-0073). */
const TENANTS = ["tenant-a", "tenant-b"] as const;

/** A tiny retrieval corpus. `QUERY` matches exactly one doc by keyword so the demo is deterministic. */
const CORPUS: readonly { id: string; text: string }[] = [
  { id: "d1", text: "Local-first offline notes never leave the device" },
  {
    id: "d2",
    text: "Hybrid retrieval fuses vector similarity and keyword ranking",
  },
  {
    id: "d3",
    text: "Two-way sync converges replicas with last-writer-wins reconciliation",
  },
  { id: "d4", text: "Field-level encryption seals sensitive columns at rest" },
];
const QUERY = "encryption"; // FTS5 phrase-matches only d4 → deterministic top hit.

/** A sensitive value sealed at rest under a per-tenant derived key (never stored as plaintext). */
const SECRET = "patient SSN 123-45-6789";

/**
 * A real PRODUCTION-signed `pro`/`local-ai` license token (minted offline with the issuer's private
 * key; a license token is public-safe — its detached signature reveals nothing about the private key,
 * which never ships). Verifies against the production public key baked into `@caisson/license-verify`
 * (ADR-0108). Used to demonstrate a valid offline verify with zero network. Keep in sync with that key.
 */
const PRO_TOKEN =
  "CAISSON-PRO-eyJlbnRpdGxlbWVudHMiOlsibG9jYWwtYWkiXSwiZXhwaXJ5IjpudWxsLCJsaWNlbnNlSWQiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJtYWpvciI6MSwidGllciI6InBybyJ9JCCq8unU9ASs7NpgsOQSFpKl6Bti7J41yCKbLV8-1q0HbeUzZ-K7cfdaBge2_gyn38fKvEomzkH35GRQ0RbFBA";

/** Flip the final character → a tampered token whose Ed25519 signature no longer verifies. */
const TAMPERED_TOKEN =
  PRO_TOKEN.slice(0, -1) + (PRO_TOKEN.endsWith("Q") ? "R" : "Q");

// ── result shape (a serializable summary the route returns + the page renders) ──────────────────────

/** One fused retrieval hit surfaced to the demo UI. */
export interface DemoHit {
  readonly id: string;
  readonly score: number;
}

/** A converged synced row (canonical payload bytes) shown after the two-replica round-trip. */
export interface DemoSyncRow {
  readonly tbl: string;
  readonly pk: string;
  readonly payload: string;
}

/** The full demo summary — every field is plain JSON so the route can `Response.json` it. */
export interface DemoResult {
  readonly ok: boolean;
  readonly embeddingDim: number;
  readonly schemaVersion: string;
  readonly tenants: readonly string[];
  readonly privacy: { readonly mode: string; readonly egressBlocked: boolean };
  readonly retrieval: {
    readonly query: string;
    readonly hybridTop: string | null;
    readonly hybridCount: number;
    readonly ftsOnlyTop: string | null;
    readonly ftsOnlyCount: number;
    readonly hits: readonly DemoHit[];
  };
  readonly atRest: {
    readonly sealedPreview: string;
    readonly roundTrip: boolean;
    readonly crossTenantBlocked: boolean;
  };
  readonly license: {
    readonly valid: {
      readonly valid: boolean;
      readonly tier: string;
      readonly entitlements: readonly string[];
    };
    readonly tampered: string;
    readonly absent: string;
  };
  readonly sync: {
    readonly converged: boolean;
    readonly rows: readonly DemoSyncRow[];
    readonly tombstones: readonly string[];
  };
  readonly reconciliationNote: string;
}

/**
 * An in-process replica of ONE tenant over a real per-tenant SQLite file (one file per simulated
 * device). The canonical local store is the authority: `put`/`remove` mutate the materialized
 * `synced_rows` table AND mirror the change into the `ChangesetLog`; `integrate` reconciles a peer
 * changeset toward the local set over the persisted tombstones and re-materializes the table. A
 * monotonic injected clock stamps each write deterministically (no wall clock).
 */
class Replica {
  readonly #db: Database;
  readonly #log: ChangesetLog;
  #clock = 0;
  #tombstones: readonly Tombstone[] = [];

  constructor(db: Database, tenantId: string) {
    this.#db = db;
    this.#db.exec(
      "CREATE TABLE IF NOT EXISTS synced_rows (tbl TEXT NOT NULL, pk TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (tbl, pk))",
    );
    this.#log = ChangesetLog.open(this.#db, tenantId, {
      now: () => this.#clock,
    });
  }

  put(table: string, pk: string, values: RowValues, at: number): void {
    this.#clock = at;
    this.#db
      .prepare(
        "INSERT INTO synced_rows (tbl, pk, payload) VALUES (?, ?, ?) ON CONFLICT (tbl, pk) DO UPDATE SET payload = excluded.payload",
      )
      .run(table, pk, canonicalize(values));
    this.#log.recordUpsert(table, pk, values);
  }

  remove(table: string, pk: string, at: number): void {
    this.#clock = at;
    this.#db
      .prepare("DELETE FROM synced_rows WHERE tbl = ? AND pk = ?")
      .run(table, pk);
    this.#log.recordDelete(table, pk);
  }

  capture(): Changeset {
    return this.#log.capture(0);
  }

  integrate(peer: Changeset): void {
    this.#log.assertApplicable(peer);
    const mine = this.#log.capture(0);
    const { live, tombstones } = reconcileWithTombstones(this.#tombstones, [
      mine,
      peer,
    ]);
    this.#tombstones = tombstones;
    this.#db.transaction(() => {
      this.#db.exec("DELETE FROM synced_rows");
      const insert = this.#db.prepare(
        "INSERT INTO synced_rows (tbl, pk, payload) VALUES (?, ?, ?)",
      );
      for (const row of live)
        insert.run(row.table, row.pk, canonicalize(row.values));
    })();
  }

  tombstones(): readonly Tombstone[] {
    return this.#tombstones;
  }

  snapshot(): string {
    const rows = this.#db
      .prepare("SELECT tbl, pk, payload FROM synced_rows ORDER BY tbl, pk")
      .all() as DemoSyncRow[];
    const value: JsonValue = rows.map((r) => ({
      tbl: r.tbl,
      pk: r.pk,
      payload: r.payload,
    }));
    return canonicalize(value);
  }

  close(): void {
    this.#db.close();
  }
}

/**
 * The TEST-DOUBLE transport: serialize a captured changeset and re-parse it through the fail-closed
 * peer boundary (`parseChangeset`) on receive — exactly the validation a real transport owes, entirely
 * in-process. No socket, no fetch, no live network (CI-safe).
 */
function transport(cs: Changeset): Changeset {
  const wire: unknown = JSON.parse(JSON.stringify(cs));
  return parseChangeset(wire);
}

/**
 * The local-deployment key provider for at-rest field-crypto. Prefers a real master secret from the
 * environment (`MASTER_FIELD_KEY` / `FIELD_CRYPTO_SALT`); otherwise a labelled, deterministic DEMO
 * vector (NOT a production secret) so the reference app runs zero-config. Either way the master key is
 * read once and never logged (`DerivedKeyProvider` keeps it private).
 */
function demoProvider(
  env: Record<string, string | undefined>,
): DerivedKeyProvider {
  if (
    env.MASTER_FIELD_KEY !== undefined &&
    env.FIELD_CRYPTO_SALT !== undefined
  ) {
    return DerivedKeyProvider.fromEnv(env);
  }
  // A fixed 32-byte demo master + salt (clearly a reference vector, never a real secret).
  const masterKey = Buffer.alloc(32, 0xa1);
  const salt = Buffer.alloc(32, 0xb2);
  return new DerivedKeyProvider(masterKey, salt);
}

/**
 * Run the whole edition offline in one pass and return a serializable summary. Each tenant is seeded
 * into its own SQLite file (at-rest sealed secret + retrieval docs), then: tenant-A is hybrid-queried,
 * the at-rest round-trip + cross-tenant block are checked, an offline license is verified three ways,
 * two device replicas converge over a test-doubled transport, and the zero-egress gate is asserted.
 * Pure-offline + deterministic: makes ZERO outbound fetches (proven by `pipeline.test.ts`).
 */
export async function runDemo(
  env: Record<string, string | undefined> = process.env,
): Promise<DemoResult> {
  const dataRoot = mkdtempSync(join(tmpdir(), "caisson-local-ai-data-"));
  const deviceARoot = mkdtempSync(join(tmpdir(), "caisson-local-ai-devA-"));
  const deviceBRoot = mkdtempSync(join(tmpdir(), "caisson-local-ai-devB-"));

  try {
    const backend = new StubInferenceBackend(); // deterministic, offline, dim = EMBEDDING_DIM
    const atRest = new AtRestStore(dataRoot, demoProvider(env));

    // 1) Seed BOTH tenant files: at-rest sealed secret first (plain connection, before any vec0 table),
    //    then the retrieval docs via LocalStore (which loads sqlite-vec + creates the vec0 + FTS5 tables).
    for (const tenant of TENANTS) {
      const db = atRest.openDb(tenant);
      db.exec(
        "CREATE TABLE IF NOT EXISTS secrets (id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
      );
      db.prepare(
        "INSERT OR REPLACE INTO secrets (id, payload) VALUES (?, ?)",
      ).run(
        "note",
        atRest.seal(tenant, "note.secret", `${tenant} secret: ${SECRET}`),
      );
      db.close();

      const store = LocalStore.open({
        dim: EMBEDDING_DIM,
        path: tenantDbPath(dataRoot, tenant),
      });
      for (const doc of CORPUS) {
        const embedding = Array.from(await backend.embed(doc.text));
        store.upsert({ id: doc.id, text: doc.text, embedding });
      }
      store.close();
    }

    // 2) Hybrid retrieval on tenant-A (the literal ADR-0064 gate) + the FTS5-only degrade path.
    const storeA = LocalStore.open({
      dim: EMBEDDING_DIM,
      path: tenantDbPath(dataRoot, "tenant-a"),
    });
    const queryVector = Array.from(await backend.embed(QUERY));
    const hybrid = storeA.hybridSearch({
      queryText: QUERY,
      queryVector,
      limit: 10,
    });
    const ftsOnly = storeA.hybridSearch({ queryText: QUERY, limit: 10 });
    storeA.close();

    // 3) At-rest round-trip + cross-tenant isolation (TM-REST): tenant-A opens its own sealed row;
    //    a tenant-B context CANNOT open tenant-A's ciphertext (AEAD auth-fail → throws → blocked).
    const dbA = atRest.openDb("tenant-a");
    const storedRow = dbA
      .prepare("SELECT payload FROM secrets WHERE id = 'note'")
      .get() as { payload: string } | null;
    const sealedA = storedRow?.payload ?? "";
    const opened = storedRow
      ? atRest.open("tenant-a", "note.secret", storedRow.payload)
      : "";
    const roundTrip = opened === `tenant-a secret: ${SECRET}`;
    let crossTenantBlocked = false;
    try {
      atRest.open("tenant-b", "note.secret", sealedA);
    } catch {
      crossTenantBlocked = true; // a tenant-B context cannot decrypt a tenant-A row
    }
    dbA.close();

    // 4) Offline Ed25519 license verify (TM-LIC) — valid → pro; tampered + absent → community.
    const valid = verifyLicense(PRO_TOKEN);
    const tampered = verifyLicense(TAMPERED_TOKEN);
    const absent = verifyLicense(null);

    // 5) Two-way sync convergence (TM-SYNC) over two device replicas + a test-doubled transport.
    const a = new Replica(openTenantDb(deviceARoot, "tenant-a"), "tenant-a");
    const b = new Replica(openTenantDb(deviceBRoot, "tenant-a"), "tenant-a");
    a.put("docs", "n1", { title: "n1-A", v: 1 }, 2000);
    a.put("docs", "n2", { title: "n2-A" }, 2001);
    a.put("docs", "n4", { title: "n4-A" }, 2002);
    a.remove("docs", "n4", 2010); // A deletes n4 @2010 …
    b.put("docs", "n1", { title: "n1-B", v: 11 }, 2020); // B's newer n1 wins
    b.put("docs", "n3", { title: "n3-B" }, 2021);
    b.put("docs", "n4", { title: "n4-B" }, 2005); // … B's stale n4 upsert loses → stays deleted
    a.integrate(transport(b.capture()));
    b.integrate(transport(a.capture()));
    const converged = a.snapshot() === b.snapshot();
    const syncRows = JSON.parse(a.snapshot()) as DemoSyncRow[];
    const tombstones = a.tombstones().map((t) => `${t.table}/${t.pk}`);
    a.close();
    b.close();

    // 6) Zero-egress gate: the empty-allowlist policy blocks EVERY host (fail-closed-to-offline).
    const guard = createEgressGuard(ZERO_EGRESS_POLICY);
    let egressBlocked = false;
    try {
      guard.assertAllowed("https://huggingface.co/models/minilm");
    } catch {
      egressBlocked = true;
    }

    const hybridTop = hybrid[0]?.id ?? null;
    const ftsOnlyTop = ftsOnly[0]?.id ?? null;

    const ok =
      hybridTop === "d4" &&
      ftsOnlyTop === "d4" &&
      hybrid.length > ftsOnly.length &&
      roundTrip &&
      crossTenantBlocked &&
      valid.valid &&
      valid.tier === "pro" &&
      tampered.tier === "community" &&
      absent.tier === "community" &&
      converged &&
      tombstones.includes("docs/n4") &&
      egressBlocked;

    return {
      ok,
      embeddingDim: EMBEDDING_DIM,
      schemaVersion: assembleEditionMigrations(EMBEDDING_DIM).schemaVersion,
      tenants: [...TENANTS],
      privacy: { mode: ZERO_EGRESS_POLICY.privacy, egressBlocked },
      retrieval: {
        query: QUERY,
        hybridTop,
        hybridCount: hybrid.length,
        ftsOnlyTop,
        ftsOnlyCount: ftsOnly.length,
        hits: hybrid.map((h) => ({ id: h.id, score: h.score })),
      },
      atRest: {
        sealedPreview: `${sealedA.slice(0, 24)}…`,
        roundTrip,
        crossTenantBlocked,
      },
      license: {
        valid: {
          valid: valid.valid,
          tier: valid.tier,
          entitlements: valid.entitlements,
        },
        tampered: tampered.tier,
        absent: absent.tier,
      },
      sync: { converged, rows: syncRows, tombstones },
      reconciliationNote: RECONCILIATION_NOTE,
    };
  } finally {
    for (const root of [dataRoot, deviceARoot, deviceBRoot]) {
      rmSync(root, { recursive: true, force: true });
    }
  }
}
