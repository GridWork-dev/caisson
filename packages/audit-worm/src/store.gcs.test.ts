// Unit tests for the GCS `GcsArtifactStore` backend (ADR-0267). The HTTP transport is an injected
// `GcsSendable` STUB — there is NO live cloud call in CI; the real transport
// (`createGcsServiceAccountTransport`) is the only un-exercised path. Assertions cover: construction
// fail-closed on missing Object Retention Lock, write-once via `ifGenerationMatch=0` (412/409 →
// `ArtifactExistsError`), tenant-scoped traversal-safe keys guarded before any I/O, round-trip of
// body + retention metadata, and the ADR-0202-mirrored strictly-monotonic `extendRetention`. A
// separate suite proves the RFC 7523 JWT-bearer signing round-trip with no network call.
import { describe, expect, test } from "bun:test";
import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  ConfigError,
  NotFoundError,
  ValidationError,
} from "@caisson-sh/kernel";
import { ArtifactExistsError, buildArtifactKey } from "./store.ts";
import {
  GcsArtifactStore,
  type GcsSendable,
  mintGcsAccessToken,
} from "./store.gcs.ts";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const BUCKET = "caisson-worm-gcs";
const RETAIN = new Date(Date.UTC(2033, 0, 1));
const PROVIDER_GENERATION = "1742000000000042";

interface GcsCall {
  url: string;
  init: RequestInit;
}

/** A `GcsSendable` test double — records every call and routes by URL shape/method; never touches
 *  the network. */
