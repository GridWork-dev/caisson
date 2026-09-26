// src/store.azure.ts — Azure Blob version-level WORM ArtifactStore (ADR-0379/0380).
//
// The Azure SDK client is injected; this module never reads ambient credentials. Construction
// verifies the container advertises version-level immutable storage before a usable store exists.
// Writes are create-only (`If-None-Match: *`) and carry an Unlocked version policy (the Azure
// analogue of GOVERNANCE). Every accepted write is read back through its returned version id and
// treated as failed unless Azure proves the exact version is immutable through at least the
// requested date. Reads and retention extensions accept the recorded version id and use
// `withVersion` so a later current version can never be mistaken for the original artifact.
import { z } from "zod";
import {
  ConfigError,
  InternalError,
  NotFoundError,
  ValidationError,
  parseStrict,
  strictObject,
} from "@caisson-sh/kernel";
import {
  ArtifactExistsError,
  assertSafeKey,
  assertValidArtifactVersionId,
  assertValidRetainUntil,
  type ArtifactMeta,
  type ArtifactObject,
  type ArtifactStore,
  type PutOptions,
} from "./store.ts";

export interface AzureBlobImmutabilityPolicy {
  expiriesOn?: Date;
  policyMode?: "Mutable" | "Unlocked" | "Locked";
}

export interface AzureBlockBlobUploadOptions {
  conditions: { ifNoneMatch: "*" };
  blobHTTPHeaders?: { blobContentType: string };
  immutabilityPolicy: AzureBlobImmutabilityPolicy;
}

/** The subset of Azure Blob properties this adapter proves at its boundary. */
export interface AzureBlobProperties {
  contentLength?: number;
  contentType?: string;
  versionId?: string;
  immutabilityPolicyExpiresOn?: Date;
  immutabilityPolicyMode?: "Mutable" | "Unlocked" | "Locked";
}

/** Injected exact-version Blob client. A real SDK `BlobClient` satisfies this surface. */
export interface AzureBlobClient {
  withVersion(versionId: string): AzureBlobClient;
  getProperties(): Promise<AzureBlobProperties>;
  downloadToBuffer(): Promise<Uint8Array>;
  setImmutabilityPolicy(policy: AzureBlobImmutabilityPolicy): Promise<unknown>;
}

/** Injected create-capable client. A real SDK `BlockBlobClient` satisfies this surface. */
export interface AzureBlockBlobClient extends AzureBlobClient {
  upload(
    body: Uint8Array,
    contentLength: number,
    options: AzureBlockBlobUploadOptions,
  ): Promise<{ versionId?: string }>;
}

/** Injected container client. A real SDK `ContainerClient` satisfies this surface. */
export interface AzureBlobContainerClient {
  getProperties(): Promise<{
    isImmutableStorageWithVersioningEnabled?: boolean;
  }>;
  getBlockBlobClient(key: string): AzureBlockBlobClient;
}

export interface AzureBlobArtifactStoreConfig {
  client: AzureBlobContainerClient;
}

function isAzureBlobContainerClient(
  value: unknown,
): value is AzureBlobContainerClient {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof Reflect.get(value, "getProperties") === "function" &&
    typeof Reflect.get(value, "getBlockBlobClient") === "function"
  );
}

const AzureBlobArtifactStoreConfigSchema = strictObject({
  client: z.custom<AzureBlobContainerClient>(isAzureBlobContainerClient, {
    message:
      "client must implement Azure ContainerClient getProperties() and getBlockBlobClient()",
  }),
});

function httpStatusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const direct = Reflect.get(err, "statusCode");
  if (typeof direct === "number") return direct;
  const response = Reflect.get(err, "response");
  if (typeof response !== "object" || response === null) return undefined;
  const nested = Reflect.get(response, "status");
  return typeof nested === "number" ? nested : undefined;
}

function errorCodeOf(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = Reflect.get(err, "code");
  return typeof code === "string" ? code : undefined;
}

function isNotFound(err: unknown): boolean {
  return (
    httpStatusOf(err) === 404 ||
    errorCodeOf(err) === "BlobNotFound" ||
    errorCodeOf(err) === "ContainerNotFound"
  );
}

function isCreateConflict(err: unknown): boolean {
  const status = httpStatusOf(err);
  const code = errorCodeOf(err);
  return (
    status === 409 ||
    status === 412 ||
    code === "BlobAlreadyExists" ||
    code === "ConditionNotMet"
  );
}

