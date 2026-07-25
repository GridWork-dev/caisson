import { createHmac, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import type { JsonValue } from "@caisson/kernel";
import { wormAnchorAccount } from "@caisson/service-license";
import { getAdminDb } from "@/lib/admin-db";
import { readLatestEvidencePack } from "@/lib/evidence-pack-pointer";
import { createInternalProofRoute } from "./route.ts";

const PROXY_SECRET = "test-proof-proxy-secret-with-32-bytes";

type AdminDbGlobal = { caissonAdminTransactor?: unknown };
const originalDbUrl = process.env.CAISSON_ADMIN_DB_URL;
const originalBucket = process.env.CAISSON_ADMIN_WORM_BUCKET;
const originalWormDir = process.env.CAISSON_ADMIN_WORM_DIR;
const originalProxySecret = process.env.CAISSON_PROOF_PROXY_SECRET;
const originalEvidencePackRoot = process.env.CAISSON_EVIDENCE_PACK_ROOT;
let originalTransactor: unknown;
let wormDir: string;
let evidencePackRoot: string;
let store: AuditChainStore;
let POST: ReturnType<typeof createInternalProofRoute>;

function accountCredential(accountId: string): string {
  return createHmac("sha256", PROXY_SECRET).update(accountId).digest("hex");
}

function request(
  accountId: string,
  body: unknown,
  credential: string | null = accountCredential(accountId),
): Request {
  const headers = new Headers({
    "content-type": "application/json",
    "x-caisson-account-id": accountId,
  });
  if (credential !== null) {
    headers.set("authorization", `Bearer ${credential}`);
  }
  return new Request("http://admin.internal/api/internal/audit/proof", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function seed(
  accountId: string,
  payloads: readonly JsonValue[],
): Promise<void> {
  for (const payload of payloads) await store.append(accountId, payload);
}

async function seedLatestEvidencePack(
  accountId: string,
  overrides: { readonly manifestPath?: string } = {},
): Promise<void> {
  const accountDir = join(evidencePackRoot, wormAnchorAccount(accountId));
  await mkdir(join(accountDir, "packs"), { recursive: true });
  const golden = JSON.parse(
    await readFile(
      new URL(
        "../../../../../../../../packages/compliance-core/src/__golden__/evidence-pack.manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Record<string, unknown>;
  golden.tenantId = accountId;
  await writeFile(
    join(accountDir, "packs", "pack.json"),
    JSON.stringify(golden),
  );
  await writeFile(
    join(accountDir, "latest.json"),
    JSON.stringify({
      formatVersion: "1",
      manifestPath: overrides.manifestPath ?? "packs/pack.json",
      sha256: "a".repeat(64),
      generatedAt: "2026-07-25T18:00:00.000Z",
    }),
  );
}

beforeAll(async () => {
  originalTransactor = (globalThis as AdminDbGlobal).caissonAdminTransactor;
  delete process.env.CAISSON_ADMIN_DB_URL;
  delete process.env.CAISSON_ADMIN_WORM_BUCKET;
  (globalThis as AdminDbGlobal).caissonAdminTransactor = undefined;
  wormDir = await mkdtemp(join(tmpdir(), "caisson-internal-proof-"));
  evidencePackRoot = await mkdtemp(
    join(tmpdir(), "caisson-evidence-pack-pointer-"),
  );
  process.env.CAISSON_ADMIN_WORM_DIR = wormDir;
  process.env.CAISSON_EVIDENCE_PACK_ROOT = evidencePackRoot;
  process.env.CAISSON_PROOF_PROXY_SECRET = PROXY_SECRET;
  const db = await getAdminDb();
  store = new AuditChainStore({
    db,
    store: new LocalArtifactStore(wormDir),
  });
  POST = createInternalProofRoute({
    proxySecret: () => process.env.CAISSON_PROOF_PROXY_SECRET,
    getMutationDeps: async () => ({ worm: store }),
    readLatestEvidencePack,
  });
});

afterAll(async () => {
  await rm(wormDir, { recursive: true, force: true });
  await rm(evidencePackRoot, { recursive: true, force: true });
  if (originalDbUrl === undefined) delete process.env.CAISSON_ADMIN_DB_URL;
  else process.env.CAISSON_ADMIN_DB_URL = originalDbUrl;
  if (originalBucket === undefined)
    delete process.env.CAISSON_ADMIN_WORM_BUCKET;
  else process.env.CAISSON_ADMIN_WORM_BUCKET = originalBucket;
  if (originalWormDir === undefined) delete process.env.CAISSON_ADMIN_WORM_DIR;
  else process.env.CAISSON_ADMIN_WORM_DIR = originalWormDir;
  if (originalProxySecret === undefined)
    delete process.env.CAISSON_PROOF_PROXY_SECRET;
  else process.env.CAISSON_PROOF_PROXY_SECRET = originalProxySecret;
  if (originalEvidencePackRoot === undefined)
    delete process.env.CAISSON_EVIDENCE_PACK_ROOT;
  else process.env.CAISSON_EVIDENCE_PACK_ROOT = originalEvidencePackRoot;
  (globalThis as AdminDbGlobal).caissonAdminTransactor = originalTransactor;
});

beforeEach(() => {
  process.env.CAISSON_PROOF_PROXY_SECRET = PROXY_SECRET;
});

describe("POST /api/internal/audit/proof", () => {
  test("returns a redacted proof for an authenticated, account-bound internal request", async () => {
    const accountId = randomUUID();
    await seed(accountId, [{ event: "created", token: "never-crosses" }]);

    const response = await POST(request(accountId, { seq: 0 }));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain("never-crosses");
    expect(JSON.parse(text)).toMatchObject({
      redacted: true,
      chainLength: 1,
      receipt: {
        seq: 0,
        checks: { linkRecompute: "na", anchorEquality: "pass" },
      },
    });
  });

  test("derives the WORM tenant key from an opaque session account id", async () => {
    const accountId = "internal_proof_buyer_account_01";
    await seed(wormAnchorAccount(accountId), [{ event: "created" }]);

    const response = await POST(request(accountId, { seq: 0 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      chainLength: 1,
      receipt: { seq: 0 },
    });
  });

  test("fails closed for a missing or invalid service credential", async () => {
    const accountId = randomUUID();
    await seed(accountId, [{ event: "created" }]);

    expect((await POST(request(accountId, { seq: 0 }, null))).status).toBe(401);
    expect(
      (await POST(request(accountId, { seq: 0 }, "0".repeat(64)))).status,
    ).toBe(401);
  });

  test("rejects client-supplied account fields at the strict body boundary", async () => {
    const accountId = randomUUID();
    await seed(accountId, [{ event: "created" }]);

    const response = await POST(
      request(accountId, { seq: 0, accountId: randomUUID() }),
    );

    expect(response.status).toBe(400);
  });

  test("refuses a credential bound to another account", async () => {
    const accountA = randomUUID();
    const accountB = randomUUID();
    await seed(accountA, [{ event: "account-a-only" }]);
    await seed(accountB, [{ event: "account-b-only" }]);

    const response = await POST(
      request(accountB, { seq: 0 }, accountCredential(accountA)),
    );
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).not.toContain("account-a-only");
    expect(text).not.toContain("account-b-only");
  });

  test("maps an absent tenant chain to a redaction-safe 404", async () => {
    const response = await POST(request(randomUUID(), { seq: 0 }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
  });

  test("fails closed when the proxy secret is missing", async () => {
    const accountId = randomUUID();
    await seed(accountId, [{ event: "created" }]);
    delete process.env.CAISSON_PROOF_PROXY_SECRET;

    const response = await POST(request(accountId, { seq: 0 }));

    expect(response.status).toBe(503);
  });

  test("resolves the authenticated account's persisted latest evidence-pack pointer", async () => {
    const accountId = "buyer_account_01";
    await seedLatestEvidencePack(accountId);

    const response = await POST(
      request(accountId, { kind: "latest-evidence-pack" }),
    );
    const body = (await response.json()) as {
      kind: string;
      sha256: string;
      generatedAt: string;
      manifest: { tenantId: string; crosswalkRollup: { cells: unknown[] } };
    };

    expect(response.status).toBe(200);
    expect(body.kind).toBe("latest-evidence-pack");
    expect(body.sha256).toBe("a".repeat(64));
    expect(body.generatedAt).toBe("2026-07-25T18:00:00.000Z");
    expect(body.manifest.tenantId).toBe(accountId);
    expect(body.manifest.crosswalkRollup.cells.length).toBeGreaterThan(0);
  });

  test("never resolves another account's latest evidence pack", async () => {
    const accountA = "buyer_account_a";
    const accountB = "buyer_account_b";
    await seedLatestEvidencePack(accountA);

    const response = await POST(
      request(accountB, { kind: "latest-evidence-pack" }),
    );

    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain(accountA);
  });

  test("fails closed when a persisted pointer escapes its account directory", async () => {
    const accountId = "buyer_account_escape";
    await seedLatestEvidencePack(accountId, {
      manifestPath: "../other-account/pack.json",
    });

    const response = await POST(
      request(accountId, { kind: "latest-evidence-pack" }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "proof unavailable" });
  });
});
