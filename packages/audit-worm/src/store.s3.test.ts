// Unit tests for the prod `S3ArtifactStore` backend (ADR-0054, ADR-0051). The S3 transport is an
// injected `S3Sendable = Pick<S3Client, "send">` STUB — there is NO live cloud call in CI; a
// real `S3Client` (the live transport) is the only un-exercised path. The tests assert: write-once
// via conditional `IfNoneMatch: '*'` (412 → `ArtifactExistsError`), GOVERNANCE-default +
// COMPLIANCE-behind-a-typed-opt-in + never-COMPLIANCE-in-test, tenant-scoped traversal-safe
// keys guarded before any I/O, and round-trip of body + retention metadata.
import { describe, expect, test } from "bun:test";
import {
  GetObjectCommand,
  GetObjectRetentionCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectRetentionCommand,
  S3ServiceException,
  type GetObjectCommandInput,
  type GetObjectRetentionCommandInput,
  type HeadObjectCommandInput,
  type PutObjectCommandInput,
  type PutObjectRetentionCommandInput,
} from "@aws-sdk/client-s3";
import {
  ConfigError,
  NotFoundError,
  ValidationError,
} from "@caisson-sh/kernel";
import { ArtifactExistsError, buildArtifactKey } from "./store.ts";
import {
  COMPLIANCE_ACKNOWLEDGEMENT,
  S3ArtifactStore,
  irreversibleComplianceOptIn,
  type S3Sendable,
} from "./store.s3.ts";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const BUCKET = "caisson-worm-evidence";
const RETAIN = new Date(Date.UTC(2033, 0, 1));

interface S3StubBehavior {
  /** Throw inside to simulate an S3 error on PUT; otherwise the conditional write "succeeds". */
  put?: (input: PutObjectCommandInput) => unknown;
  get?: (input: GetObjectCommandInput) => unknown;
  head?: (input: HeadObjectCommandInput) => unknown;
  getRetention?: (input: GetObjectRetentionCommandInput) => unknown;
  putRetention?: (input: PutObjectRetentionCommandInput) => void;
}

interface S3Stub {
  client: S3Sendable;
  calls: {
    put: PutObjectCommandInput[];
    get: GetObjectCommandInput[];
    head: HeadObjectCommandInput[];
    getRetention: GetObjectRetentionCommandInput[];
    putRetention: PutObjectRetentionCommandInput[];
  };
  total: () => number;
}

/** A `Pick<S3Client,"send">` test double — inspects the command, records the input, and runs the
 *  per-command behaviour. Never touches the network. */
function makeS3Stub(behavior: S3StubBehavior = {}): S3Stub {
  const calls: S3Stub["calls"] = {
    put: [],
    get: [],
    head: [],
    getRetention: [],
    putRetention: [],
  };
  const client: S3Sendable = {
    async send(command: unknown): Promise<unknown> {
      if (command instanceof PutObjectCommand) {
        calls.put.push(command.input);
        return behavior.put
          ? behavior.put(command.input)
          : { VersionId: "s3-version-default" };
      }
      if (command instanceof GetObjectCommand) {
        calls.get.push(command.input);
        return behavior.get ? behavior.get(command.input) : {};
      }
      if (command instanceof HeadObjectCommand) {
        calls.head.push(command.input);
        return behavior.head ? behavior.head(command.input) : {};
      }
      if (command instanceof GetObjectRetentionCommand) {
        calls.getRetention.push(command.input);
        return behavior.getRetention
          ? behavior.getRetention(command.input)
          : {};
      }
      if (command instanceof PutObjectRetentionCommand) {
        calls.putRetention.push(command.input);
        behavior.putRetention?.(command.input);
        return {};
      }
      throw new Error("unexpected S3 command in stub");
    },
  };
  return {
    client,
    calls,
    total: () =>
      calls.put.length +
      calls.get.length +
      calls.head.length +
      calls.getRetention.length +
      calls.putRetention.length,
  };
}

/** Build a realistic S3 service exception carrying an HTTP status (the only field the store reads). */
function s3Error(status: number, name: string): S3ServiceException {
  return new S3ServiceException({
    name,
    $fault: status >= 500 ? "server" : "client",
    $metadata: { httpStatusCode: status },
    message: `${name} (${status})`,
  });
}