function requiredProviderVersionId(
  versionId: string | undefined,
  key: string,
): string {
  if (versionId === undefined) {
    throw new InternalError(
      "audit-worm: Azure accepted the immutable write but returned no version identity",
      { key },
    );
  }
  try {
    assertValidArtifactVersionId(versionId);
  } catch {
    throw new InternalError(
      "audit-worm: Azure returned an invalid blob version identity",
      { key },
    );
  }
  return versionId;
}

function assertContentType(contentType: string | undefined): void {
  if (
    contentType !== undefined &&
    (contentType.length === 0 ||
      contentType.length > 255 ||
      /[^\x20-\x7e]/.test(contentType))
  ) {
    throw new ValidationError(
      "audit-worm: contentType must be printable ASCII and at most 255 characters",
    );
  }
}

/**
 * Azure Blob version-level WORM backend. Construct only through {@link create}; the capability
 * probe is asynchronous and fail-closed.
 */
export class AzureBlobArtifactStore implements ArtifactStore {
  private readonly client: AzureBlobContainerClient;

  private constructor(client: AzureBlobContainerClient) {
    this.client = client;
  }

  static async create(
    config: AzureBlobArtifactStoreConfig,
  ): Promise<AzureBlobArtifactStore> {
    const parsed = parseStrict(AzureBlobArtifactStoreConfigSchema, config);
    let properties: {
      isImmutableStorageWithVersioningEnabled?: boolean;
    };
    try {
      properties = await parsed.client.getProperties();
    } catch (err) {
      throw new ConfigError(
        "audit-worm: could not verify Azure Blob version-level WORM capability",
        { status: httpStatusOf(err) },
      );
    }
    if (properties.isImmutableStorageWithVersioningEnabled !== true) {
      throw new ConfigError(
        "audit-worm: Azure container does not have version-level immutable storage enabled",
      );
    }
    return new AzureBlobArtifactStore(parsed.client);
  }

  async put(
    key: string,
    body: Uint8Array,
    opts: PutOptions,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    assertValidRetainUntil(opts.retainUntil);
    assertContentType(opts.contentType);
    const base = this.client.getBlockBlobClient(key);
    let uploaded: { versionId?: string };
    try {
      uploaded = await base.upload(body, body.byteLength, {
        conditions: { ifNoneMatch: "*" },
        ...(opts.contentType !== undefined
          ? {
              blobHTTPHeaders: {
                blobContentType: opts.contentType,
              },
            }
          : {}),
        immutabilityPolicy: {
          expiriesOn: opts.retainUntil,
          policyMode: "Unlocked",
        },
      });
    } catch (err) {
      if (isCreateConflict(err)) throw new ArtifactExistsError(key);
      throw err;
    }
    const versionId = requiredProviderVersionId(uploaded.versionId, key);
    const properties = await this.readPropertiesOrThrow(key, versionId);
    this.assertProtected(key, versionId, properties, opts.retainUntil);
    if (properties.contentLength !== body.byteLength) {
      throw new InternalError(
        "audit-worm: Azure immutable write read-back size did not match the uploaded body",
        {
          key,
          expectedSize: body.byteLength,
          actualSize: properties.contentLength,
        },
      );
    }
    return this.metaFromProperties(key, versionId, properties);
  }

  async get(key: string, versionId?: string): Promise<ArtifactObject> {
    assertSafeKey(key);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    const properties = await this.readPropertiesOrThrow(key, versionId);
    this.assertRequestedVersion(key, versionId, properties.versionId);
    const recordedVersionId = requiredProviderVersionId(
      properties.versionId,
      key,
    );
    const exact = this.versionedClient(key, recordedVersionId);
    let body: Uint8Array;
    try {
      body = await exact.downloadToBuffer();
    } catch (err) {
      if (isNotFound(err)) {
        throw new NotFoundError("artifact not found", {
          key,
          versionId: recordedVersionId,
        });
      }
      throw err;
    }
    return {
      ...this.metaFromProperties(key, recordedVersionId, properties),
      body: new Uint8Array(body),
    };
  }

  async head(key: string, versionId?: string): Promise<ArtifactMeta | null> {
    assertSafeKey(key);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    const properties = await this.readProperties(key, versionId);
    if (properties === null) return null;
    this.assertRequestedVersion(key, versionId, properties.versionId);
    const recordedVersionId = requiredProviderVersionId(
      properties.versionId,
      key,
    );
    return this.metaFromProperties(key, recordedVersionId, properties);
  }

