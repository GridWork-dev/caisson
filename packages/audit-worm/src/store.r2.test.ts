// Unit tests for the R2 `R2ArtifactStore` backend (ADR-0267). The S3-compatible data-plane
// transport is an injected `S3Sendable` STUB — the SAME test-double pattern as `store.s3.test.ts` —
// and the bucket-lock control plane is an injected `R2LockReader` stub. There is NO live cloud call
// in CI; the real transports (`createR2LockReader`, a real `S3Client` pointed at R2) are the only
// un-exercised paths. Assertions cover: fail-closed construction (no covering rule), write-once via
// `IfNoneMatch:'*'`, the per-put/per-extend fail-closed retention bound against the rule's
// guaranteed horizon (`Age`/`Date`/`Indefinite`), and the documented `extendRetention` capability
// gap (R2 has no per-object retention mechanism).
import { describe, expect, test } from "bun:test";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectRetentionCommand,
  S3ServiceException,
  type GetObjectCommandInput,
  type HeadObjectCommandInput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import {
  ConfigError,
  NotFoundError,
  ValidationError,
} from "@caisson-sh/kernel";
import { ArtifactExistsError, buildArtifactKey } from "./store.ts";
import type { S3Sendable } from "./store.s3.ts";
import {
  R2ArtifactStore,
  type R2LockReader,
  type R2LockRule,
} from "./store.r2.ts";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const BUCKET = "caisson-worm-r2";

interface R2StubBehavior {
  put?: (input: PutObjectCommandInput) => void;
  get?: (input: GetObjectCommandInput) => unknown;
  head?: (input: HeadObjectCommandInput) => unknown;
}

interface R2Stub {
  client: S3Sendable;
  calls: {
    put: PutObjectCommandInput[];
    get: GetObjectCommandInput[];
    head: HeadObjectCommandInput[];
  };
  total: () => number;
}

/** A `Pick<S3Client,"send">` test double for R2's data plane — the same shape as `store.s3.test.ts`'s
 *  stub, minus any Object-Lock command (R2 never receives one from this driver). */
function makeR2Stub(behavior: R2StubBehavior = {}): R2Stub {
  const calls: R2Stub["calls"] = { put: [], get: [], head: [] };
  const client: S3Sendable = {
    async send(command: unknown): Promise<unknown> {
      if (command instanceof PutObjectRetentionCommand) {
        throw new Error(
          "R2ArtifactStore must NEVER call PutObjectRetention — R2 has no S3 Object Lock",
        );
      }
      if (command instanceof PutObjectCommand) {
        calls.put.push(command.input);
        behavior.put?.(command.input);
        return {};
      }
      if (command instanceof GetObjectCommand) {
        calls.get.push(command.input);
        return behavior.get ? behavior.get(command.input) : {};
      }
      if (command instanceof HeadObjectCommand) {
        calls.head.push(command.input);
        return behavior.head ? behavior.head(command.input) : {};
      }
      throw new Error("unexpected S3 command in R2 stub");
    },
  };
  return {
    client,
    calls,
    total: () => calls.put.length + calls.get.length + calls.head.length,
  };
}

function s3Error(status: number, name: string): S3ServiceException {
  return new S3ServiceException({
    name,
    $fault: status >= 500 ? "server" : "client",
    $metadata: { httpStatusCode: status },
    message: `${name} (${status})`,
  });
}

function getOutput(
  bytes: Uint8Array,
  meta: { ContentType?: string; LastModified?: Date } = {},
): unknown {
  return {
    Body: { transformToByteArray: async (): Promise<Uint8Array> => bytes },
    ContentLength: bytes.byteLength,
    ...meta,
  };
}

/** A single bucket-wide `Indefinite` rule — the simplest possible covering rule. */
function indefiniteRules(): R2LockRule[] {
  return [
    { id: "r1", enabled: true, prefix: "", condition: { type: "Indefinite" } },
  ];
}

/** A single bucket-wide `Age` rule — the object's `LastModified` + `maxAgeSeconds` is the horizon. */
function ageRules(maxAgeSeconds: number): R2LockRule[] {
  return [
    {
      id: "r1",
      enabled: true,
      prefix: "",
      condition: { type: "Age", maxAgeSeconds },
    },
  ];
}

/** A single bucket-wide `Date` rule — a fixed horizon regardless of the object's creation time. */
function dateRules(date: Date): R2LockRule[] {
  return [
    {
      id: "r1",
      enabled: true,
      prefix: "",
      condition: { type: "Date", date: date.toISOString() },
    },
  ];
}

