// Real-package parity for the retention-runner poke's browser mirror (retention-runner-logic.ts).
// No `__golden__` fixture dir exists for @caisson/retention-runner, so parity runs directly against
// the real package's own functions, imported here by relative path (apps/site does not declare
// @caisson/retention-runner as a workspace dependency — see retention-runner-logic.ts's header for
// why the real files aren't imported into the client bundle). Bun's test runtime is node-like, so
// the real package's `@caisson/kernel` (node:crypto / node:dns) imports resolve fine here even
// though they cannot reach a browser bundle.
import { describe, expect, test } from "bun:test";

import { createCaptureAuditSink as pkgCreateCaptureAuditSink } from "../../../../packages/retention-runner/src/audit-sink.ts";
import {
  createCascadeDbTarget as pkgCreateCascadeDbTarget,
  createObjectStorageTarget as pkgCreateObjectStorageTarget,
  createOrphanSweepTarget as pkgCreateOrphanSweepTarget,
} from "../../../../packages/retention-runner/src/targets.ts";
import { runErasure as pkgRunErasure } from "../../../../packages/retention-runner/src/run-erasure.ts";
import { ERASURE_REASONS as pkgErasureReasons } from "../../../../packages/retention-runner/src/types.ts";
import { ERASURE_CRYPTO_SHRED as pkgErasureCryptoShred } from "../../../../packages/field-crypto/src/crypto-shred.ts";

import {
  ERASURE_CRYPTO_SHRED,
  ERASURE_REASONS,
  REFERENCE_TARGET_NAMES,
  createCaptureAuditSink,
  createSampleTarget,
  runErasure,
} from "./retention-runner-logic";
import type { ErasureRequest } from "./retention-runner-logic";

const SAMPLE_REQUEST: ErasureRequest = {
  subjectId: "sub_9f21",
  tenantId: "ten_launchco",
  reason: "ccpa_request",
};

describe("ERASURE_REASONS — parity with the real package", () => {
  test("matches types.ts's ERASURE_REASONS exactly, in order", () => {
    expect(ERASURE_REASONS).toEqual(pkgErasureReasons);
  });
});

describe("REFERENCE_TARGET_NAMES — parity with the real reference drivers' hardcoded names", () => {
  test("matches the name each real factory assigns its target", () => {
    const client = {
      purge: async () => {},
      cascadeDelete: async () => {},
      sweep: async () => {},
    };
    const real = [
      pkgCreateObjectStorageTarget({ client }).name,
      pkgCreateCascadeDbTarget({ client }).name,
      pkgCreateOrphanSweepTarget({ client }).name,
    ];
    expect(real).toEqual([...REFERENCE_TARGET_NAMES] as string[]);
  });
});

describe("ERASURE_CRYPTO_SHRED — parity with the real field-crypto constant", () => {
  test("matches crypto-shred.ts's exported event name", () => {
    expect(ERASURE_CRYPTO_SHRED).toBe(pkgErasureCryptoShred);
    expect(ERASURE_CRYPTO_SHRED).toBe("erasure.crypto-shred");
  });
});

describe("runErasure — clean run parity with the real package", () => {
  test("mirror and real package produce the identical audit row on the same clean inputs", async () => {
    const mySink = createCaptureAuditSink();
    const myTargets = REFERENCE_TARGET_NAMES.map((name) =>
      createSampleTarget(name, false),
    );
    const myRow = await runErasure(
      SAMPLE_REQUEST,
      myTargets,
      mySink,
      () => 1_000,
    );

    const realSink = pkgCreateCaptureAuditSink();
    const client = {
      purge: async () => {},
      cascadeDelete: async () => {},
      sweep: async () => {},
    };
    const realTargets = [
      pkgCreateObjectStorageTarget({ client }),
      pkgCreateCascadeDbTarget({ client }),
      pkgCreateOrphanSweepTarget({ client }),
    ];
    const realRow = await pkgRunErasure(
      SAMPLE_REQUEST,
      realTargets,
      realSink,
      () => 1_000,
    );

    expect(myRow).toEqual(realRow);
    expect(mySink.rows).toEqual([myRow]);
    expect(realSink.rows).toEqual([realRow]);
  });

  test("writes exactly one reason-tagged audit row per run, matching the real package", async () => {
    const mySink = createCaptureAuditSink();
    const targets = REFERENCE_TARGET_NAMES.map((name) =>
      createSampleTarget(name, false),
    );
    await runErasure(SAMPLE_REQUEST, targets, mySink, () => 2_000);
    expect(mySink.rows).toHaveLength(1);
    expect(mySink.rows[0]).toMatchObject({ reason: "ccpa_request" });
  });
});

describe("runErasure — per-target error isolation, parity with the real package", () => {
  test("one failing target never aborts the run; the mirror matches the real package's shape", async () => {
    const mySink = createCaptureAuditSink();
    const myTargets = [
      createSampleTarget("object-storage-purge", false),
      createSampleTarget("cascade-db-delete", true),
      createSampleTarget("orphan-record-sweep", false),
    ];
    const myRow = await runErasure(
      SAMPLE_REQUEST,
      myTargets,
      mySink,
      () => 3_000,
    );

    expect(myRow.results).toEqual([
      { target: "object-storage-purge", ok: true },
      {
        target: "cascade-db-delete",
        ok: false,
        error: "cascade-db-delete: store unreachable",
      },
      { target: "orphan-record-sweep", ok: true },
    ]);
    // Isolation held: exactly one row still landed despite the failing target.
    expect(mySink.rows).toHaveLength(1);

    // Real package: the same shape, via a target that rejects (run-erasure.test.ts's own pattern).
    const realSink = pkgCreateCaptureAuditSink();
    const client = {
      purge: async () => {},
      cascadeDelete: async () => {},
      sweep: async () => {},
    };
    const failingCascade = {
      name: "cascade-db-delete",
      erase: () =>
        Promise.reject(new Error("cascade-db-delete: store unreachable")),
    };
    const realRow = await pkgRunErasure(
      SAMPLE_REQUEST,
      [
        pkgCreateObjectStorageTarget({ client }),
        failingCascade,
        pkgCreateOrphanSweepTarget({ client }),
      ],
      realSink,
      () => 3_000,
    );

    expect(myRow).toEqual(realRow);
  });

  test("all three targets failing still lands exactly one row", async () => {
    const sink = createCaptureAuditSink();
    const targets = REFERENCE_TARGET_NAMES.map((name) =>
      createSampleTarget(name, true),
    );
    const row = await runErasure(SAMPLE_REQUEST, targets, sink, () => 4_000);
    expect(row.results.every((r) => !r.ok)).toBe(true);
    expect(sink.rows).toHaveLength(1);
  });
});