  async extendRetention(
    key: string,
    newRetainUntil: Date,
    versionId?: string,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    assertValidRetainUntil(newRetainUntil);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    const current = await this.readPropertiesOrThrow(key, versionId);
    this.assertRequestedVersion(key, versionId, current.versionId);
    const recordedVersionId = requiredProviderVersionId(current.versionId, key);
    const currentRetainUntil = current.immutabilityPolicyExpiresOn;
    if (
      currentRetainUntil === undefined ||
      (current.immutabilityPolicyMode !== "Unlocked" &&
        current.immutabilityPolicyMode !== "Locked")
    ) {
      throw new InternalError(
        "audit-worm: Azure blob version did not prove an active immutability policy",
        { key, versionId: recordedVersionId },
      );
    }
    if (newRetainUntil.getTime() <= currentRetainUntil.getTime()) {
      throw new ValidationError(
        "audit-worm: retention can only be EXTENDED — the new date must be strictly later than the current lock (ADR-0380)",
        {
          key,
          versionId: recordedVersionId,
          currentRetainUntil: currentRetainUntil.toISOString(),
          requested: newRetainUntil.toISOString(),
        },
      );
    }
    const exact = this.versionedClient(key, recordedVersionId);
    try {
      await exact.setImmutabilityPolicy({
        expiriesOn: newRetainUntil,
        policyMode: current.immutabilityPolicyMode,
      });
    } catch (err) {
      if (isNotFound(err)) {
        throw new NotFoundError("artifact not found", {
          key,
          versionId: recordedVersionId,
        });
      }
      throw err;
    }
    const applied = await this.readPropertiesOrThrow(key, recordedVersionId);
    this.assertProtected(key, recordedVersionId, applied, newRetainUntil);
    return this.metaFromProperties(key, recordedVersionId, applied);
  }

  private versionedClient(key: string, versionId: string): AzureBlobClient {
    return this.client.getBlockBlobClient(key).withVersion(versionId);
  }

  private async readProperties(
    key: string,
    versionId?: string,
  ): Promise<AzureBlobProperties | null> {
    const base = this.client.getBlockBlobClient(key);
    const blob = versionId === undefined ? base : base.withVersion(versionId);
    try {
      return await blob.getProperties();
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  private async readPropertiesOrThrow(
    key: string,
    versionId?: string,
  ): Promise<AzureBlobProperties> {
    const properties = await this.readProperties(key, versionId);
    if (properties === null) {
      throw new NotFoundError("artifact not found", {
        key,
        ...(versionId !== undefined ? { versionId } : {}),
      });
    }
    return properties;
  }

  private assertProtected(
    key: string,
    versionId: string,
    properties: AzureBlobProperties,
    requestedRetainUntil: Date,
  ): void {
    if (properties.versionId !== versionId) {
      throw new InternalError(
        "audit-worm: Azure immutable write read-back targeted a different blob version",
        {
          key,
          expectedVersionId: versionId,
          actualVersionId: properties.versionId,
        },
      );
    }
    const applied = properties.immutabilityPolicyExpiresOn;
    if (
      (properties.immutabilityPolicyMode !== "Unlocked" &&
        properties.immutabilityPolicyMode !== "Locked") ||
      applied === undefined ||
      !Number.isFinite(applied.getTime()) ||
      applied.getTime() < requestedRetainUntil.getTime()
    ) {
      throw new InternalError(
        "audit-worm: Azure blob version did not read back the requested immutability",
        {
          key,
          versionId,
          requested: requestedRetainUntil.toISOString(),
          applied: applied?.toISOString(),
          mode: properties.immutabilityPolicyMode,
        },
      );
    }
  }

  private assertRequestedVersion(
    key: string,
    requested: string | undefined,
    returned: string | undefined,
  ): void {
    if (requested === undefined) return;
    if (returned !== requested) {
      throw new InternalError(
        "audit-worm: Azure exact-version response did not match the recorded blob version",
        { key, requestedVersionId: requested, returnedVersionId: returned },
      );
    }
  }

  private metaFromProperties(
    key: string,
    versionId: string,
    properties: AzureBlobProperties,
  ): ArtifactMeta {
    const meta: ArtifactMeta = {
      key,
      size: properties.contentLength ?? 0,
      versionId,
    };
    if (properties.immutabilityPolicyExpiresOn !== undefined) {
      meta.retainUntil = properties.immutabilityPolicyExpiresOn;
    }
    if (properties.contentType !== undefined) {
      meta.contentType = properties.contentType;
    }
    return meta;
  }
}
