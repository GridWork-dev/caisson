// Integration proof for the checkpoint handler (CR-16 / CR-02, ADR-0332). Real outbox on PGlite + a
// LocalArtifactStore WORM double + the deterministic StubTrustedTimestampLog + a fake anchor reader.
// Proves: one tick writes a grade-tagged WORM receipt at an assertSafeKey-valid key; a second tick is
// a no-op (skip-if-receipted, no second submit); an interrupted `submitted` row resolves to
// needs_reconcile without resubmitting; and a receipt-persist failure after a successful submit also
// resolves to needs_reconcile.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
setDefaultTimeout(30_000);
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { assertSafeKey, type ArtifactStore } from "./store.ts";
import { LocalArtifactStore } from "./store.local.ts";
import { ANCHOR_OUTBOX_SCHEMA_SQL, AnchorOutbox } from "./anchor-outbox.ts";
import {
  anchorReceiptSchema,
  sha256Hex,
  StubTrustedTimestampLog,
  type AnchorOutboxKey,
  type AnchorSubmitReceipt,
  type TimestampReceipt,
  type TransparencyLog,
  type TransparencyTarget,
  type TrustedTimestampLog,
} from "./anchor-transparency.ts";
import { rekorEntryToReceipt } from "./anchor-rekor.ts";
import {
  runAnchorCheckpoint,
  type AnchorCheckpointDeps,
  type CurrentAnchorReader,
} from "./anchor-checkpoint.ts";

let tp: TestPg;
let outbox: AnchorOutbox;
let tmpDir: string;
let store: LocalArtifactStore;

const TARGET: TransparencyTarget = {
  kind: "tsa",
  url: "https://tsa.example/tsr",
  grade: "trusted-timestamped",
};
const FIXED_NOW = (): Date => new Date("2026-07-13T00:00:00.000Z");

/** A reader that always returns the same fixed anchor for a tenant. */
function fixedReader(bytes: Uint8Array, length: number): CurrentAnchorReader {
  return {
    readCurrentAnchor: () =>
      Promise.resolve({ length, anchorBytes: Uint8Array.from(bytes) }),
  };
}

/** Counts submit() calls so "no second submit" is directly assertable. */
class CountingLog implements TrustedTimestampLog {
  calls = 0;
  readonly #inner = new StubTrustedTimestampLog({ now: new Date(0) });
  submit(anchorBytes: Uint8Array): Promise<TimestampReceipt> {
    this.calls += 1;
    return this.#inner.submit(anchorBytes);
  }
}

function deps(
  reader: CurrentAnchorReader,
  log: TrustedTimestampLog,
  overrideStore?: ArtifactStore,
): AnchorCheckpointDeps {
  return {
    store: overrideStore ?? store,
    outbox,
    log,
    reader,
    target: TARGET,
    now: FIXED_NOW,
  };
}

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ANCHOR_OUTBOX_SCHEMA_SQL);
  outbox = new AnchorOutbox(tp.pg);
  tmpDir = await mkdtemp(join(tmpdir(), "anchor-checkpoint-"));
  store = new LocalArtifactStore(tmpDir);
}, 120_000);

