// CAISSON-18: the WORM store env gate — bucket env set selects S3 Object-Lock, unset stays local.
// ADR-0278 CR-01/WR-01: registryIndex() must honor CAISSON_REGISTRY_INDEX_PATH — the Dockerfile's
// runtime ENV is what production actually reads, since Next standalone's chdir(__dirname) puts a
// bare process.cwd()-relative path outside the runtime image entirely (pins the fix CR-01 relies on).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "bun:test";
import { LocalArtifactStore, S3ArtifactStore } from "@caisson/audit-worm";
import { BUNDLE_IDS } from "@caisson/registry-schema";
import {
  denySetPublisher,
  grantableEntitlementIds,
  registryIndex,
  serializePublish,
  wormStore,
} from "./admin-mutations-runtime.ts";

const ORIGINAL_BUCKET = process.env.CAISSON_ADMIN_WORM_BUCKET;
afterEach(() => {
  if (ORIGINAL_BUCKET === undefined) {
    delete process.env.CAISSON_ADMIN_WORM_BUCKET;
  } else {
    process.env.CAISSON_ADMIN_WORM_BUCKET = ORIGINAL_BUCKET;
  }
});

test("CAISSON_ADMIN_WORM_BUCKET set selects the S3 Object-Lock store", () => {
  process.env.CAISSON_ADMIN_WORM_BUCKET = "caisson-worm-gate-test";
  expect(wormStore()).toBeInstanceOf(S3ArtifactStore);
});

test("a blank bucket env falls back to the local write-once store", () => {
  process.env.CAISSON_ADMIN_WORM_BUCKET = "   ";
  expect(wormStore()).toBeInstanceOf(LocalArtifactStore);
});

test("no bucket env falls back to the local write-once store", () => {
  delete process.env.CAISSON_ADMIN_WORM_BUCKET;
  expect(wormStore()).toBeInstanceOf(LocalArtifactStore);
});

test("production refuses to downgrade to ephemeral local WORM storage", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  delete process.env.CAISSON_ADMIN_WORM_BUCKET;
  process.env.NODE_ENV = "production";
  try {
    expect(() => wormStore()).toThrow(/required in production/);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("CAISSON_REGISTRY_INDEX_PATH is honored — cwd-independent, chdir-immune (CR-01)", () => {
  const dir = mkdtempSync(join(tmpdir(), "caisson-admin-index-test-"));
  const path = join(dir, "index.json");
  writeFileSync(
    path,
    JSON.stringify({
      schemaVersion: 1,
      modules: [
        {
          id: "@caisson/kernel",
          latest: "1.0.0",
          versions: [
            {
              version: "1.0.0",
              publishedAt: "2026-01-01T00:00:00.000Z",
              gateAttestation: "ci-run-1@deadbeef",
              manifest: {
                id: "@caisson/kernel",
                version: "1.0.0",
                kind: "base",
                tier: "oss",
                license: "Apache-2.0",
                priceCents: null,
                editions: [],
                description: "@caisson/kernel",
              },
            },
          ],
        },
      ],
    }),
  );
  const original = process.env.CAISSON_REGISTRY_INDEX_PATH;
  process.env.CAISSON_REGISTRY_INDEX_PATH = path;
  try {
    const index = registryIndex();
    expect(index.schemaVersion).toBe(1);
    expect(index.modules.map((m) => m.id)).toEqual(["@caisson/kernel"]);
  } finally {
    if (original === undefined) delete process.env.CAISSON_REGISTRY_INDEX_PATH;
    else process.env.CAISSON_REGISTRY_INDEX_PATH = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

const ORIGINAL_PUT_URL = process.env.CAISSON_REVOCATIONS_PUT_URL;
afterEach(() => {
  if (ORIGINAL_PUT_URL === undefined) {
    delete process.env.CAISSON_REVOCATIONS_PUT_URL;
  } else {
    process.env.CAISSON_REVOCATIONS_PUT_URL = ORIGINAL_PUT_URL;
  }
});

test("denySetPublisher is unprovisioned (undefined) until CAISSON_REVOCATIONS_PUT_URL is set", () => {
  delete process.env.CAISSON_REVOCATIONS_PUT_URL;
  expect(denySetPublisher()).toBeUndefined();
});

test("denySetPublisher rejects a non-HTTPS destination before exposing its bearer", () => {
  process.env.CAISSON_REVOCATIONS_PUT_URL = "http://example.test/revocations";
  expect(() => denySetPublisher()).toThrow(/HTTPS URL/);
});

// G38 (buyer-lifecycle audit 2026-07-07): serializePublish is the actual fix for the deny-set
// last-write-wins race — pin its two load-bearing properties directly rather than a real R2 PUT
// round trip (irrelevant to what changed).
test("G38: serializePublish runs enqueued attempts strictly in order, even when an earlier one is slower", async () => {
  const order: string[] = [];
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const first = serializePublish(async () => {
    await sleep(20);
    order.push("first");
  });
  // Enqueued second but would finish FIRST if unserialized (no delay) — proves ordering, not
  // just eventual completion.
  const second = serializePublish(async () => {
    order.push("second");
  });
  await Promise.all([first, second]);
  expect(order).toEqual(["first", "second"]);
});

test("G38: a failing publish attempt never wedges the chain — the next attempt still runs", async () => {
  const order: string[] = [];
  const first = serializePublish(async () => {
    order.push("first");
    throw new Error("simulated PUT failure");
  });
  const second = serializePublish(async () => {
    order.push("second");
  });
  await expect(first).rejects.toThrow("simulated PUT failure");
  await second;
  expect(order).toEqual(["first", "second"]);
});

// registryIndex() caches on first call for the life of the process (see its own doc comment), so
// this test asserts only on what holds true REGARDLESS of which index a sibling test in this same
// file already cached: every bundle id is present, sorted, and deduped — not the exact indexed
// module set (which depends on load order the cache makes untestable in isolation here).
test("grantableEntitlementIds (G42) includes every bundle id, sorted and deduped", () => {
  const ids = grantableEntitlementIds();
  for (const bundleId of BUNDLE_IDS) {
    expect(ids).toContain(bundleId);
  }
  expect(ids).toEqual([...ids].sort());
  expect(new Set(ids).size).toBe(ids.length);
});
