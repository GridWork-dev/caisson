// live/store.gcs.live.test.ts — the LIVE GCS Object Retention Lock proof (ADR-0267 + the ADR-0201
// live-test convention). Runs the REAL service-account OAuth exchange + REAL JSON API against a REAL
// bucket the stubs in `store.gcs.test.ts` can never vouch for: write-once via a true 412/409,
// construction's Object-Retention-Lock-enabled check against the bucket's real metadata, retention
// read back from a real object, and extend observed against a real PATCH.
//
// This file NEVER runs in the default suite: it lives OUTSIDE ./src (so `bun test ./src` and CI
// never run it) AND every test self-skips without prover creds (ADR-0201 live-test convention). Run
// it via `bun run test:live` with CAISSON_GCS_LIVE_BUCKET + GOOGLE_APPLICATION_CREDENTIALS (a
// service-account JSON key file path) scoped to a dedicated prover service account with
// `storage.admin` on the bucket, never product creds. The bucket must already have Object Retention
// Lock enabled (`gcloud storage buckets update gs://BUCKET --enable-per-object-retention` at
// creation time — this file does not provision infra, matching the S3 live proof's precedent).
//
// GOVERNANCE-equivalent ("Unlocked") mode with a minutes-long retention throughout — this driver
// never writes the irreversible "Locked" mode. Keys sit under a reserved proof tenant with a
// per-run UUID segment so re-runs never collide with a still-locked WORM key from a prior proof.
import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { ValidationError } from "@caisson-sh/kernel";
import { ArtifactExistsError, buildArtifactKey } from "../src/store.ts";
import {
  GcsArtifactStore,
  createGcsServiceAccountTransport,
  type GcsServiceAccountCredentials,
} from "../src/store.gcs.ts";

const BUCKET = process.env.CAISSON_GCS_LIVE_BUCKET ?? "";
const CREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
const HAVE_CREDS = BUCKET.length > 0 && CREDS_PATH.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const TIMEOUT = 30_000;

/** The reserved live-proof tenant (mirrors ADR-0201) — the lifecycle reaper on this prefix expires
 *  proof objects once their minutes-long retention lapses. */
const PROOF_ACCOUNT_ID = "00000000-0000-4000-8000-00000000c0de";
const RUN = randomUUID();
const KEY = buildArtifactKey(
  PROOF_ACCOUNT_ID,
  "live-proof",
  RUN,
  "evidence.bin",
);
const BODY = new TextEncoder().encode(`caisson worm gcs live proof ${RUN}`);

const RETAIN_PUT = new Date(Date.now() + 2 * 60_000);
const RETAIN_EXTENDED = new Date(Date.now() + 4 * 60_000);
const RETAIN_SHORTER = new Date(Date.now() + 1 * 60_000);
const TOLERANCE_MS = 5_000;

async function loadCredentials(): Promise<GcsServiceAccountCredentials> {
  const raw = await Bun.file(CREDS_PATH).text();
  const parsed = JSON.parse(raw) as {
    client_email?: string;
    private_key?: string;
  };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS does not look like a service-account JSON key",
    );
  }
  return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
}

// Constructed only when creds are present — every test below self-skips otherwise, so `store` is
// only ever read from within a running (non-skipped) test.
let store: GcsArtifactStore | undefined;
if (HAVE_CREDS) {
  const creds = await loadCredentials();
  const transport = createGcsServiceAccountTransport(creds);
  store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
}

function requireStore(): GcsArtifactStore {
  if (store === undefined) {
    throw new Error(
      "live GCS store not initialized — this test should have self-skipped",
    );
  }
  return store;
}

function expectClose(got: Date | undefined, want: Date): void {
  expect(got).toBeDefined();
  expect(Math.abs((got as Date).getTime() - want.getTime())).toBeLessThan(
    TOLERANCE_MS,
  );
}

describe("GCS WORM live proof — Object Retention Lock on the real bucket", () => {
  liveTest(
    "(a) put succeeds and head reads a real lock ≈ the requested retention",
    async () => {
      const meta = await requireStore().put(KEY, BODY, {
        retainUntil: RETAIN_PUT,
        contentType: "application/octet-stream",
      });
      expect(meta.size).toBe(BODY.byteLength);

      const head = await requireStore().head(KEY);
      expect(head).not.toBeNull();
      expectClose(head?.retainUntil, RETAIN_PUT);
    },
    TIMEOUT,
  );

  liveTest(
    "(b) a duplicate put of the SAME key is refused by a real precondition failure — write-once",
    async () => {
      await expect(
        requireStore().put(KEY, BODY, { retainUntil: RETAIN_PUT }),
      ).rejects.toBeInstanceOf(ArtifactExistsError);
    },
    TIMEOUT,
  );

  liveTest(
    "(c) extendRetention lands a later date on the real lock (read back via head)",
    async () => {
      const meta = await requireStore().extendRetention(KEY, RETAIN_EXTENDED);
      expect(meta.retainUntil).toEqual(RETAIN_EXTENDED);

      const head = await requireStore().head(KEY);
      expectClose(head?.retainUntil, RETAIN_EXTENDED);
    },
    TIMEOUT,
  );

  liveTest(
    "(d) shortening is refused — never-shorten observed against a real metadata read",
    async () => {
      await expect(
        requireStore().extendRetention(KEY, RETAIN_SHORTER),
      ).rejects.toBeInstanceOf(ValidationError);

      const head = await requireStore().head(KEY);
      expectClose(head?.retainUntil, RETAIN_EXTENDED);
    },
    TIMEOUT,
  );
});
