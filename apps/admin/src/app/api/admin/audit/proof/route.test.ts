// T-A2 (route) — the endpoint's auth + validation + fail-closed contract (binding #10, superset of
// CR-07's list). The pure redaction/receipt invariants live in lib/audit-proof.test.ts; this drives
// the real route through the PGlite double + a temp LocalArtifactStore WORM dir so the boundary and
// the WORM-read mapping are exercised end to end. Same one-registration auth-mock convention as every
// other admin route test (never a second `mock.module`).
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { AuditChainStore, LocalArtifactStore } from "@caisson/audit-worm";
import { canonicalize, chainEntry, type JsonValue } from "@caisson/kernel/node";
import { wormAnchorAccount } from "@caisson/service-license";
import { withTenant } from "@caisson/tenancy-rls";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "@/lib/admin-auth-mock";
import { getAdminDb } from "@/lib/admin-db";

const { GET } = await import("./route.ts");

let store: AuditChainStore;
let wormDir: string;
let pg: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

/** The `globalThis`-cached admin transactor (admin-db.ts) — reset so getAdminDb rebuilds under our env. */
type AdminDbGlobal = {
  caissonAdminTransactor?: unknown;
  caissonAdminPglite?: { close(): Promise<void> } | undefined;
};
const origDbUrl = process.env.CAISSON_ADMIN_DB_URL;
const origBucket = process.env.CAISSON_ADMIN_WORM_BUCKET;
const origWormDir = process.env.CAISSON_ADMIN_WORM_DIR;
let origTransactor: unknown;
let origPglite: AdminDbGlobal["caissonAdminPglite"];

beforeAll(async () => {
  // Hermetic setup, independent of the ambient env AND of which admin test cached the shared
  // transactor first. The operator box sets CAISSON_ADMIN_DB_URL (an unreachable Railway-internal
  // host) and CAISSON_ADMIN_WORM_BUCKET (a real S3 bucket); a broken pg Pool cached from either one
  // would DNS-fail every seed. Capture the prior cache so afterAll can restore it EXACTLY (leaving
  // sibling test files untouched), then force the in-memory PGlite double + a LocalArtifactStore this
  // test seeds and the route reads back.
  const adminGlobal = globalThis as AdminDbGlobal;
  origTransactor = adminGlobal.caissonAdminTransactor;
  origPglite = adminGlobal.caissonAdminPglite;
  delete process.env.CAISSON_ADMIN_DB_URL;
  delete process.env.CAISSON_ADMIN_WORM_BUCKET;
  adminGlobal.caissonAdminTransactor = undefined;
  adminGlobal.caissonAdminPglite = undefined;
  wormDir = await mkdtemp(join(tmpdir(), "caisson-proof-worm-"));
  process.env.CAISSON_ADMIN_WORM_DIR = wormDir; // the route's wormStore() reads this at call time
  const db = await getAdminDb();
  store = new AuditChainStore({ db, store: new LocalArtifactStore(wormDir) });
  pg = db as unknown as typeof pg;
});

afterAll(async () => {
  const adminGlobal = globalThis as AdminDbGlobal;
  const ownedPglite = adminGlobal.caissonAdminPglite;
  if (ownedPglite !== undefined && ownedPglite !== origPglite) {
    await ownedPglite.close();
  }
  await rm(wormDir, { recursive: true, force: true });
  // Restore the exact prior state so a sibling admin test file sees what it would have without us.
  if (origDbUrl !== undefined) process.env.CAISSON_ADMIN_DB_URL = origDbUrl;
  if (origBucket !== undefined)
    process.env.CAISSON_ADMIN_WORM_BUCKET = origBucket;
  if (origWormDir !== undefined)
    process.env.CAISSON_ADMIN_WORM_DIR = origWormDir;
  else delete process.env.CAISSON_ADMIN_WORM_DIR;
  adminGlobal.caissonAdminTransactor = origTransactor;
  adminGlobal.caissonAdminPglite = origPglite;
});

beforeEach(() => {
  setAdminAuthFixture(VERIFIED_ADMIN);
});

