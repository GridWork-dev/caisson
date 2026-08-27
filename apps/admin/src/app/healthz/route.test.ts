// Tests for apps/admin/src/app/healthz/route.ts's registry-index digest field (CAISSON-37 F-1
// residual — the admin leg of registry/scripts/index-parity-probe.ts's three-way parity check).
//
// ADR-0416 ruling 1 made this path answer ahead of both edge layers so Railway's internal probe
// can reach it, which means an unauthenticated raw *.up.railway.app caller reaches it too. The
// digest is therefore conditioned on the origin secret: authenticated callers (everything through
// the Worker, including the parity probe) still get it; the raw origin gets liveness only.
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "bun:test";
import { GET } from "./route.ts";

const ORIGINAL_PATH = process.env.CAISSON_REGISTRY_INDEX_PATH;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_SECRET = process.env.ORIGIN_SECRET;
const ORIGINAL_MODE = process.env.ORIGIN_SECRET_MODE;

const SECRET = Buffer.alloc(32, 0x41).toString("base64url");
const WRONG = Buffer.alloc(32, 0x43).toString("base64url");

function restore(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

afterEach(() => {
  restore("CAISSON_REGISTRY_INDEX_PATH", ORIGINAL_PATH);
  restore("NODE_ENV", ORIGINAL_NODE_ENV);
  restore("ORIGIN_SECRET", ORIGINAL_SECRET);
  restore("ORIGIN_SECRET_MODE", ORIGINAL_MODE);
});

/** Arm the gate at exactly the deployed configuration: production, no mode opt-out, secret set. */
function armGate(): void {
  Reflect.set(process.env, "NODE_ENV", "production");
  Reflect.set(process.env, "ORIGIN_SECRET", SECRET);
  Reflect.deleteProperty(process.env, "ORIGIN_SECRET_MODE");
}

function bakeIndex(): { path: string; dir: string; body: string } {
  const dir = mkdtempSync(join(tmpdir(), "caisson-admin-healthz-test-"));
  const path = join(dir, "index.json");
  const body = JSON.stringify({
    schemaVersion: 1,
    modules: [{ id: "@caisson/kernel", latest: "1.0.0" }],
  });
  writeFileSync(path, body);
  process.env.CAISSON_REGISTRY_INDEX_PATH = path;
  return { path, dir, body };
}

function probe(secret?: string): Request {
  return new Request("https://admin.caisson.sh/healthz", {
    headers: secret === undefined ? {} : { "x-gridwork-origin-secret": secret },
  });
}

test("an origin-authenticated caller gets the sha256-first-12-hex digest + entry count", async () => {
  const { dir, body } = bakeIndex();
  armGate();
  try {
    const res = GET(probe(SECRET));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      indexDigest?: string;
      indexEntries?: number;
    };
    expect(json.ok).toBe(true);
    expect(json.indexDigest).toBe(
      createHash("sha256").update(body).digest("hex").slice(0, 12),
    );
    expect(json.indexEntries).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the unauthenticated raw-origin class gets liveness ONLY, never the digest", async () => {
  // This is the field ADR-0416 ruling 1 names: the carve admits the raw *.up.railway.app origin,
  // and `indexDigest` there is an information leak. The index is present and readable — so a pass
  // here cannot come from the file simply being missing, which is the other way these fields
  // vanish (see the unreadable-path test below).
  const { dir } = bakeIndex();
  armGate();
  try {
    for (const [label, req] of [
      ["no header", probe()],
      ["wrong secret", probe(WRONG)],
    ] as const) {
      const res = GET(req);
      expect(res.status).toBe(200);
      expect({ label, body: await res.json() }).toEqual({
        label,
        body: { ok: true },
      });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unreadable index path omits the digest fields without failing readiness", async () => {
  process.env.CAISSON_REGISTRY_INDEX_PATH = join(
    tmpdir(),
    "does-not-exist-caisson-index.json",
  );
  armGate();
  const res = GET(probe(SECRET));
  expect(res.status).toBe(200);
  const json = (await res.json()) as { ok: boolean; indexDigest?: string };
  expect(json.ok).toBe(true);
  expect(json.indexDigest).toBeUndefined();
});
