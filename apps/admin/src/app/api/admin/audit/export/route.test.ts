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
import { wormAnchorAccount } from "@caisson/service-license";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "@/lib/admin-auth-mock";
import { getAdminDb } from "@/lib/admin-db";
import { buildAdminAuditWindow } from "@/lib/audit-window";

const { GET } = await import("./route.ts");

type AdminDbGlobal = { caissonAdminTransactor?: unknown };
const originalDbUrl = process.env.CAISSON_ADMIN_DB_URL;
const originalBucket = process.env.CAISSON_ADMIN_WORM_BUCKET;
const originalWormDir = process.env.CAISSON_ADMIN_WORM_DIR;
let originalTransactor: unknown;
let wormDir: string;
let store: AuditChainStore;

beforeAll(async () => {
  originalTransactor = (globalThis as AdminDbGlobal).caissonAdminTransactor;
  delete process.env.CAISSON_ADMIN_DB_URL;
  delete process.env.CAISSON_ADMIN_WORM_BUCKET;
  (globalThis as AdminDbGlobal).caissonAdminTransactor = undefined;
  wormDir = await mkdtemp(join(tmpdir(), "caisson-audit-export-"));
  process.env.CAISSON_ADMIN_WORM_DIR = wormDir;
  const db = await getAdminDb();
  store = new AuditChainStore({
    db,
    store: new LocalArtifactStore(wormDir),
  });
});

afterAll(async () => {
  await rm(wormDir, { recursive: true, force: true });
  if (originalDbUrl === undefined) delete process.env.CAISSON_ADMIN_DB_URL;
  else process.env.CAISSON_ADMIN_DB_URL = originalDbUrl;
  if (originalBucket === undefined)
    delete process.env.CAISSON_ADMIN_WORM_BUCKET;
  else process.env.CAISSON_ADMIN_WORM_BUCKET = originalBucket;
  if (originalWormDir === undefined) delete process.env.CAISSON_ADMIN_WORM_DIR;
  else process.env.CAISSON_ADMIN_WORM_DIR = originalWormDir;
  (globalThis as AdminDbGlobal).caissonAdminTransactor = originalTransactor;
});

beforeEach(() => {
  setAdminAuthFixture(VERIFIED_ADMIN);
});

function get(accountId: string): Promise<Response> {
  return GET(
    new Request(
      `http://admin.local/api/admin/audit/export?account=${encodeURIComponent(accountId)}`,
    ),
  );
}

describe("GET /api/admin/audit/export", () => {
  test("requires a verified admin session", async () => {
    setAdminAuthFixture();

    expect((await get(randomUUID())).status).toBe(401);
  });

  test("returns buildEvidencePack's file map and sha256 verbatim", async () => {
    const tenantId = "buyer_account_01";
    const anchorAccountId = wormAnchorAccount(tenantId);
    await store.append(anchorAccountId, {
      event: "first",
      credentials: { token: "secret-a" },
    });
    await store.append(anchorAccountId, {
      event: "second",
      credentials: { token: "secret-b" },
    });

    const response = await get(tenantId);
    const body = (await response.json()) as {
      files: readonly { name: string; contents: string }[];
      sha256: string;
    };
    const receipts = body.files.find((file) => file.name === "receipts.json");
    expect(receipts).toBeDefined();
    const generatedAt = (
      JSON.parse(receipts!.contents) as { generatedAt: string }
    ).generatedAt;
    const expected = await buildAdminAuditWindow({
      source: store,
      accountId: anchorAccountId,
      tenantId,
      now: new Date(generatedAt),
    });

    expect(response.status).toBe(200);
    expect(body).toEqual(expected.evidencePack);
    expect(body.sha256).toBe(expected.evidencePack?.sha256);
    expect(JSON.stringify(body)).not.toContain("secret-a");
    expect(JSON.stringify(body)).not.toContain("secret-b");
  });

  test("rejects unknown query fields and returns 404 for an absent chain", async () => {
    const accountId = randomUUID();
    const invalid = await GET(
      new Request(
        `http://admin.local/api/admin/audit/export?account=${accountId}&extra=x`,
      ),
    );

    expect(invalid.status).toBe(400);
    expect((await get(accountId)).status).toBe(404);
  });
});
