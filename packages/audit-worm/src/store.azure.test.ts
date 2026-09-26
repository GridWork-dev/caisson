// Unit tests for the Azure Blob version-level WORM ArtifactStore (ADR-0379/0380). The injected
// client below is stateful but entirely in-memory: CI proves SDK call shapes, create-only semantics,
// exact-version reads, read-back immutability, and monotonic retention without touching Azure.
import { describe, expect, test } from "bun:test";
import type { ContainerClient } from "@azure/storage-blob";
import {
  ConfigError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "@caisson-sh/kernel";
import { ArtifactExistsError, buildArtifactKey } from "./store.ts";
import {
  AzureBlobArtifactStore,
  type AzureBlobClient,
  type AzureBlobContainerClient,
  type AzureBlobProperties,
  type AzureBlockBlobClient,
  type AzureBlockBlobUploadOptions,
} from "./store.azure.ts";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const RETAIN = new Date(Date.UTC(2033, 0, 1));
const LATER = new Date(Date.UTC(2034, 0, 1));
const EARLIER = new Date(Date.UTC(2032, 0, 1));
const VERSION = "2026-07-25T21:42:00.0000000Z";

type AzureSdkClientIsInjectable =
  ContainerClient extends AzureBlobContainerClient ? true : false;
const AZURE_SDK_CLIENT_IS_INJECTABLE: AzureSdkClientIsInjectable = true;

interface StoredBlob {
  body: Uint8Array;
  contentType?: string;
  versionId: string;
  retainUntil: Date;
  mode: "Unlocked" | "Locked";
}

interface AzureStubOptions {
  supported?: boolean;
  uploadVersionId?: string | undefined;
  readBackMode?: "Mutable" | "Unlocked" | "Locked";
  readBackRetainUntil?: Date | undefined;
}

interface AzureStub {
  client: AzureBlobContainerClient;
  calls: {
    containerProperties: number;
    uploads: {
      key: string;
      body: Uint8Array;
      options: AzureBlockBlobUploadOptions;
    }[];
    selectedVersions: { key: string; versionId: string }[];
    properties: { key: string; versionId?: string }[];
    downloads: { key: string; versionId?: string }[];
    policies: {
      key: string;
      versionId?: string;
      expiriesOn?: Date;
      policyMode?: string;
    }[];
  };
}

function azureError(statusCode: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode, code });
}

