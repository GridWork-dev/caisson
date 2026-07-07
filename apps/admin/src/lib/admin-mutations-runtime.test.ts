// CAISSON-18: the WORM store env gate — bucket env set selects S3 Object-Lock, unset stays local.
// ADR-0278 CR-01/WR-01: registryIndex() must honor CAISSON_REGISTRY_INDEX_PATH — the Dockerfile's
// runtime ENV is what production actually reads, since Next standalone's chdir(__dirname) puts a
// bare process.cwd()-relative path outside the runtime image entirely (pins the fix CR-01 relies on).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "bun:test";
import { LocalArtifactStore, S3ArtifactStore } from "@caisson/audit-worm";
import { registryIndex, wormStore } from "./admin-mutations-runtime.ts";

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
