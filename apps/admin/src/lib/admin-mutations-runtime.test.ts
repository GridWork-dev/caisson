// CAISSON-18: the WORM store env gate — bucket env set selects S3 Object-Lock, unset stays local.
import { afterEach, expect, test } from "bun:test";
import { LocalArtifactStore, S3ArtifactStore } from "@caisson/audit-worm";
import { wormStore } from "./admin-mutations-runtime.ts";

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