afterAll(async () => {
  if (tp) await tp.close();
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe("runAnchorCheckpoint — happy path + idempotency", () => {
  test("one tick writes a grade-tagged WORM receipt; a second tick is a no-op", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":3,"tipHash":"${acct}"}`);
    const log = new CountingLog();

    const first = await runAnchorCheckpoint(
      acct,
      deps(fixedReader(bytes, 3), log),
    );
    expect(first.status).toBe("receipted");
    if (first.status !== "receipted") throw new Error("unreachable");

    // the receipt key is a valid WORM key at the expected layout
    expect(first.receiptKey).toBe(
      `${acct}/audit-chain/receipts/000000000003.tsa.json`,
    );
    expect(assertSafeKey(first.receiptKey).key).toBe(first.receiptKey);

    // the WORM object exists and decodes to a schema-valid, grade-tagged receipt
    const obj = await store.get(first.receiptKey);
    const receipt = anchorReceiptSchema.parse(
      JSON.parse(new TextDecoder().decode(obj.body)),
    );
    expect(receipt.grade).toBe("trusted-timestamped");
    expect(receipt.anchorLength).toBe(3);
    expect(receipt.anchorDigest).toBe(sha256Hex(bytes));
    // Narrow the receipt union to the RFC-3161 member for this TSA target.
    if (receipt.receipt.algorithm !== "rfc3161") {
      throw new Error("expected an rfc3161 receipt for a TSA target");
    }
    expect(receipt.receipt.messageImprint).toBe(sha256Hex(bytes));

    // outbox row is terminal receipted
    const key: AnchorOutboxKey = {
      accountId: acct,
      target: "tsa",
      anchorLength: 3,
      anchorDigest: sha256Hex(bytes),
    };
    expect((await outbox.get(key))?.state).toBe("receipted");

    // second tick: skip-if-receipted, and the log is NEVER called again
    const second = await runAnchorCheckpoint(
      acct,
      deps(fixedReader(bytes, 3), log),
    );
    expect(second.status).toBe("skipped");
    expect(log.calls).toBe(1);
  });

  test("a tenant with no chain is 'empty' — nothing submitted", async () => {
    const acct = randomUUID();
    const log = new CountingLog();
    const emptyReader: CurrentAnchorReader = {
      readCurrentAnchor: () => Promise.resolve(null),
    };
    const r = await runAnchorCheckpoint(acct, deps(emptyReader, log));
    expect(r.status).toBe("empty");
    expect(log.calls).toBe(0);
  });

  test("persists the receipt version and uses it for the next exact-version presence check", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":4,"tipHash":"${acct}"}`);
    const log = new CountingLog();
    const headVersions: Array<string | undefined> = [];
    const versioned: ArtifactStore = {
      async put(key, body, opts) {
        const meta = await store.put(key, body, opts);
        return { ...meta, versionId: "receipt-version-4" };
      },
      get: (key) => store.get(key),
      async head(key, versionId) {
        headVersions.push(versionId);
        return store.head(key);
      },
      extendRetention: (key, date) => store.extendRetention(key, date),
    };

    const checkpointDeps = deps(fixedReader(bytes, 4), log, versioned);
    expect((await runAnchorCheckpoint(acct, checkpointDeps)).status).toBe(
      "receipted",
    );
    expect((await runAnchorCheckpoint(acct, checkpointDeps)).status).toBe(
      "skipped",
    );
    expect(headVersions.at(-1)).toBe("receipt-version-4");

    const key: AnchorOutboxKey = {
      accountId: acct,
      target: "tsa",
      anchorLength: 4,
      anchorDigest: sha256Hex(bytes),
    };
    expect((await outbox.get(key))?.receiptVersionId).toBe("receipt-version-4");
  });

  test("a legacy receipt without a recorded provider identity is surfaced for reconciliation", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":9,"tipHash":"${acct}"}`);
    const log = new CountingLog();
    const reader = fixedReader(bytes, 9);

    expect((await runAnchorCheckpoint(acct, deps(reader, log))).status).toBe(
      "receipted",
    );

    const versioned: ArtifactStore = {
      put: store.put.bind(store),
      get: store.get.bind(store),
      async head(key, versionId) {
        void versionId;
        const meta = await store.head(key);
        return meta === null ? null : { ...meta, versionId: "legacy-current" };
      },
      extendRetention: store.extendRetention.bind(store),
    };

    expect(
      (await runAnchorCheckpoint(acct, deps(reader, log, versioned))).status,
    ).toBe("needs_reconcile");

    const key: AnchorOutboxKey = {
      accountId: acct,
      target: "tsa",
      anchorLength: 9,
      anchorDigest: sha256Hex(bytes),
    };
    expect((await outbox.get(key))?.state).toBe("needs_reconcile");
    expect(log.calls).toBe(1);
  });
});