/** A stub GetObject response: a stream that yields `bytes` plus the metadata the store projects. */
function getOutput(
  bytes: Uint8Array,
  meta: {
    ContentType?: string;
    ObjectLockRetainUntilDate?: Date;
    VersionId?: string;
  } = {},
): unknown {
  return {
    Body: { transformToByteArray: async (): Promise<Uint8Array> => bytes },
    ContentLength: bytes.byteLength,
    ...meta,
  };
}

describe("S3ArtifactStore.put (write-once + GOVERNANCE default + retention lock)", () => {
  test("returns the exact S3 object version identity recorded by the create-only write", async () => {
    const stub = makeS3Stub({ put: () => ({ VersionId: "s3-version-42" }) });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "proof.bin");

    const meta = await store.put(key, new Uint8Array([4, 2]), {
      retainUntil: RETAIN,
    });

    expect(meta.versionId).toBe("s3-version-42");
  });

  test("issues a conditional GOVERNANCE Object-Lock write with the retain date and returns meta", async () => {
    const stub = makeS3Stub();
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    expect(store.mode).toBe("GOVERNANCE");

    const key = buildArtifactKey(ACCOUNT_A, "anchors", "3.json");
    const meta = await store.put(key, new Uint8Array([1, 2, 3]), {
      retainUntil: RETAIN,
      contentType: "application/json",
    });

    expect(meta).toEqual({
      key,
      size: 3,
      versionId: "s3-version-default",
      retainUntil: RETAIN,
      contentType: "application/json",
    });
    expect(stub.calls.put).toHaveLength(1);
    const input = stub.calls.put[0]!;
    expect(input.Bucket).toBe(BUCKET);
    expect(input.Key).toBe(key);
    expect(input.IfNoneMatch).toBe("*");
    expect(input.ObjectLockMode).toBe("GOVERNANCE");
    expect(input.ObjectLockRetainUntilDate).toBe(RETAIN);
    expect(input.ContentType).toBe("application/json");
    expect(input.ContentLength).toBe(3);
    // No SSE-KMS unless a key id is configured.
    expect(input.ServerSideEncryption).toBeUndefined();
    expect(input.SSEKMSKeyId).toBeUndefined();
  });

  test("a 412 (key already locked) becomes ArtifactExistsError — write-once (TM-H)", async () => {
    const stub = makeS3Stub({
      put: () => {
        throw s3Error(412, "PreconditionFailed");
      },
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "1.json"),
        new Uint8Array([9]),
        {
          retainUntil: RETAIN,
        },
      ),
    ).rejects.toBeInstanceOf(ArtifactExistsError);
  });

  test("a non-412 S3 error propagates unchanged (not swallowed as a WORM conflict)", async () => {
    const stub = makeS3Stub({
      put: () => {
        throw s3Error(503, "SlowDown");
      },
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    const putting = store.put(
      buildArtifactKey(ACCOUNT_A, "x.bin"),
      new Uint8Array([1]),
      {
        retainUntil: RETAIN,
      },
    );
    await expect(putting).rejects.toBeInstanceOf(S3ServiceException);
    await expect(putting).rejects.not.toBeInstanceOf(ArtifactExistsError);
  });

  test("a configured per-tenant SSE-KMS key plumbs aws:kms encryption (TM-C)", async () => {
    const keyId = "arn:aws:kms:us-east-1:111122223333:key/abc-123";
    const stub = makeS3Stub();
    const store = new S3ArtifactStore({
      client: stub.client,
      bucket: BUCKET,
      sseKmsKeyId: keyId,
    });
    await store.put(
      buildArtifactKey(ACCOUNT_A, "sse.bin"),
      new Uint8Array([7]),
      {
        retainUntil: RETAIN,
      },
    );
    const input = stub.calls.put[0]!;
    expect(input.ServerSideEncryption).toBe("aws:kms");
    expect(input.SSEKMSKeyId).toBe(keyId);
  });
});