function makeAzureStub(options: AzureStubOptions = {}): AzureStub {
  const objects = new Map<string, StoredBlob>();
  const calls: AzureStub["calls"] = {
    containerProperties: 0,
    uploads: [],
    selectedVersions: [],
    properties: [],
    downloads: [],
    policies: [],
  };

  const clientFor = (
    key: string,
    selectedVersion?: string,
  ): AzureBlockBlobClient => {
    const resolveBlob = (): StoredBlob => {
      const blob = objects.get(key);
      if (
        blob === undefined ||
        (selectedVersion !== undefined && selectedVersion !== blob.versionId)
      ) {
        throw azureError(404, "BlobNotFound");
      }
      return blob;
    };

    const client: AzureBlockBlobClient = {
      withVersion(versionId: string): AzureBlobClient {
        calls.selectedVersions.push({ key, versionId });
        return clientFor(key, versionId);
      },
      async getProperties(): Promise<AzureBlobProperties> {
        calls.properties.push({
          key,
          ...(selectedVersion !== undefined
            ? { versionId: selectedVersion }
            : {}),
        });
        const blob = resolveBlob();
        return {
          contentLength: blob.body.byteLength,
          ...(blob.contentType !== undefined
            ? { contentType: blob.contentType }
            : {}),
          versionId: blob.versionId,
          immutabilityPolicyExpiresOn:
            options.readBackRetainUntil ?? blob.retainUntil,
          immutabilityPolicyMode: options.readBackMode ?? blob.mode,
        };
      },
      async downloadToBuffer(): Promise<Uint8Array> {
        calls.downloads.push({
          key,
          ...(selectedVersion !== undefined
            ? { versionId: selectedVersion }
            : {}),
        });
        return new Uint8Array(resolveBlob().body);
      },
      async setImmutabilityPolicy(policy): Promise<AzureBlobProperties> {
        calls.policies.push({
          key,
          ...(selectedVersion !== undefined
            ? { versionId: selectedVersion }
            : {}),
          ...(policy.expiriesOn !== undefined
            ? { expiriesOn: policy.expiriesOn }
            : {}),
          ...(policy.policyMode !== undefined
            ? { policyMode: policy.policyMode }
            : {}),
        });
        const blob = resolveBlob();
        if (policy.expiriesOn !== undefined)
          blob.retainUntil = policy.expiriesOn;
        if (
          policy.policyMode === "Unlocked" ||
          policy.policyMode === "Locked"
        ) {
          blob.mode = policy.policyMode;
        }
        return {
          contentLength: blob.body.byteLength,
          versionId: blob.versionId,
          immutabilityPolicyExpiresOn: blob.retainUntil,
          immutabilityPolicyMode: blob.mode,
        };
      },
      async upload(
        body: Uint8Array,
        _contentLength: number,
        uploadOptions: AzureBlockBlobUploadOptions,
      ): Promise<{ versionId?: string }> {
        calls.uploads.push({
          key,
          body: new Uint8Array(body),
          options: uploadOptions,
        });
        if (objects.has(key)) throw azureError(412, "ConditionNotMet");
        const versionId =
          options.uploadVersionId === undefined
            ? VERSION
            : options.uploadVersionId;
        if (versionId !== "") {
          const contentType = uploadOptions.blobHTTPHeaders?.blobContentType;
          const blob: StoredBlob = {
            body: new Uint8Array(body),
            versionId,
            retainUntil: uploadOptions.immutabilityPolicy.expiriesOn ?? RETAIN,
            mode:
              uploadOptions.immutabilityPolicy.policyMode === "Locked"
                ? "Locked"
                : "Unlocked",
          };
          if (contentType !== undefined) blob.contentType = contentType;
          objects.set(key, blob);
        }
        return versionId === "" ? {} : { versionId };
      },
    };
    return client;
  };

  return {
    client: {
      async getProperties() {
        calls.containerProperties += 1;
        return {
          isImmutableStorageWithVersioningEnabled: options.supported ?? true,
        };
      },
      getBlockBlobClient(key: string) {
        return clientFor(key);
      },
    },
    calls,
  };
}

