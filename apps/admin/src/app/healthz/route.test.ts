// Tests for apps/admin/src/app/healthz/route.ts's registry-index digest field (CAISSON-37 F-1
// residual — the admin leg of registry/scripts/index-parity-probe.ts's three-way parity check).
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "bun:test";
import {
  markAuthMigrationFailed,
  markAuthMigrationOk,
} from "../../lib/admin-boot-state.ts";
import { GET } from "./route.ts";

const ORIGINAL_PATH = process.env.CAISSON_REGISTRY_INDEX_PATH;
afterEach(() => {
  if (ORIGINAL_PATH === undefined) {
    delete process.env.CAISSON_REGISTRY_INDEX_PATH;
  } else {
    process.env.CAISSON_REGISTRY_INDEX_PATH = ORIGINAL_PATH;
  }
  markAuthMigrationOk();
});

test("reports the sha256-first-12-hex digest + entry count of the baked index", async () => {
  const dir = mkdtempSync(join(tmpdir(), "caisson-admin-healthz-test-"));
  const path = join(dir, "index.json");
  const body = JSON.stringify({
    schemaVersion: 1,
    modules: [{ id: "@caisson/kernel", latest: "1.0.0" }],
  });
  writeFileSync(path, body);
  process.env.CAISSON_REGISTRY_INDEX_PATH = path;
  try {
    const res = GET();
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

test("an unreadable index path omits the digest fields without failing readiness", async () => {
  process.env.CAISSON_REGISTRY_INDEX_PATH = join(
    tmpdir(),
    "does-not-exist-caisson-index.json",
  );
  const res = GET();
  expect(res.status).toBe(200);
  const json = (await res.json()) as { ok: boolean; indexDigest?: string };
  expect(json.ok).toBe(true);
  expect(json.indexDigest).toBeUndefined();
});

test("a failed boot migration still reports 503 regardless of the index digest", () => {
  markAuthMigrationFailed();
  const res = GET();
  expect(res.status).toBe(503);
});
