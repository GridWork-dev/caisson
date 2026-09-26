// live/store.s3.live.test.ts — the LIVE S3 WORM proof (ADR-0201 + the ADR-0202 escalation legs).
// Runs the REAL transport against the REAL Object-Lock bucket the stubs can never vouch for:
// write-once via a true 412, retention read back from a real lock, extend observed against real
// GetObjectRetention, and never-shorten refused against the real current date.
//
// This file NEVER runs in the default suite: it lives OUTSIDE ./src (so `bun test ./src` and CI
// never run it) AND every test self-skips without prover creds (ADR-0201 live-test convention).
// Run it via `bun run test:live` with CAISSON_WORM_LIVE_BUCKET + AWS creds scoped to a dedicated
// prover policy, never product creds.
//
// GOVERNANCE mode with a minutes-long retention throughout: COMPLIANCE is never live-tested
// (irreversible objects; the ADR-0051 typed opt-in + production gate stands). Keys sit under the
// reserved proof tenant with a per-run UUID segment so re-runs never collide with still-locked
// WORM keys from a prior proof.
import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ValidationError } from "@caisson-sh/kernel";
import { ArtifactExistsError, buildArtifactKey } from "../src/store.ts";
import { S3ArtifactStore } from "../src/store.s3.ts";

const BUCKET = process.env.CAISSON_WORM_LIVE_BUCKET ?? "";
const HAVE_CREDS =
  BUCKET.length > 0 && (process.env.AWS_ACCESS_KEY_ID ?? "").length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const TIMEOUT = 30_000;

/** The reserved live-proof tenant (ADR-0201) — a fixed UUID outside any
 *  real account space; the provisioner's lifecycle reaper expires versions under this prefix. */
const PROOF_ACCOUNT_ID = "00000000-0000-4000-8000-00000000c0de";
/** Fresh per-run segment: WORM keys are write-once, so a re-run must never reuse a key. */
const RUN = randomUUID();
const KEY = buildArtifactKey(
  PROOF_ACCOUNT_ID,
  "live-proof",
  RUN,
  "evidence.bin",
);
const BODY = new TextEncoder().encode(`caisson worm live proof ${RUN}`);

// Minutes-long GOVERNANCE retention (ADR-0201): long enough that every leg observes a live lock,
// short enough that the lifecycle reaper clears the proof prefix by tomorrow.
const RETAIN_PUT = new Date(Date.now() + 2 * 60_000);
const RETAIN_EXTENDED = new Date(Date.now() + 4 * 60_000);
const RETAIN_SHORTER = new Date(Date.now() + 1 * 60_000);
/** S3 round-trips RetainUntilDate to the second — compare within a small tolerance. */
const TOLERANCE_MS = 5_000;

const client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
// Constructor demands a non-empty bucket even when every test skips — placeholder is never used.
const store = new S3ArtifactStore({
  client,
  bucket: HAVE_CREDS ? BUCKET : "caisson-worm-live-skipped",
}); // mode defaults to GOVERNANCE

function expectClose(got: Date | undefined, want: Date): void {
  expect(got).toBeDefined();
  expect(Math.abs((got as Date).getTime() - want.getTime())).toBeLessThan(
    TOLERANCE_MS,
  );
}

describe("S3 WORM live proof — GOVERNANCE Object Lock on the real bucket", () => {
  liveTest(
    "(a) put succeeds and head reads a real lock ≈ the requested retention",
    async () => {
      const meta = await store.put(KEY, BODY, {
        retainUntil: RETAIN_PUT,
        contentType: "application/octet-stream",
      });
      expect(meta.size).toBe(BODY.byteLength);

      const head = await store.head(KEY);
      expect(head).not.toBeNull();
      expectClose(head?.retainUntil, RETAIN_PUT);
    },
    TIMEOUT,
  );

  liveTest(
    "(b) a duplicate put of the SAME key is refused by a real 412 — the write-once proof",
    async () => {
      await expect(
        store.put(KEY, BODY, { retainUntil: RETAIN_PUT }),
      ).rejects.toBeInstanceOf(ArtifactExistsError);
    },
    TIMEOUT,
  );

  liveTest(
    "(c) extendRetention lands a later date on the real lock (read back via head)",
    async () => {
      const meta = await store.extendRetention(KEY, RETAIN_EXTENDED);
      expect(meta.retainUntil).toBe(RETAIN_EXTENDED);

      const head = await store.head(KEY);
      expectClose(head?.retainUntil, RETAIN_EXTENDED);
    },
    TIMEOUT,
  );

  liveTest(
    "(d) shortening is refused — never-shorten observed against real GetObjectRetention",
    async () => {
      await expect(
        store.extendRetention(KEY, RETAIN_SHORTER),
      ).rejects.toBeInstanceOf(ValidationError);

      // The real lock still carries the extended date — nothing weakened.
      const head = await store.head(KEY);
      expectClose(head?.retainUntil, RETAIN_EXTENDED);
    },
    TIMEOUT,
  );

  liveTest(
    "(e) best-effort cleanup: versioned delete with governance bypass (denied ⇒ reaper owns it)",
    async () => {
      try {
        const listed = await client.send(
          new ListObjectVersionsCommand({
            Bucket: BUCKET,
            Prefix: `${PROOF_ACCOUNT_ID}/live-proof/${RUN}/`,
          }),
        );
        for (const v of listed.Versions ?? []) {
          if (v.Key === undefined || v.VersionId === undefined) continue;
          await client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET,
              Key: v.Key,
              VersionId: v.VersionId,
              BypassGovernanceRetention: true,
            }),
          );
        }
      } catch {
        // A denied bypass (or any cleanup failure) must NOT fail the proof: the provisioner's
        // lifecycle reaper expires proof-prefix versions ~1 day after the minutes-long retention
        // lapses — leftovers are self-cleaning by design.
      }
    },
    TIMEOUT,
  );
});