function readerOf(rules: R2LockRule[]): R2LockReader {
  return async () => rules;
}

describe("R2ArtifactStore.create — fail-closed construction (ADR-0267)", () => {
  test("refuses when no enabled rule covers the declared key prefix", async () => {
    const stub = makeR2Stub();
    await expect(
      R2ArtifactStore.create({
        client: stub.client,
        bucket: BUCKET,
        lockReader: readerOf([]),
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("refuses when the only matching rule is disabled", async () => {
    const stub = makeR2Stub();
    const rules: R2LockRule[] = [
      {
        id: "r1",
        enabled: false,
        prefix: "",
        condition: { type: "Indefinite" },
      },
    ];
    await expect(
      R2ArtifactStore.create({
        client: stub.client,
        bucket: BUCKET,
        lockReader: readerOf(rules),
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("refuses when the only rule's prefix does not cover the declared keyPrefix", async () => {
    const stub = makeR2Stub();
    const rules: R2LockRule[] = [
      {
        id: "r1",
        enabled: true,
        prefix: "other-tenant/",
        condition: { type: "Indefinite" },
      },
    ];
    await expect(
      R2ArtifactStore.create({
        client: stub.client,
        bucket: BUCKET,
        lockReader: readerOf(rules),
        keyPrefix: ACCOUNT_A,
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("constructs when an enabled rule covers the prefix", async () => {
    const stub = makeR2Stub();
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    expect(store).toBeInstanceOf(R2ArtifactStore);
  });
});

describe("R2ArtifactStore.put (write-once + fail-closed retention bound, no Object Lock)", () => {
  test("issues a conditional write with NO Object-Lock fields, under an Indefinite rule", async () => {
    const stub = makeR2Stub();
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "3.json");
    const retainUntil = new Date(Date.UTC(2033, 0, 1));
    const meta = await store.put(key, new Uint8Array([1, 2, 3]), {
      retainUntil,
      contentType: "application/json",
    });
    expect(meta).toEqual({
      key,
      size: 3,
      retainUntil,
      contentType: "application/json",
    });
    const input = stub.calls.put[0]!;
    expect(input.IfNoneMatch).toBe("*");
    expect(input).not.toHaveProperty("ObjectLockMode");
    expect(input).not.toHaveProperty("ObjectLockRetainUntilDate");
  });

  test("a put whose retainUntil exceeds the Age rule's horizon THROWS before any write (fail-closed)", async () => {
    const stub = makeR2Stub();
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(ageRules(60)), // only 60s of guaranteed retention
    });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "short.json");
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await expect(
      store.put(key, new Uint8Array([1]), { retainUntil: farFuture }),
    ).rejects.toBeInstanceOf(ConfigError);
    expect(stub.total()).toBe(0);
  });

  test("a put within the Age rule's horizon succeeds", async () => {
    const stub = makeR2Stub();
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(ageRules(3600)),
    });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "ok.json");
    const soon = new Date(Date.now() + 1000);
    const meta = await store.put(key, new Uint8Array([1]), {
      retainUntil: soon,
    });
    expect(meta.retainUntil).toEqual(soon);
  });

  test("a put whose retainUntil is after a Date rule's fixed horizon THROWS", async () => {
    const stub = makeR2Stub();
    const ruleDate = new Date(Date.UTC(2030, 0, 1));
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(dateRules(ruleDate)),
    });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "past.json");
    await expect(
      store.put(key, new Uint8Array([1]), {
        retainUntil: new Date(Date.UTC(2031, 0, 1)),
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("a 412 (key already locked) becomes ArtifactExistsError — write-once", async () => {
    const stub = makeR2Stub({
      put: () => {
        throw s3Error(412, "PreconditionFailed");
      },
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "1.json"),
        new Uint8Array([9]),
        {
          retainUntil: new Date(Date.UTC(2033, 0, 1)),
        },
      ),
    ).rejects.toBeInstanceOf(ArtifactExistsError);
  });

  test("a 409 (key already locked) also becomes ArtifactExistsError", async () => {
    const stub = makeR2Stub({
      put: () => {
        throw s3Error(409, "Conflict");
      },
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "2.json"),
        new Uint8Array([1]),
        {
          retainUntil: new Date(Date.UTC(2033, 0, 1)),
        },
      ),
    ).rejects.toBeInstanceOf(ArtifactExistsError);
  });

  test("a non-conflict S3 error propagates unchanged", async () => {
    const stub = makeR2Stub({
      put: () => {
        throw s3Error(503, "SlowDown");
      },
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    const putting = store.put(
      buildArtifactKey(ACCOUNT_A, "x.bin"),
      new Uint8Array([1]),
      {
        retainUntil: new Date(Date.UTC(2033, 0, 1)),
      },
    );
    await expect(putting).rejects.toBeInstanceOf(S3ServiceException);
    await expect(putting).rejects.not.toBeInstanceOf(ArtifactExistsError);
  });
});

describe("R2ArtifactStore.get / head", () => {
  test("get round-trips the body/size/contentType and reports the rule-derived retainUntil", async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const created = new Date(Date.UTC(2026, 0, 1));
    const stub = makeR2Stub({
      get: () =>
        getOutput(bytes, {
          ContentType: "application/json",
          LastModified: created,
        }),
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(ageRules(3600)),
    });
    const key = buildArtifactKey(ACCOUNT_A, "evidence", "pack.bin");
    const obj = await store.get(key);
    expect([...obj.body]).toEqual([10, 20, 30]);
    expect(obj.contentType).toBe("application/json");
    expect(obj.retainUntil).toEqual(new Date(created.getTime() + 3600 * 1000));
  });

  test("get on a missing key (404) throws NotFoundError", async () => {
    const stub = makeR2Stub({
      get: () => {
        throw s3Error(404, "NoSuchKey");
      },
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    await expect(
      store.get(buildArtifactKey(ACCOUNT_A, "missing.bin")),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("head under an Indefinite rule reports NO retainUntil (unbounded, not 'no retention')", async () => {
    const stub = makeR2Stub({
      head: () => ({
        ContentLength: 42,
        ContentType: "application/octet-stream",
      }),
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    const meta = await store.head(
      buildArtifactKey(ACCOUNT_A, "head", "probe.bin"),
    );
    expect(meta).not.toBeNull();
    expect(meta!.size).toBe(42);
    expect(meta!.retainUntil).toBeUndefined();
  });

  test("head returns null for an absent key (404)", async () => {
    const stub = makeR2Stub({
      head: () => {
        throw s3Error(404, "NotFound");
      },
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    expect(
      await store.head(buildArtifactKey(ACCOUNT_A, "absent.bin")),
    ).toBeNull();
  });
});

describe("tenant isolation + traversal guard", () => {
  test("an unsafe key is rejected before any R2 call (put/get/head)", async () => {
    const stub = makeR2Stub();
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    const bad = `${ACCOUNT_A}/../escape.bin`;
    await expect(
      store.put(bad, new Uint8Array([1]), {
        retainUntil: new Date(Date.UTC(2033, 0, 1)),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(store.get(bad)).rejects.toBeInstanceOf(ValidationError);
    await expect(store.head(bad)).rejects.toBeInstanceOf(ValidationError);
    expect(stub.total()).toBe(0);
  });
});

describe("R2ArtifactStore.extendRetention — the documented capability gap (ADR-0267)", () => {
  const key = buildArtifactKey(ACCOUNT_A, "evidence", "pack.bin");

  test("under an Indefinite rule, any later date is trivially satisfied", async () => {
    const stub = makeR2Stub({
      head: () => ({
        ContentLength: 3,
        LastModified: new Date(Date.UTC(2020, 0, 1)),
      }),
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    const requested = new Date(Date.UTC(2099, 0, 1));
    const meta = await store.extendRetention(key, requested);
    expect(meta.retainUntil).toEqual(requested);
  });

  test("under an Age rule, a request BEYOND the guaranteed horizon is refused (cannot grant more)", async () => {
    const created = new Date(Date.UTC(2026, 0, 1));
    const stub = makeR2Stub({
      head: () => ({ ContentLength: 3, LastModified: created }),
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(ageRules(3600)), // horizon = created + 1h
    });
    await expect(
      store.extendRetention(
        key,
        new Date(created.getTime() + 100 * 3600 * 1000),
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("a request at or before the current guaranteed horizon is refused as a non-extension", async () => {
    const created = new Date(Date.UTC(2026, 0, 1));
    const stub = makeR2Stub({
      head: () => ({ ContentLength: 3, LastModified: created }),
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(ageRules(3600)),
    });
    const horizon = new Date(created.getTime() + 3600 * 1000);
    await expect(store.extendRetention(key, horizon)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      store.extendRetention(key, new Date(horizon.getTime() - 1)),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("a missing object (404) is NotFoundError", async () => {
    const stub = makeR2Stub({
      head: () => {
        throw s3Error(404, "NotFound");
      },
    });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    await expect(
      store.extendRetention(key, new Date(Date.UTC(2033, 0, 1))),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("an unsafe key or an invalid date is rejected before any R2 call", async () => {
    const stub = makeR2Stub();
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    await expect(
      store.extendRetention(
        `${ACCOUNT_A}/../escape.bin`,
        new Date(Date.UTC(2033, 0, 1)),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      store.extendRetention(key, new Date(Number.NaN)),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(stub.total()).toBe(0);
  });
});

// --- Fail-closed regression locks (2026-07-06 SHIP-audit findings) ---

const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";

describe("R2ArtifactStore — non-finite horizons always REFUSE (audit P1 regression lock)", () => {
  test("extendRetention on a key covered by NO rule is a ConfigError, never a fake success", async () => {
    // The exploit shape: a prefix-scoped rule covers the store, but the extended key sits outside
    // every rule prefix — the horizon is -Infinity, which must refuse, not ride the Indefinite arm.
    const uncoveredKey = buildArtifactKey(ACCOUNT_B, "anchors", "1.json");
    const stub = makeR2Stub({
      head: () => ({
        ContentLength: 3,
        LastModified: new Date(Date.UTC(2026, 0, 1)),
      }),
    });
    const scopedRules: R2LockRule[] = [
      {
        id: "r1",
        enabled: true,
        prefix: `${ACCOUNT_A}/`,
        condition: { type: "Indefinite" },
      },
    ];
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(scopedRules),
      keyPrefix: `${ACCOUNT_A}/`,
    });
    await expect(
      store.extendRetention(uncoveredKey, new Date(Date.UTC(2033, 0, 1))),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("a malformed Date rule (NaN horizon) refuses a put instead of silently passing", async () => {
    const stub = makeR2Stub();
    const malformed: R2LockRule[] = [
      {
        id: "r1",
        enabled: true,
        prefix: "",
        condition: { type: "Date", date: "not-a-date" },
      },
    ];
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(malformed),
    });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "nan.json");
    await expect(
      store.put(key, new Uint8Array([1]), {
        retainUntil: new Date(Date.UTC(2033, 0, 1)),
      }),
    ).rejects.toBeInstanceOf(ConfigError);
    expect(stub.total()).toBe(0);
  });

  test("a malformed Date rule ALSO poisons a second valid rule fail-closed, never fail-open", async () => {
    // Math.max(validHorizon, NaN) = NaN — the driver must refuse the write even though one rule
    // is fine, because it can no longer PROVE coverage.
    const stub = makeR2Stub();
    const mixed: R2LockRule[] = [
      {
        id: "good",
        enabled: true,
        prefix: "",
        condition: { type: "Indefinite" },
      },
      {
        id: "bad",
        enabled: true,
        prefix: "",
        condition: { type: "Date", date: "not-a-date" },
      },
    ];
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(mixed),
    });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "mixed.json");
    await expect(
      store.put(key, new Uint8Array([1]), {
        retainUntil: new Date(Date.UTC(2033, 0, 1)),
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("extendRetention refuses when HeadObject returns no LastModified (cannot anchor honestly)", async () => {
    const stub = makeR2Stub({ head: () => ({ ContentLength: 3 }) });
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: readerOf(indefiniteRules()),
    });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "nolm.json");
    await expect(
      store.extendRetention(key, new Date(Date.UTC(2033, 0, 1))),
    ).rejects.toThrow(/LastModified/);
  });
});

describe("R2ArtifactStore — write paths re-read rules fresh (ADR-0267 verify-per-put)", () => {
  test("a rule disabled AFTER construction refuses the next put", async () => {
    let disabled = false;
    const statefulReader: R2LockReader = async () => [
      {
        id: "r1",
        enabled: !disabled,
        prefix: "",
        condition: { type: "Indefinite" },
      },
    ];
    const stub = makeR2Stub();
    const store = await R2ArtifactStore.create({
      client: stub.client,
      bucket: BUCKET,
      lockReader: statefulReader,
    });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "drift.json");
    // First put: rule still enabled — succeeds.
    await store.put(key, new Uint8Array([1]), {
      retainUntil: new Date(Date.UTC(2033, 0, 1)),
    });
    // Ops drift: the rule is disabled out from under the long-lived store.
    disabled = true;
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "drift2.json"),
        new Uint8Array([1]),
        { retainUntil: new Date(Date.UTC(2033, 0, 1)) },
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});
