// Unit tests for the prod `S3ArtifactStore` backend (ADR-0054, ADR-0051). The S3 transport is an
// injected `S3Sendable = Pick<S3Client, "send">` STUB — there is NO live cloud call in CI (TM-G); a
// real `S3Client` (the live transport) is the only un-exercised path. The tests assert: write-once
// via conditional `IfNoneMatch: '*'` (412 → `ArtifactExistsError`, TM-H), GOVERNANCE-default +
// COMPLIANCE-behind-a-typed-opt-in + never-COMPLIANCE-in-test (TM-A), tenant-scoped traversal-safe
// keys guarded before any I/O (TM-C), and round-trip of body + retention metadata.
import { describe, expect, test } from "bun:test";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3ServiceException,
  type GetObjectCommandInput,
  type HeadObjectCommandInput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { ConfigError, NotFoundError, ValidationError } from "@caisson/kernel";
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
  put?: (input: PutObjectCommandInput) => void;
  get?: (input: GetObjectCommandInput) => unknown;
  head?: (input: HeadObjectCommandInput) => unknown;
}

interface S3Stub {
  client: S3Sendable;
  calls: {
    put: PutObjectCommandInput[];
    get: GetObjectCommandInput[];
    head: HeadObjectCommandInput[];
  };
  total: () => number;
}

/** A `Pick<S3Client,"send">` test double — inspects the command, records the input, and runs the
 *  per-command behaviour. Never touches the network (TM-G). */
function makeS3Stub(behavior: S3StubBehavior = {}): S3Stub {
  const calls: S3Stub["calls"] = { put: [], get: [], head: [] };
  const client: S3Sendable = {
    async send(command: unknown): Promise<unknown> {
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
      throw new Error("unexpected S3 command in stub");
    },
  };
  return {
    client,
    calls,
    total: () => calls.put.length + calls.get.length + calls.head.length,
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
  meta: { ContentType?: string; ObjectLockRetainUntilDate?: Date } = {},
): unknown {
  return {
    Body: { transformToByteArray: async (): Promise<Uint8Array> => bytes },
    ContentLength: bytes.byteLength,
    ...meta,
  };
}

describe("S3ArtifactStore.put (write-once + GOVERNANCE default + retention lock)", () => {
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