describe("AzureBlobArtifactStore.create — strict, fail-closed capability gate", () => {
  test("accepts the installed @azure/storage-blob ContainerClient shape", () => {
    expect(AZURE_SDK_CLIENT_IS_INJECTABLE).toBe(true);
  });

  test("refuses a container without version-level immutable storage", async () => {
    const stub = makeAzureStub({ supported: false });
    await expect(
      AzureBlobArtifactStore.create({ client: stub.client }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  test("rejects unknown config fields before touching the injected client", async () => {
    const stub = makeAzureStub();
    await expect(
      AzureBlobArtifactStore.create({
        client: stub.client,
        unexpected: true,
      } as unknown as { client: AzureBlobContainerClient }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(stub.calls.containerProperties).toBe(0);
  });

  test("constructs only after the container proves version-level WORM support", async () => {
    const stub = makeAzureStub();
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    expect(store).toBeInstanceOf(AzureBlobArtifactStore);
    expect(stub.calls.containerProperties).toBe(1);
  });
});

describe("AzureBlobArtifactStore.put — create-only + read-back immutability", () => {
  test("creates with If-None-Match, records version identity, and verifies the exact version", async () => {
    const stub = makeAzureStub();
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "proof.bin");

    const meta = await store.put(key, new Uint8Array([4, 2]), {
      retainUntil: RETAIN,
      contentType: "application/octet-stream",
    });

    expect(meta).toEqual({
      key,
      size: 2,
      versionId: VERSION,
      retainUntil: RETAIN,
      contentType: "application/octet-stream",
    });
    expect(stub.calls.uploads[0]?.options).toMatchObject({
      conditions: { ifNoneMatch: "*" },
      blobHTTPHeaders: { blobContentType: "application/octet-stream" },
      immutabilityPolicy: {
        expiriesOn: RETAIN,
        policyMode: "Unlocked",
      },
    });
    expect(stub.calls.selectedVersions).toContainEqual({
      key,
      versionId: VERSION,
    });
    expect(stub.calls.properties.at(-1)).toEqual({
      key,
      versionId: VERSION,
    });
  });

  test("maps a conditional-write conflict to ArtifactExistsError and preserves original bytes", async () => {
    const stub = makeAzureStub();
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "duplicate.bin");
    await store.put(key, new Uint8Array([1]), { retainUntil: RETAIN });

    await expect(
      store.put(key, new Uint8Array([2]), { retainUntil: RETAIN }),
    ).rejects.toBeInstanceOf(ArtifactExistsError);
    expect([...(await store.get(key, VERSION)).body]).toEqual([1]);
  });

  test("fails closed when Azure returns no version identity", async () => {
    const stub = makeAzureStub({ uploadVersionId: "" });
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "versions", "no-version.bin"),
        new Uint8Array([1]),
        { retainUntil: RETAIN },
      ),
    ).rejects.toBeInstanceOf(InternalError);
  });

  test.each([
    ["a mutable read-back", { readBackMode: "Mutable" as const }],
    [
      "a shorter read-back retention",
      { readBackRetainUntil: new Date(RETAIN.getTime() - 1) },
    ],
  ])("fails closed on %s", async (_label, options) => {
    const stub = makeAzureStub(options);
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    await expect(
      store.put(
        buildArtifactKey(ACCOUNT_A, "versions", "unprotected.bin"),
        new Uint8Array([1]),
        { retainUntil: RETAIN },
      ),
    ).rejects.toBeInstanceOf(InternalError);
  });
});

describe("AzureBlobArtifactStore exact-version reads and monotonic retention", () => {
  test("get/head target the caller-recorded version and return it in metadata", async () => {
    const stub = makeAzureStub();
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "read.bin");
    const written = await store.put(key, new Uint8Array([4, 2]), {
      retainUntil: RETAIN,
    });

    const object = await store.get(key, written.versionId);
    const head = await store.head(key, written.versionId);

    expect([...object.body]).toEqual([4, 2]);
    expect(object.versionId).toBe(VERSION);
    expect(head?.versionId).toBe(VERSION);
    expect(stub.calls.downloads.at(-1)).toEqual({
      key,
      versionId: VERSION,
    });
  });

  test("extends only the caller-recorded version and reads the applied policy back", async () => {
    const stub = makeAzureStub();
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "extend.bin");
    const written = await store.put(key, new Uint8Array([1]), {
      retainUntil: RETAIN,
    });

    const meta = await store.extendRetention(key, LATER, written.versionId);

    expect(meta.retainUntil).toEqual(LATER);
    expect(meta.versionId).toBe(VERSION);
    expect(stub.calls.policies.at(-1)).toEqual({
      key,
      versionId: VERSION,
      expiriesOn: LATER,
      policyMode: "Unlocked",
    });
    expect(stub.calls.properties.at(-1)).toEqual({
      key,
      versionId: VERSION,
    });
  });

  test.each([
    ["equal", RETAIN],
    ["earlier", EARLIER],
  ])(
    "refuses an %s retention before setting a policy",
    async (_label, date) => {
      const stub = makeAzureStub();
      const store = await AzureBlobArtifactStore.create({
        client: stub.client,
      });
      const key = buildArtifactKey(ACCOUNT_A, "versions", "monotonic.bin");
      const written = await store.put(key, new Uint8Array([1]), {
        retainUntil: RETAIN,
      });
      const policyCalls = stub.calls.policies.length;

      await expect(
        store.extendRetention(key, date, written.versionId),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(stub.calls.policies).toHaveLength(policyCalls);
    },
  );

  test("maps missing get/extend to NotFoundError and missing head to null", async () => {
    const stub = makeAzureStub();
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    const key = buildArtifactKey(ACCOUNT_A, "versions", "missing.bin");

    await expect(store.get(key, VERSION)).rejects.toBeInstanceOf(NotFoundError);
    expect(await store.head(key, VERSION)).toBeNull();
    await expect(
      store.extendRetention(key, LATER, VERSION),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("rejects unsafe keys, invalid dates, and invalid version ids before SDK I/O", async () => {
    const stub = makeAzureStub();
    const store = await AzureBlobArtifactStore.create({
      client: stub.client,
    });
    const before = stub.calls.selectedVersions.length;
    const key = buildArtifactKey(ACCOUNT_A, "versions", "validation.bin");

    await expect(
      store.get(`${ACCOUNT_A}/../escape.bin`, VERSION),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(store.head(key, "")).rejects.toBeInstanceOf(ValidationError);
    await expect(
      store.extendRetention(key, new Date(Number.NaN), VERSION),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(stub.calls.selectedVersions).toHaveLength(before);
  });
});