describe("S3ArtifactStore.get / head", () => {
  test("targets a caller-recorded version on get and head", async () => {
    const bytes = new Uint8Array([4, 2]);
    const stub = makeS3Stub({
      get: () =>
        getOutput(bytes, {
          ObjectLockRetainUntilDate: RETAIN,
          VersionId: "s3-version-42",
        }),
      head: () => ({
        ContentLength: bytes.byteLength,
        ObjectLockRetainUntilDate: RETAIN,
        VersionId: "s3-version-42",
      }),
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "proof.bin");

    await store.get(key, "s3-version-42");
    await store.head(key, "s3-version-42");

    expect(stub.calls.get[0]?.VersionId).toBe("s3-version-42");
    expect(stub.calls.head[0]?.VersionId).toBe("s3-version-42");
  });

  test("fails closed when an exact read response reports another version", async () => {
    const stub = makeS3Stub({
      get: () =>
        getOutput(new Uint8Array([4, 2]), {
          VersionId: "replacement-version",
        }),
      head: () => ({
        ContentLength: 2,
        VersionId: "replacement-version",
      }),
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "proof.bin");

    await expect(store.get(key, "recorded-version")).rejects.toThrow(
      /version/i,
    );
    await expect(store.head(key, "recorded-version")).rejects.toThrow(
      /version/i,
    );
  });

  test("get round-trips the body, size, retain date, and content-type", async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const stub = makeS3Stub({
      get: () =>
        getOutput(bytes, {
          ContentType: "application/json",
          ObjectLockRetainUntilDate: RETAIN,
        }),
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "evidence", "pack.bin");

    const obj = await store.get(key);
    expect([...obj.body]).toEqual([10, 20, 30]);
    expect(obj.size).toBe(3);
    expect(obj.contentType).toBe("application/json");
    expect(obj.retainUntil).toBe(RETAIN);
    expect(stub.calls.get[0]!.Bucket).toBe(BUCKET);
    expect(stub.calls.get[0]!.Key).toBe(key);
  });

  test("get on a missing key (404) throws NotFoundError", async () => {
    const stub = makeS3Stub({
      get: () => {
        throw s3Error(404, "NoSuchKey");
      },
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    await expect(
      store.get(buildArtifactKey(ACCOUNT_A, "missing.bin")),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("head returns metadata for a present key", async () => {
    const stub = makeS3Stub({
      head: () => ({
        ContentLength: 42,
        ContentType: "application/octet-stream",
        ObjectLockRetainUntilDate: RETAIN,
      }),
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    const meta = await store.head(
      buildArtifactKey(ACCOUNT_A, "head", "probe.bin"),
    );
    expect(meta).not.toBeNull();
    expect(meta!.size).toBe(42);
    expect(meta!.contentType).toBe("application/octet-stream");
    expect(meta!.retainUntil).toBe(RETAIN);
  });

  test("head returns null for an absent key (404) — a non-throwing presence probe", async () => {
    const stub = makeS3Stub({
      head: () => {
        throw s3Error(404, "NotFound");
      },
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    expect(
      await store.head(buildArtifactKey(ACCOUNT_A, "absent.bin")),
    ).toBeNull();
  });
});

describe("tenant isolation + traversal guard (TM-C)", () => {
  test("an unsafe key is rejected before any S3 call (put/get/head)", async () => {
    const stub = makeS3Stub();
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    const bad = `${ACCOUNT_A}/../escape.bin`;

    await expect(
      store.put(bad, new Uint8Array([1]), { retainUntil: RETAIN }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(store.get(bad)).rejects.toBeInstanceOf(ValidationError);
    await expect(store.head(bad)).rejects.toBeInstanceOf(ValidationError);

    expect(stub.total()).toBe(0);
  });
});

describe("GOVERNANCE / COMPLIANCE mode guard (TM-A)", () => {
  test("a default store is GOVERNANCE and needs no opt-in", () => {
    const stub = makeS3Stub();
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    expect(store.mode).toBe("GOVERNANCE");
  });

  test("COMPLIANCE without an opt-in is refused at construction", () => {
    const stub = makeS3Stub();
    expect(
      () =>
        new S3ArtifactStore({
          client: stub.client,
          bucket: BUCKET,
          mode: "COMPLIANCE",
        }),
    ).toThrow(ConfigError);
  });

  test("COMPLIANCE is refused under a test runner even with a well-formed opt-in", () => {
    const stub = makeS3Stub();
    const optIn = irreversibleComplianceOptIn({
      bucket: BUCKET,
      acknowledgement: COMPLIANCE_ACKNOWLEDGEMENT,
      deployment: "production",
    });
    // NODE_ENV === "test" under `bun test`, so even a valid opt-in cannot enable COMPLIANCE here.
    expect(
      () =>
        new S3ArtifactStore({
          client: stub.client,
          bucket: BUCKET,
          mode: "COMPLIANCE",
          complianceOptIn: optIn,
        }),
    ).toThrow(ConfigError);
  });

  test("the opt-in factory rejects a wrong acknowledgement string", () => {
    expect(() =>
      irreversibleComplianceOptIn({
        bucket: BUCKET,
        acknowledgement: "yes lock it forever",
        deployment: "production",
      }),
    ).toThrow(ConfigError);
  });

  test("the opt-in factory rejects an empty bucket", () => {
    expect(() =>
      irreversibleComplianceOptIn({
        bucket: "   ",
        acknowledgement: COMPLIANCE_ACKNOWLEDGEMENT,
        deployment: "production",
      }),
    ).toThrow(ValidationError);
  });

  test("in a production deployment a matching opt-in enables a COMPLIANCE write; a mismatched bucket is refused", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const stub = makeS3Stub();
      const optIn = irreversibleComplianceOptIn({
        bucket: BUCKET,
        acknowledgement: COMPLIANCE_ACKNOWLEDGEMENT,
        deployment: "production",
      });

      // The opt-in is bucket-bound: it cannot enable COMPLIANCE on a different bucket.
      expect(
        () =>
          new S3ArtifactStore({
            client: stub.client,
            bucket: "some-other-bucket",
            mode: "COMPLIANCE",
            complianceOptIn: optIn,
          }),
      ).toThrow(ConfigError);

      const store = new S3ArtifactStore({
        client: stub.client,
        bucket: BUCKET,
        mode: "COMPLIANCE",
        complianceOptIn: optIn,
      });
      expect(store.mode).toBe("COMPLIANCE");
      await store.put(
        buildArtifactKey(ACCOUNT_A, "compliance.bin"),
        new Uint8Array([1]),
        {
          retainUntil: RETAIN,
        },
      );
      expect(stub.calls.put[0]!.ObjectLockMode).toBe("COMPLIANCE");
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prev;
    }
  });
});

// --- ADR-0202: strictly-monotonic retention escalation ---

const CURRENT = new Date(Date.UTC(2033, 0, 1));
const LATER = new Date(Date.UTC(2034, 0, 1));
const EARLIER = new Date(Date.UTC(2032, 0, 1));

/** Stub behaviour for an object currently locked GOVERNANCE until {@link CURRENT}. */
function lockedGovernance(): S3StubBehavior {
  let retention: {
    Mode: "GOVERNANCE" | "COMPLIANCE";
    RetainUntilDate: Date;
  } = {
    Mode: "GOVERNANCE",
    RetainUntilDate: CURRENT,
  };
  return {
    getRetention: () => ({
      Retention: retention,
    }),
    putRetention: (input) => {
      const next = input.Retention;
      if (next?.Mode !== undefined && next.RetainUntilDate !== undefined) {
        retention = {
          Mode: next.Mode,
          RetainUntilDate: next.RetainUntilDate,
        };
      }
    },
    head: () => ({
      ContentLength: 3,
      ObjectLockRetainUntilDate: LATER,
      VersionId: "s3-version-42",
    }),
  };
}

/** Run `fn` with NODE_ENV=production (the only env the COMPLIANCE gate opens in), restoring after. */
async function inProduction(fn: () => Promise<void>): Promise<void> {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }
}

describe("S3ArtifactStore.extendRetention (ADR-0202 — extend-only, mode-preserving)", () => {
  const key = buildArtifactKey(ACCOUNT_A, "evidence", "pack.bin");

  test("a strictly-later date issues PutObjectRetention preserving the store's mode", async () => {
    const stub = makeS3Stub(lockedGovernance());
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });

    const meta = await store.extendRetention(key, LATER);
    // The returned date is the one S3 just accepted — the caller's `retain_until` row value.
    expect(meta.retainUntil).toBe(LATER);
    expect(meta.size).toBe(3);

    expect(stub.calls.getRetention).toHaveLength(2);
    expect(stub.calls.putRetention).toHaveLength(1);
    const input = stub.calls.putRetention[0]!;
    expect(input.Bucket).toBe(BUCKET);
    expect(input.Key).toBe(key);
    expect(input.Retention?.Mode).toBe("GOVERNANCE"); // mode preserved, never escalated here
    expect(input.Retention?.RetainUntilDate).toBe(LATER);
  });

  test("returns the authoritative post-write GetObjectRetention date, not the requested or HeadObject date", async () => {
    const applied = new Date(Date.UTC(2035, 0, 1));
    let reads = 0;
    const stub = makeS3Stub({
      getRetention: () => ({
        Retention: {
          Mode: "GOVERNANCE",
          RetainUntilDate: reads++ === 0 ? CURRENT : applied,
        },
      }),
      head: () => ({
        ContentLength: 3,
        ObjectLockRetainUntilDate: LATER,
      }),
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });

    const meta = await store.extendRetention(key, LATER);

    expect(meta.retainUntil).toEqual(applied);
    expect(stub.calls.getRetention).toHaveLength(2);
  });

  test.each([
    [
      "a shorter date",
      {
        Mode: "GOVERNANCE" as const,
        RetainUntilDate: new Date(LATER.getTime() - 1),
      },
    ],
    ["the wrong mode", { Mode: "COMPLIANCE" as const, RetainUntilDate: LATER }],
    ["a missing mode", { RetainUntilDate: LATER }],
  ])(
    "rejects %s in the authoritative post-write readback",
    async (_label, applied) => {
      let reads = 0;
      const stub = makeS3Stub({
        getRetention: () => ({
          Retention:
            reads++ === 0
              ? { Mode: "GOVERNANCE", RetainUntilDate: CURRENT }
              : applied,
        }),
        head: () => ({ ContentLength: 3 }),
      });
      const store = new S3ArtifactStore({
        client: stub.client,
        bucket: BUCKET,
      });

      await expect(store.extendRetention(key, LATER)).rejects.toThrow(
        /authoritative readback/i,
      );
    },
  );

  test("targets the caller-recorded version throughout a retention extension", async () => {
    const stub = makeS3Stub(lockedGovernance());
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });

    await store.extendRetention(key, LATER, "s3-version-42");

    expect(stub.calls.getRetention[0]?.VersionId).toBe("s3-version-42");
    expect(stub.calls.putRetention[0]?.VersionId).toBe("s3-version-42");
    expect(stub.calls.head[0]?.VersionId).toBe("s3-version-42");
  });

  test.each([
    ["an equal", CURRENT],
    ["an earlier", EARLIER],
  ])(
    "%s date is refused fail-closed BEFORE any write (never shortens, never clamps)",
    async (_label, requested) => {
      const stub = makeS3Stub(lockedGovernance());
      const store = new S3ArtifactStore({
        client: stub.client,
        bucket: BUCKET,
      });
      await expect(
        store.extendRetention(key, requested),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(stub.calls.putRetention).toHaveLength(0);
    },
  );

  test("an object with NO current retention gains one — extend-from-nothing strengthens", async () => {
    let retained = false;
    const stub = makeS3Stub({
      getRetention: () => {
        if (retained) {
          return {
            Retention: {
              Mode: "GOVERNANCE",
              RetainUntilDate: LATER,
            },
          };
        }
        throw s3Error(404, "NoSuchObjectLockConfiguration");
      },
      putRetention: () => {
        retained = true;
      },
      head: () => ({ ContentLength: 1 }),
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    const meta = await store.extendRetention(key, LATER);
    expect(meta.retainUntil).toBe(LATER);
    expect(stub.calls.putRetention[0]!.Retention?.Mode).toBe("GOVERNANCE");
  });

  test("a missing object (404) is NotFoundError — mirrors get()", async () => {
    const stub = makeS3Stub({
      getRetention: () => {
        throw s3Error(404, "NoSuchKey");
      },
    });
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    await expect(store.extendRetention(key, LATER)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(stub.calls.putRetention).toHaveLength(0);
  });

  test("an unsafe key or an invalid date is rejected before any S3 call", async () => {
    const stub = makeS3Stub();
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    await expect(
      store.extendRetention(`${ACCOUNT_A}/../escape.bin`, LATER),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      store.extendRetention(key, new Date(Number.NaN)),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(stub.total()).toBe(0);
  });
});

describe("S3ArtifactStore.escalateToCompliance (ADR-0202 riding the ADR-0051 three-belt gate)", () => {
  const key = buildArtifactKey(ACCOUNT_A, "evidence", "pack.bin");
  const validOptIn = (): ReturnType<typeof irreversibleComplianceOptIn> =>
    irreversibleComplianceOptIn({
      bucket: BUCKET,
      acknowledgement: COMPLIANCE_ACKNOWLEDGEMENT,
      deployment: "production",
    });

  test("refused under a test runner even with a valid opt-in — belt 1, before any S3 I/O", async () => {
    const stub = makeS3Stub(lockedGovernance());
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    // NODE_ENV === "test" under `bun test` — the escalation gate is the SAME as construction-time.
    await expect(
      store.escalateToCompliance(key, LATER, validOptIn()),
    ).rejects.toThrow(/test runner/);
    expect(stub.total()).toBe(0);
  });

  test("gate order: under the test runner a MISSING opt-in still reports belt 1 (test-runner) first", async () => {
    const stub = makeS3Stub();
    const store = new S3ArtifactStore({ client: stub.client, bucket: BUCKET });
    await expect(
      store.escalateToCompliance(
        key,
        LATER,
        undefined as unknown as ReturnType<typeof irreversibleComplianceOptIn>,
      ),
    ).rejects.toThrow(/test runner/);
    expect(stub.total()).toBe(0);
  });

  test("in production a missing opt-in is refused (belt 3), still before any S3 I/O", async () => {
    await inProduction(async () => {
      const stub = makeS3Stub();
      const store = new S3ArtifactStore({
        client: stub.client,
        bucket: BUCKET,
      });
      await expect(
        store.escalateToCompliance(
          key,
          LATER,
          undefined as unknown as ReturnType<
            typeof irreversibleComplianceOptIn
          >,
        ),
      ).rejects.toBeInstanceOf(ConfigError);
      expect(stub.total()).toBe(0);
    });
  });

  test("in production with the opt-in an EQUAL date is allowed — mode hardens without date change", async () => {
    await inProduction(async () => {
      const stub = makeS3Stub(lockedGovernance());
      const store = new S3ArtifactStore({
        client: stub.client,
        bucket: BUCKET,
      });
      const meta = await store.escalateToCompliance(key, CURRENT, validOptIn());
      expect(meta.retainUntil).toBe(CURRENT);
      const input = stub.calls.putRetention[0]!;
      expect(input.Retention?.Mode).toBe("COMPLIANCE");
      expect(input.Retention?.RetainUntilDate).toBe(CURRENT);
    });
  });

  test.each([
    [
      "a shorter date",
      {
        Mode: "COMPLIANCE" as const,
        RetainUntilDate: new Date(CURRENT.getTime() - 1),
      },
    ],
    [
      "the wrong mode",
      { Mode: "GOVERNANCE" as const, RetainUntilDate: CURRENT },
    ],
    ["a missing mode", { RetainUntilDate: CURRENT }],
  ])(
    "in production rejects %s in the authoritative COMPLIANCE readback",
    async (_label, applied) => {
      await inProduction(async () => {
        let reads = 0;
        const stub = makeS3Stub({
          getRetention: () => ({
            Retention:
              reads++ === 0
                ? { Mode: "GOVERNANCE", RetainUntilDate: CURRENT }
                : applied,
          }),
          head: () => ({ ContentLength: 3 }),
        });
        const store = new S3ArtifactStore({
          client: stub.client,
          bucket: BUCKET,
        });

        await expect(
          store.escalateToCompliance(key, CURRENT, validOptIn()),
        ).rejects.toThrow(/authoritative readback/i);
      });
    },
  );

  test("in production an EARLIER date is refused — escalation never shortens (monotonicity floor)", async () => {
    await inProduction(async () => {
      const stub = makeS3Stub(lockedGovernance());
      const store = new S3ArtifactStore({
        client: stub.client,
        bucket: BUCKET,
      });
      await expect(
        store.escalateToCompliance(key, EARLIER, validOptIn()),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(stub.calls.putRetention).toHaveLength(0);
    });
  });
});