describe("runAnchorCheckpoint — CR-02 crash windows resolve to needs_reconcile", () => {
  test("a pre-existing submitted row is reconciled, never resubmitted", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":5,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    const key: AnchorOutboxKey = {
      accountId: acct,
      target: "tsa",
      anchorLength: 5,
      anchorDigest: digest,
    };
    // Simulate a prior tick that submitted but never persisted the receipt (process died).
    await outbox.enqueuePending(key);
    await outbox.markSubmitted(key);

    const log = new CountingLog();
    const r = await runAnchorCheckpoint(acct, deps(fixedReader(bytes, 5), log));
    expect(r.status).toBe("needs_reconcile");
    expect(log.calls).toBe(0); // NO blind resubmit
    expect((await outbox.get(key))?.state).toBe("needs_reconcile");
  });

  test("a receipt-persist failure after a successful submit resolves to needs_reconcile", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":7,"tipHash":"${acct}"}`);
    const digest = sha256Hex(bytes);
    const log = new CountingLog();
    // A WORM store whose put fails (not an ArtifactExistsError) AFTER submit succeeds.
    const failingStore: ArtifactStore = {
      put: () => Promise.reject(new Error("worm backend unavailable")),
      get: (k) => store.get(k),
      head: (k) => store.head(k),
      extendRetention: (k, d) => store.extendRetention(k, d),
    };

    const r = await runAnchorCheckpoint(
      acct,
      deps(fixedReader(bytes, 7), log, failingStore),
    );
    expect(r.status).toBe("needs_reconcile");
    expect(log.calls).toBe(1); // submit DID happen; only persistence failed
    const key: AnchorOutboxKey = {
      accountId: acct,
      target: "tsa",
      anchorLength: 7,
      anchorDigest: digest,
    };
    expect((await outbox.get(key))?.state).toBe("needs_reconcile");
  });
});

// R7 — the SAME target-agnostic handler drives a Rekor (`externally-transparent`) target: it writes a
// public-log receipt under the target grade, and a lost-response window resolves to needs_reconcile with
// NO second submit — the load-bearing guard, since a blind Rekor resubmit would mint a duplicate
// irrevocable public entry (Rekor v2 has no idempotency key / lookup).
describe("runAnchorCheckpoint — Rekor target is target-agnostic + never blind-resubmits", () => {
  const FIX = join(import.meta.dir, "__fixtures__", "rekor-v2");
  const rekorReceipt = (): AnchorSubmitReceipt =>
    rekorEntryToReceipt(
      JSON.parse(readFileSync(join(FIX, "golden-entry.json"), "utf8")),
      JSON.parse(readFileSync(join(FIX, "trusted_root.json"), "utf8")),
    );
  const REKOR_TARGET: TransparencyTarget = {
    kind: "rekor",
    grade: "externally-transparent",
  };

  class CountingRekorLog implements TransparencyLog {
    calls = 0;
    readonly #receipt: AnchorSubmitReceipt;
    constructor(receipt: AnchorSubmitReceipt) {
      this.#receipt = receipt;
    }
    submit(): Promise<AnchorSubmitReceipt> {
      this.calls += 1;
      return Promise.resolve(this.#receipt);
    }
  }

  function rekorDeps(
    reader: CurrentAnchorReader,
    log: TransparencyLog,
  ): AnchorCheckpointDeps {
    return { store, outbox, log, reader, target: REKOR_TARGET, now: FIXED_NOW };
  }

  test("one tick writes an externally-transparent WORM receipt keyed by the rekor target", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":11,"tipHash":"${acct}"}`);
    const log = new CountingRekorLog(rekorReceipt());
    const r = await runAnchorCheckpoint(
      acct,
      rekorDeps(fixedReader(bytes, 11), log),
    );
    expect(r.status).toBe("receipted");
    if (r.status !== "receipted") throw new Error("unreachable");
    expect(r.receiptKey).toBe(
      `${acct}/audit-chain/receipts/000000000011.rekor.json`,
    );
    const obj = await store.get(r.receiptKey);
    const receipt = anchorReceiptSchema.parse(
      JSON.parse(new TextDecoder().decode(obj.body)),
    );
    expect(receipt.grade).toBe("externally-transparent");
    expect(receipt.receipt.algorithm).toBe("rekor-v2-hashedrekord");
  });

  test("a lost-response window resolves to needs_reconcile with NO duplicate public submit", async () => {
    const acct = randomUUID();
    const bytes = new TextEncoder().encode(`{"length":13,"tipHash":"${acct}"}`);
    const key: AnchorOutboxKey = {
      accountId: acct,
      target: "rekor",
      anchorLength: 13,
      anchorDigest: sha256Hex(bytes),
    };
    // A prior tick accepted the entry but the receipt was lost (process died before persist).
    await outbox.enqueuePending(key);
    await outbox.markSubmitted(key);

    const log = new CountingRekorLog(rekorReceipt());
    const r = await runAnchorCheckpoint(
      acct,
      rekorDeps(fixedReader(bytes, 13), log),
    );
    expect(r.status).toBe("needs_reconcile");
    expect(log.calls).toBe(0); // NO second irrevocable public submit
    expect((await outbox.get(key))?.state).toBe("needs_reconcile");
  });
});
