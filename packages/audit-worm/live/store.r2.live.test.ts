// live/store.r2.live.test.ts — the LIVE R2 bucket-lock proof (ADR-0267 + the ADR-0201 live-test
// convention). Runs the REAL S3-compatible data plane + REAL Cloudflare bucket-lock REST API
// against a REAL bucket the fakes in `store.r2.test.ts` can never vouch for: write-once via a true
// conditional-write rejection, construction's real lock-rule fetch + coverage check, and — the one
// defect class only a live call can catch — the fail-closed bound evaluated against Cloudflare's
// REAL lock-rules JSON shape rather than our own test fixtures.
//
// This file NEVER runs in the default suite: it lives OUTSIDE ./src (so `bun test ./src` and CI
// never run it) AND every test self-skips without prover creds (ADR-0201 live-test convention). Run
// it via `bun run test:live` with CAISSON_R2_LIVE_BUCKET + CLOUDFLARE_ACCOUNT_ID +
// CLOUDFLARE_API_TOKEN (scoped to Edit on the bucket's lock configuration) + R2_ACCESS_KEY_ID +
// R2_SECRET_ACCESS_KEY (R2 S3-API credentials), all scoped to a dedicated prover setup, never
// product creds. The bucket must already carry an enabled bucket-lock rule covering the proof
// prefix (`wrangler r2 bucket lock add` or the dashboard — this file does not provision infra,
// matching the S3/GCS live proofs' precedent).
import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { ConfigError } from "@caisson-sh/kernel";
import { ArtifactExistsError, buildArtifactKey } from "../src/store.ts";
import { R2ArtifactStore, createR2LockReader } from "../src/store.r2.ts";

const BUCKET = process.env.CAISSON_R2_LIVE_BUCKET ?? "";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const HAVE_CREDS =
  BUCKET.length > 0 &&
  ACCOUNT_ID.length > 0 &&
  API_TOKEN.length > 0 &&
  ACCESS_KEY_ID.length > 0 &&
  SECRET_ACCESS_KEY.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const TIMEOUT = 30_000;

const PROOF_ACCOUNT_ID = "00000000-0000-4000-8000-00000000c0de";
const RUN = randomUUID();
const KEY = buildArtifactKey(
  PROOF_ACCOUNT_ID,
  "live-proof",
  RUN,
  "evidence.bin",
);
const BODY = new TextEncoder().encode(`caisson worm r2 live proof ${RUN}`);
const RETAIN_PUT = new Date(Date.now() + 2 * 60_000);

let store: R2ArtifactStore | undefined;
if (HAVE_CREDS) {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });
  const lockReader = createR2LockReader({
    accountId: ACCOUNT_ID,
    bucket: BUCKET,
    apiToken: API_TOKEN,
  });
  store = await R2ArtifactStore.create({ client, bucket: BUCKET, lockReader });
}

function requireStore(): R2ArtifactStore {
  if (store === undefined) {
    throw new Error(
      "live R2 store not initialized — this test should have self-skipped",
    );
  }
  return store;
}

describe("R2 WORM live proof — bucket-lock rules on the real bucket", () => {
  liveTest(
    "(a) construction's real lock-rule fetch covers the proof prefix, and put succeeds",
    async () => {
      const meta = await requireStore().put(KEY, BODY, {
        retainUntil: RETAIN_PUT,
        contentType: "application/octet-stream",
      });
      expect(meta.size).toBe(BODY.byteLength);
      const head = await requireStore().head(KEY);
      expect(head).not.toBeNull();
    },
    TIMEOUT,
  );

  liveTest(
    "(b) a duplicate put of the SAME key is refused by a real conditional-write rejection",
    async () => {
      await expect(
        requireStore().put(KEY, BODY, { retainUntil: RETAIN_PUT }),
      ).rejects.toBeInstanceOf(ArtifactExistsError);
    },
    TIMEOUT,
  );

  liveTest(
    "(c) a retainUntil far beyond any realistic rule horizon is refused BEFORE any write — the " +
      "fail-closed bound proven against Cloudflare's REAL lock-rules response shape",
    async () => {
      const freshKey = buildArtifactKey(
        PROOF_ACCOUNT_ID,
        "live-proof",
        RUN,
        "over-horizon.bin",
      );
      const farFuture = new Date(Date.UTC(9999, 0, 1));
      await expect(
        requireStore().put(freshKey, BODY, { retainUntil: farFuture }),
      ).rejects.toBeInstanceOf(ConfigError);
      const head = await requireStore().head(freshKey);
      // Refused before any write — the key was never actually created.
      expect(head).toBeNull();
    },
    TIMEOUT,
  );
});