function get(account: string, seq: number | string): Promise<Response> {
  return GET(
    new Request(
      `http://admin.local/api/admin/audit/proof?account=${encodeURIComponent(
        String(account),
      )}&seq=${encodeURIComponent(String(seq))}`,
    ),
  );
}

/** Seed a real chain (entries + per-length WORM anchors) for a fresh random account; return its id. */
async function seed(
  payloads: JsonValue[],
  account: string = randomUUID(),
): Promise<string> {
  const anchorAccount = wormAnchorAccount(account);
  for (const p of payloads) await store.append(anchorAccount, p);
  return account;
}

describe("GET /api/admin/audit/proof (T-A1)", () => {
  test("operator non-allowlisted session -> 401 (fails closed before any WORM read)", async () => {
    setAdminAuthFixture(); // no verified session
    const res = await get(randomUUID(), 0);
    expect(res.status).toBe(401);
  });

  test("unknown query field -> 400 (the .strict() query boundary)", async () => {
    const account = randomUUID();
    const res = await GET(
      new Request(
        `http://admin.local/api/admin/audit/proof?account=${account}&seq=0&evil=x`,
      ),
    );
    expect(res.status).toBe(400);
  });

  test("path-fragment account -> 400 (client can't influence the WORM key)", async () => {
    const res = await get("../../etc/passwd", 0);
    expect(res.status).toBe(400);
  });

  test("seq out of range (== length and > length) -> 400 (L1), never a silent unverifiable", async () => {
    const account = await seed([{ event: "a" }, { event: "b" }]); // length 2, valid seq 0..1
    expect((await get(account, 2)).status).toBe(400);
    expect((await get(account, 3)).status).toBe(400);
  });

  test("healthy row -> 200 with a re-verifiable receipt, and the read is access-logged (M1)", async () => {
    const account = await seed([
      {
        event: "erasure.crypto-shred",
        deletion: { state: "soft-deleted", irreversible: false },
        method: "kms-key-deletion",
        tenantId: "tenant-1",
        subjectId: "subject-1",
        reason: "retention period elapsed",
        occurredAt: "2026-07-25T12:00:00.000Z",
        shreddedThroughVersion: 1,
      },
    ]);
    const res = await get(account, 0);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      receipt: { checks: { linkRecompute: string; anchorEquality: string } };
      chainLength: number;
    };
    expect(body.receipt.checks.linkRecompute).toBe("pass");
    expect(body.receipt.checks.anchorEquality).toBe("pass");
    expect(body.chainLength).toBe(1);

    const log = await pg.query(
      `SELECT action, target_account_id FROM admin_action_log WHERE action = 'audit_proof_read' AND target_account_id = $1`,
      [account],
    );
    expect(log.rows.length).toBeGreaterThan(0);
  });

  test("a real opaque better-auth account id resolves through the lazy proof route", async () => {
    const account = "k5G2mB9qL0xWc4vRt7nYs1uZp8dJh3fA";
    await seed([{ event: "created", actor: "buyer" }], account);

    const res = await get(account, 0);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { chainLength?: number };
    expect(body.chainLength).toBe(1);
  });

  test("redacted row -> 200 and no secret value crosses the wire (H3)", async () => {
    const account = await seed([{ user: "alice", password: "hunter2" }]);
    const res = await get(account, 0);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("hunter2");
    const body = JSON.parse(text) as { redacted: boolean };
    expect(body.redacted).toBe(true);
  });

  test("missing anchor for an in-range row -> 200 unverifiable (fail-closed, never a fabricated pass)", async () => {
    // Insert a valid genesis entry directly with NO WORM anchor, so the row is in range but its
    // per-length anchor is absent.
    const account = randomUUID();
    const db = await getAdminDb();
    const entry = chainEntry(null, { event: "orphan" });
    await withTenant(db, account, (tx) =>
      tx.query(
        `INSERT INTO audit_chain_entry (id, account_id, seq, prev_hash, payload, hash)
         VALUES ($1, $2, 0, NULL, $3::jsonb, $4)`,
        [randomUUID(), account, canonicalize({ event: "orphan" }), entry.hash],
      ),
    );
    const res = await get(account, 0);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state?: string };
    expect(body.state).toBe("unverifiable");
  });
});
