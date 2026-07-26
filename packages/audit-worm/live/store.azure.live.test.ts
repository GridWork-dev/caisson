// LIVE Azure Blob version-level WORM contract (ADR-0379/0380). This file is outside `src`, so it
// never runs in the default suite; each test also self-skips without a dedicated container SAS URL.
// The adapter still receives an injected SDK client — ambient credentials are read only by this
// opt-in prover. The dedicated container must have blob versioning and version-level immutability.
import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { ContainerClient } from "@azure/storage-blob";
import { ArtifactExistsError, buildArtifactKey } from "../src/store.ts";
import {
  AzureBlobArtifactStore,
  type AzureBlobContainerClient,
} from "../src/store.azure.ts";

const CONTAINER_URL = process.env.CAISSON_AZURE_BLOB_LIVE_CONTAINER_URL ?? "";
const HAVE_CREDENTIAL = CONTAINER_URL.startsWith("https://");
const liveTest = test.skipIf(!HAVE_CREDENTIAL);
const PROOF_ACCOUNT_ID = "00000000-0000-4000-8000-00000000c0de";
const RUN = randomUUID();
const KEY = buildArtifactKey(
  PROOF_ACCOUNT_ID,
  "live-proof",
  RUN,
  "evidence.bin",
);
const BODY = new TextEncoder().encode(`caisson azure worm proof ${RUN}`);
const RETAIN = new Date(Date.now() + 5 * 60_000);
const LATER = new Date(Date.now() + 10 * 60_000);

function liveClient(): AzureBlobContainerClient {
  if (!HAVE_CREDENTIAL) {
    throw new Error("Azure live test should have self-skipped");
  }
  return new ContainerClient(CONTAINER_URL);
}

describe("Azure Blob WORM live proof", () => {
  liveTest(
    "create-only write, exact-version read, and monotonic extension hold on the real service",
    async () => {
      const store = await AzureBlobArtifactStore.create({
        client: liveClient(),
      });
      const written = await store.put(KEY, BODY, {
        retainUntil: RETAIN,
        contentType: "application/octet-stream",
      });
      expect(written.versionId).toBeDefined();

      const exact = await store.get(KEY, written.versionId);
      expect([...exact.body]).toEqual([...BODY]);
      expect(exact.versionId).toBe(written.versionId);

      await expect(
        store.put(KEY, BODY, { retainUntil: RETAIN }),
      ).rejects.toBeInstanceOf(ArtifactExistsError);

      const extended = await store.extendRetention(
        KEY,
        LATER,
        written.versionId,
      );
      expect(extended.versionId).toBe(written.versionId);
      expect(extended.retainUntil?.getTime()).toBeGreaterThanOrEqual(
        LATER.getTime(),
      );
      await expect(
        store.extendRetention(KEY, RETAIN, written.versionId),
      ).rejects.toThrow(/strictly later/);
    },
    30_000,
  );
});