function makeGcsStub(
  handler: (call: GcsCall) => Response | Promise<Response>,
): { transport: GcsSendable; calls: GcsCall[] } {
  const calls: GcsCall[] = [];
  const transport: GcsSendable = async (url, init) => {
    calls.push({ url, init });
    return handler({ url, init });
  };
  return { transport, calls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const ENABLED_BUCKET = () => json({ objectRetention: { mode: "Enabled" } });

/** Routes: bucket-metadata GET, multipart insert POST, object metadata/media GET, PATCH. */
function router(opts: {
  onInsert?: (call: GcsCall) => Response | Promise<Response>;
  onObjectGet?: (call: GcsCall) => Response | Promise<Response>;
  onPatch?: (call: GcsCall) => Response | Promise<Response>;
}): (call: GcsCall) => Response | Promise<Response> {
  return (call) => {
    const method = call.init.method ?? "GET";
    if (call.url.includes("/upload/storage/v1/b/")) {
      return opts.onInsert?.(call) ?? json({}, 500);
    }
    if (method === "PATCH") {
      return opts.onPatch?.(call) ?? json({}, 500);
    }
    if (call.url.includes("/storage/v1/b/") && call.url.includes("/o/")) {
      return opts.onObjectGet?.(call) ?? json({}, 500);
    }
    // bucket metadata
    return ENABLED_BUCKET();
  };
}

describe("GcsArtifactStore.create — fail-closed construction (ADR-0267)", () => {
  test("refuses a bucket without Object Retention Lock enabled", async () => {
    const { transport } = makeGcsStub(() =>
      json({ objectRetention: { mode: "Disabled" } }),
    );
    await expect(
      GcsArtifactStore.create({ transport, bucket: BUCKET }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("refuses a bucket with no objectRetention field at all", async () => {
    const { transport } = makeGcsStub(() => json({}));
    await expect(
      GcsArtifactStore.create({ transport, bucket: BUCKET }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("refuses when the bucket-metadata read itself fails", async () => {
    const { transport } = makeGcsStub(() => json({}, 500));
    await expect(
      GcsArtifactStore.create({ transport, bucket: BUCKET }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("constructs when Object Retention Lock is enabled", async () => {
    const { transport } = makeGcsStub(() => ENABLED_BUCKET());
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    expect(store).toBeInstanceOf(GcsArtifactStore);
  });
});

describe("GcsArtifactStore.put (write-once + retention lock)", () => {
  test("returns the exact GCS object generation recorded by the create-only insert", async () => {
    const { transport } = makeGcsStub(
      router({
        onInsert: () =>
          json({
            generation: "1742000000000042",
            size: "2",
            retention: {
              mode: "Unlocked",
              retainUntilTime: RETAIN.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "proof.bin");

    const meta = await store.put(key, new Uint8Array([4, 2]), {
      retainUntil: RETAIN,
    });

    expect(meta.versionId).toBe("1742000000000042");
  });

  test("issues a multipart ifGenerationMatch=0 insert with retention.retainUntilTime and returns meta", async () => {
    const { transport, calls } = makeGcsStub(
      router({
        onInsert: async (call) => {
          const text = await (call.init.body as Blob).text();
          expect(text).toContain(
            '"retainUntilTime":"2033-01-01T00:00:00.000Z"',
          );
          expect(text).toContain('"mode":"Unlocked"');
          expect(text).toContain("hello world");
          return json({
            generation: "1742000000000043",
            size: "11",
            contentType: "text/plain",
            retention: {
              mode: "Unlocked",
              retainUntilTime: RETAIN.toISOString(),
            },
          });
        },
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "3.json");
    const meta = await store.put(key, new TextEncoder().encode("hello world"), {
      retainUntil: RETAIN,
      contentType: "text/plain",
    });
    expect(meta.key).toBe(key);
    expect(meta.size).toBe(11);
    expect(meta.contentType).toBe("text/plain");
    expect(meta.retainUntil).toEqual(RETAIN);
    expect(meta.versionId).toBe("1742000000000043");

    const insertCall = calls.find((c) =>
      c.url.includes("uploadType=multipart"),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall!.url).toContain("ifGenerationMatch=0");
    const contentTypeHeader = (
      insertCall!.init.headers as Record<string, string>
    )["Content-Type"];
    expect(contentTypeHeader).toMatch(/^multipart\/related; boundary=/);
  });

  test("a 412 (key already locked) becomes ArtifactExistsError — write-once", async () => {
    const { transport } = makeGcsStub(
      router({ onInsert: () => new Response("", { status: 412 }) }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
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

  test("a 409 (key already locked) also becomes ArtifactExistsError", async () => {
    const { transport } = makeGcsStub(
      router({ onInsert: () => new Response("", { status: 409 }) }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "2.json"),
        new Uint8Array([1]),
        {
          retainUntil: RETAIN,
        },
      ),
    ).rejects.toBeInstanceOf(ArtifactExistsError);
  });

  test("a non-412/409 error is NOT swallowed as a WORM conflict", async () => {
    const { transport } = makeGcsStub(
      router({ onInsert: () => new Response("", { status: 503 }) }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const putting = store.put(
      buildArtifactKey(ACCOUNT_A, "x.bin"),
      new Uint8Array([1]),
      {
        retainUntil: RETAIN,
      },
    );
    await expect(putting).rejects.not.toBeInstanceOf(ArtifactExistsError);
  });
});

describe("GcsArtifactStore.get / head", () => {
  test("targets a caller-recorded generation on get and head", async () => {
    const generation = "1742000000000042";
    const { transport, calls } = makeGcsStub(
      router({
        onObjectGet: (call) =>
          call.url.includes("alt=media")
            ? new Response(new Uint8Array([4, 2]))
            : json({
                generation,
                size: "2",
                retention: {
                  mode: "Unlocked",
                  retainUntilTime: RETAIN.toISOString(),
                },
              }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "proof.bin");

    await store.get(key, generation);
    await store.head(key, generation);

    const objectCalls = calls.filter((call) => call.url.includes("/o/"));
    expect(objectCalls).toHaveLength(3);
    for (const call of objectCalls) {
      expect(new URL(call.url).searchParams.get("generation")).toBe(generation);
    }
  });

  test("fails closed when exact-version metadata reports a different generation", async () => {
    const { transport } = makeGcsStub(
      router({
        onObjectGet: () =>
          json({
            generation: "replacement-generation",
            size: "2",
            retention: {
              mode: "Unlocked",
              retainUntilTime: RETAIN.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "proof.bin");

    await expect(store.head(key, "recorded-generation")).rejects.toThrow(
      /generation/i,
    );
  });

  test("get round-trips the body, size, retain date, and content-type", async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const { transport } = makeGcsStub(
      router({
        onObjectGet: (call) => {
          if (call.url.includes("alt=media")) {
            return new Response(bytes);
          }
          return json({
            generation: PROVIDER_GENERATION,
            size: "3",
            contentType: "application/json",
            retention: {
              mode: "Unlocked",
              retainUntilTime: RETAIN.toISOString(),
            },
          });
        },
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const key = buildArtifactKey(ACCOUNT_A, "evidence", "pack.bin");

    const obj = await store.get(key);
    expect([...obj.body]).toEqual([10, 20, 30]);
    expect(obj.size).toBe(3);
    expect(obj.contentType).toBe("application/json");
    expect(obj.retainUntil).toEqual(RETAIN);
  });

  test("get on a missing key (404) throws NotFoundError", async () => {
    const { transport } = makeGcsStub(
      router({ onObjectGet: () => new Response("", { status: 404 }) }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    await expect(
      store.get(buildArtifactKey(ACCOUNT_A, "missing.bin")),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("head returns metadata for a present key", async () => {
    const { transport } = makeGcsStub(
      router({
        onObjectGet: () =>
          json({
            generation: PROVIDER_GENERATION,
            size: "42",
            contentType: "application/octet-stream",
            retention: {
              mode: "Unlocked",
              retainUntilTime: RETAIN.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const meta = await store.head(
      buildArtifactKey(ACCOUNT_A, "head", "probe.bin"),
    );
    expect(meta).not.toBeNull();
    expect(meta!.size).toBe(42);
    expect(meta!.contentType).toBe("application/octet-stream");
    expect(meta!.retainUntil).toEqual(RETAIN);
  });

  test("head returns null for an absent key (404) — a non-throwing presence probe", async () => {
    const { transport } = makeGcsStub(
      router({ onObjectGet: () => new Response("", { status: 404 }) }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    expect(
      await store.head(buildArtifactKey(ACCOUNT_A, "absent.bin")),
    ).toBeNull();
  });
});

describe("tenant isolation + traversal guard", () => {
  test("an unsafe key is rejected before any GCS call (put/get/head)", async () => {
    const { transport, calls } = makeGcsStub(router({}));
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    calls.length = 0; // discard the construction call
    const bad = `${ACCOUNT_A}/../escape.bin`;

    await expect(
      store.put(bad, new Uint8Array([1]), { retainUntil: RETAIN }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(store.get(bad)).rejects.toBeInstanceOf(ValidationError);
    await expect(store.head(bad)).rejects.toBeInstanceOf(ValidationError);

    expect(calls).toHaveLength(0);
  });
});

// --- ADR-0267 (mirroring ADR-0202): strictly-monotonic retention escalation ---

const CURRENT = new Date(Date.UTC(2033, 0, 1));
const LATER = new Date(Date.UTC(2034, 0, 1));
const EARLIER = new Date(Date.UTC(2032, 0, 1));

describe("GcsArtifactStore.extendRetention (extend-only)", () => {
  const key = buildArtifactKey(ACCOUNT_A, "evidence", "pack.bin");

  test("a strictly-later date issues a PATCH with the new retainUntilTime", async () => {
    const { transport, calls } = makeGcsStub(
      router({
        onObjectGet: () =>
          json({
            generation: PROVIDER_GENERATION,
            size: "3",
            retention: {
              mode: "Unlocked",
              retainUntilTime: CURRENT.toISOString(),
            },
          }),
        onPatch: () =>
          json({
            generation: PROVIDER_GENERATION,
            size: "3",
            retention: {
              mode: "Unlocked",
              retainUntilTime: LATER.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const meta = await store.extendRetention(key, LATER);
    expect(meta.retainUntil).toEqual(LATER);
    const patchCall = calls.find((c) => c.init.method === "PATCH");
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall!.init.body as string) as {
      retention: { mode: string; retainUntilTime: string };
    };
    expect(body.retention.mode).toBe("Unlocked");
    expect(body.retention.retainUntilTime).toBe(LATER.toISOString());
  });

  test("targets the caller-recorded generation throughout a retention extension", async () => {
    const generation = "1742000000000042";
    const { transport, calls } = makeGcsStub(
      router({
        onObjectGet: () =>
          json({
            generation,
            size: "3",
            retention: {
              mode: "Unlocked",
              retainUntilTime: CURRENT.toISOString(),
            },
          }),
        onPatch: () =>
          json({
            generation,
            size: "3",
            retention: {
              mode: "Unlocked",
              retainUntilTime: LATER.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });

    await store.extendRetention(key, LATER, generation);

    const objectCalls = calls.filter((call) => call.url.includes("/o/"));
    expect(objectCalls).toHaveLength(2);
    for (const call of objectCalls) {
      expect(new URL(call.url).searchParams.get("generation")).toBe(generation);
    }
  });

  test("fails closed when PATCH reports another generation or under-applies retention", async () => {
    const generation = "1742000000000042";
    const makeStore = async (
      patch: Record<string, unknown>,
    ): Promise<GcsArtifactStore> => {
      const { transport } = makeGcsStub(
        router({
          onObjectGet: () =>
            json({
              generation,
              size: "3",
              retention: {
                mode: "Unlocked",
                retainUntilTime: CURRENT.toISOString(),
              },
            }),
          onPatch: () => json(patch),
        }),
      );
      return GcsArtifactStore.create({ transport, bucket: BUCKET });
    };

    await expect(
      (
        await makeStore({
          generation: "replacement-generation",
          size: "3",
          retention: {
            mode: "Unlocked",
            retainUntilTime: LATER.toISOString(),
          },
        })
      ).extendRetention(key, LATER, generation),
    ).rejects.toThrow(/generation/i);

    await expect(
      (
        await makeStore({
          generation,
          size: "3",
          retention: {
            mode: "Unlocked",
            retainUntilTime: CURRENT.toISOString(),
          },
        })
      ).extendRetention(key, LATER, generation),
    ).rejects.toThrow(/retention/i);
  });

  test.each([
    ["an equal", CURRENT],
    ["an earlier", EARLIER],
  ])(
    "%s date is refused fail-closed BEFORE any PATCH",
    async (_label, requested) => {
      const { transport, calls } = makeGcsStub(
        router({
          onObjectGet: () =>
            json({
              generation: PROVIDER_GENERATION,
              size: "3",
              retention: {
                mode: "Unlocked",
                retainUntilTime: CURRENT.toISOString(),
              },
            }),
        }),
      );
      const store = await GcsArtifactStore.create({
        transport,
        bucket: BUCKET,
      });
      await expect(
        store.extendRetention(key, requested),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(calls.some((c) => c.init.method === "PATCH")).toBe(false);
    },
  );

  test("an object with NO current retention gains one — extend-from-nothing strengthens", async () => {
    const { transport } = makeGcsStub(
      router({
        onObjectGet: () => json({ generation: PROVIDER_GENERATION, size: "1" }),
        onPatch: () =>
          json({
            generation: PROVIDER_GENERATION,
            size: "1",
            retention: {
              mode: "Unlocked",
              retainUntilTime: LATER.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    const meta = await store.extendRetention(key, LATER);
    expect(meta.retainUntil).toEqual(LATER);
  });

  test("a missing object (404) is NotFoundError", async () => {
    const { transport } = makeGcsStub(
      router({ onObjectGet: () => new Response("", { status: 404 }) }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    await expect(store.extendRetention(key, LATER)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test("an unsafe key or an invalid date is rejected before any GCS call", async () => {
    const { transport, calls } = makeGcsStub(router({}));
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    calls.length = 0;
    await expect(
      store.extendRetention(`${ACCOUNT_A}/../escape.bin`, LATER),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      store.extendRetention(key, new Date(Number.NaN)),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
});

// --- RFC 7523 JWT-bearer signing round-trip (no network) ---

describe("mintGcsAccessToken — RS256 signing (no network call)", () => {
  const realFetch = globalThis.fetch;

  test("signs a valid RS256 assertion the token endpoint would accept, verifiable with the public key", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    let capturedBody = "";
    globalThis.fetch = (async (
      _url: unknown,
      init?: { body?: URLSearchParams },
    ) => {
      capturedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          access_token: "test-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    try {
      const result = await mintGcsAccessToken({
        clientEmail: "worm@example-project.iam.gserviceaccount.com",
        privateKey,
      });
      expect(result.token).toBe("test-token");

      const params = new URLSearchParams(capturedBody);
      const assertion = params.get("assertion") ?? "";
      const [headerB64, claimsB64, sigB64] = assertion.split(".");
      expect(headerB64 && claimsB64 && sigB64).toBeTruthy();
      const signingInput = `${headerB64}.${claimsB64}`;
      const verified = createVerify("RSA-SHA256")
        .update(signingInput)
        .end()
        .verify(publicKey, Buffer.from(sigB64 ?? "", "base64url"));
      expect(verified).toBe(true);

      const claims = JSON.parse(
        Buffer.from(claimsB64 ?? "", "base64url").toString("utf8"),
      ) as { iss: string; aud: string; scope: string };
      expect(claims.iss).toBe("worm@example-project.iam.gserviceaccount.com");
      expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
      expect(claims.scope).toBe(
        "https://www.googleapis.com/auth/devstorage.read_write",
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("throws ConfigError when the token endpoint rejects the exchange", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    globalThis.fetch = (async () =>
      new Response("", { status: 401 })) as unknown as typeof fetch;
    try {
      await expect(
        mintGcsAccessToken({
          clientEmail: "worm@example-project.iam.gserviceaccount.com",
          privateKey,
        }),
      ).rejects.toBeInstanceOf(ConfigError);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

// --- Fail-closed regression locks (2026-07-06 SHIP-audit findings) ---

describe("GcsArtifactStore.put — applied-retention assertion + header-injection guard", () => {
  test("an accepted insert whose response carries NO applied retention is an error, not success", async () => {
    const { transport } = makeGcsStub(
      router({
        // GCS accepts the object but the resource echoes no retention — API drift; the object
        // would sit unprotected while the caller records a retain_until row.
        onInsert: () =>
          json({
            generation: PROVIDER_GENERATION,
            size: "1",
            contentType: "text/plain",
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "noret.json"),
        new Uint8Array([1]),
        { retainUntil: RETAIN },
      ),
    ).rejects.toThrow(/did not apply the requested retention/);
  });

  test("an applied retention SHORTER than requested is also refused", async () => {
    const { transport } = makeGcsStub(
      router({
        onInsert: () =>
          json({
            generation: PROVIDER_GENERATION,
            size: "1",
            retention: {
              mode: "Unlocked",
              retainUntilTime: new Date(
                RETAIN.getTime() - 60_000,
              ).toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "short.json"),
        new Uint8Array([1]),
        { retainUntil: RETAIN },
      ),
    ).rejects.toThrow(/did not apply the requested retention/);
  });

  test("an accepted insert with the wrong retention mode is refused", async () => {
    const { transport } = makeGcsStub(
      router({
        onInsert: () =>
          json({
            generation: "1742000000000042",
            size: "1",
            retention: {
              mode: "Locked",
              retainUntilTime: RETAIN.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });

    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "wrong-mode.json"),
        new Uint8Array([1]),
        { retainUntil: RETAIN },
      ),
    ).rejects.toThrow(/retention/i);
  });

  test("a contentType carrying CR/LF (MIME header injection) is rejected before any call", async () => {
    const { transport, calls } = makeGcsStub(router({}));
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });
    // Construction performs the bucket-metadata read; nothing after that may fire.
    const callsAfterCreate = calls.length;
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "evil.json"),
        new Uint8Array([1]),
        {
          retainUntil: RETAIN,
          contentType: "text/plain\r\nX-Injected: yes",
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(callsAfterCreate);
  });

  test("an accepted insert without an exact generation identity fails closed", async () => {
    const { transport } = makeGcsStub(
      router({
        onInsert: () =>
          json({
            size: "1",
            retention: {
              mode: "Unlocked",
              retainUntilTime: RETAIN.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });

    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "anchors", "no-generation.json"),
        new Uint8Array([1]),
        { retainUntil: RETAIN },
      ),
    ).rejects.toThrow(/generation/i);
  });
});

describe("GcsArtifactStore provider response validation", () => {
  const key = buildArtifactKey(ACCOUNT_A, "evidence", "provider.json");

  test.each([
    ["a missing generation", { size: "1" }],
    [
      "a malformed size",
      { generation: "1742000000000042", size: "not-a-number" },
    ],
    ["a missing size", { generation: "1742000000000042" }],
    [
      "an invalid retention date",
      {
        generation: "1742000000000042",
        size: "1",
        retention: { mode: "Unlocked", retainUntilTime: "not-a-date" },
      },
    ],
    [
      "an unknown retention mode",
      {
        generation: "1742000000000042",
        size: "1",
        retention: {
          mode: "Surprise",
          retainUntilTime: RETAIN.toISOString(),
        },
      },
    ],
  ])("rejects %s in object metadata", async (_label, metadata) => {
    const { transport } = makeGcsStub(
      router({ onObjectGet: () => json(metadata) }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });

    await expect(store.head(key)).rejects.toThrow(/metadata|validation/i);
  });

  test("rejects a PATCH response that keeps the wrong retention mode", async () => {
    const generation = "1742000000000042";
    const { transport } = makeGcsStub(
      router({
        onObjectGet: () =>
          json({
            generation,
            size: "1",
            retention: {
              mode: "Unlocked",
              retainUntilTime: CURRENT.toISOString(),
            },
          }),
        onPatch: () =>
          json({
            generation,
            size: "1",
            retention: {
              mode: "Locked",
              retainUntilTime: LATER.toISOString(),
            },
          }),
      }),
    );
    const store = await GcsArtifactStore.create({ transport, bucket: BUCKET });

    await expect(store.extendRetention(key, LATER, generation)).rejects.toThrow(
      /retention/i,
    );
  });
});
