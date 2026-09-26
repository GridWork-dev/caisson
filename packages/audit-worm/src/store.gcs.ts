// src/store.gcs.ts — the GCS `ArtifactStore` backend (ADR-0267, extending ADR-0054/0051). Per-object
// Object Retention Lock (`retention: { mode, retainUntilTime }` on the object resource) is the ONLY
// GCS primitive that correctly honors an arbitrary per-put `retainUntil` — a bucket-level retention
// POLICY is a single fixed duration for the whole bucket and cannot express a caller-chosen date per
// object, so this driver refuses fail-closed at construction unless the bucket has Object Retention
// Lock enabled. Two invariants are enforced here, mirroring `S3ArtifactStore`:
//   1. Write-once — every insert uses `ifGenerationMatch=0` (GCS's create-only precondition, the
//      `IfNoneMatch:'*'` equivalent); a 412/409 becomes `ArtifactExistsError`.
//   2. Retention lock — every object carries `retention.mode` + `retention.retainUntilTime`, with
//      the date == the caller's `retainUntil` so the GCS lock date provably equals the DB row date.
//      `extendRetention` is strictly monotonic, mirroring S3's ADR-0202 extend-only contract.
//
// The HTTP transport is injected as `GcsSendable` (a single fetch-shaped call that attaches a fresh
// bearer token) — mirroring `S3Sendable`'s `Pick<S3Client,"send">` DI seam — so CI never makes a live
// Google call; only `createGcsServiceAccountTransport` (the real transport) is un-exercised by
// design, the same seam-real precedent as `field-crypto`'s `kms.ts` (ADR-0047) and
// `S3ArtifactStore`. No `@google-cloud/storage` dependency: four REST calls over `fetchWithTimeout`
// plus a ~40-line RFC 7523 JWT-bearer OAuth exchange (`node:crypto` RS256 sign) match every other
// no-SDK vendor driver in this repo (ADR-0267).
import { createSign, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ConfigError,
  InternalError,
  NotFoundError,
  ValidationError,
  fetchWithTimeout,
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

/**
 * The injected GCS HTTP transport — a single fetch-shaped call, mirroring `S3Sendable`. The REAL
 * transport ({@link createGcsServiceAccountTransport}) attaches a fresh OAuth bearer token per call;
 * tests inject a stub that never touches the network.
 */
export type GcsSendable = (url: string, init: RequestInit) => Promise<Response>;

/** GCS Object Retention Lock mode (`Unlocked` mirrors S3 GOVERNANCE — bypassable by a privileged
 *  override; `Locked` mirrors COMPLIANCE and is irreversible). This driver only ever writes
 *  `Unlocked` — no build-time path selects the irreversible mode (ADR-0051 posture). */
export type GcsRetentionMode = "Unlocked" | "Locked";

/** Construction config for {@link GcsArtifactStore}. */
export interface GcsArtifactStoreConfig {
  /** Injected HTTP transport (real service-account transport in prod, stub in CI). */
  transport: GcsSendable;
  /** The Object-Retention-Lock-enabled bucket. */
  bucket: string;
}

interface GcsRetentionResource {
  mode: GcsRetentionMode;
  retainUntil: Date;
}

interface GcsObjectResource {
  generation: string;
  size: number;
  contentType?: string;
  retention?: GcsRetentionResource;
}

const JsonRecordSchema = z.record(z.string(), z.unknown());
const GcsBucketProjectionSchema = strictObject({
  objectRetention: strictObject({ mode: z.literal("Enabled") }),
});
const GcsRetentionProjectionSchema = strictObject({
  mode: z.enum(["Unlocked", "Locked"]),
  retainUntil: z
    .string()
    .datetime({ offset: true })
    .transform((value) => new Date(value)),
});
const GcsObjectProjectionSchema = strictObject({
  generation: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .max(64),
  size: z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
  contentType: z.string().min(1).max(1_024).optional(),
  retention: GcsRetentionProjectionSchema.optional(),
});

function jsonRecord(input: unknown): Record<string, unknown> {
  return parseStrict(JsonRecordSchema, input);
}

/**
 * GCS resources contain many provider-owned fields that may grow over time. Project only the
 * fields this driver trusts, then strict-parse that projection so extra provider fields are ignored
 * while every security-relevant field is runtime validated.
 */
function projectGcsObject(input: unknown): GcsObjectResource {
  const raw = jsonRecord(input);
  let retention: unknown;
  if (raw.retention !== undefined) {
    const rawRetention = jsonRecord(raw.retention);
    retention = {
      mode: rawRetention.mode,
      retainUntil: rawRetention.retainUntilTime,
    };
  }
  const parsed = parseStrict(GcsObjectProjectionSchema, {
    generation: raw.generation,
    size: raw.size,
    contentType: raw.contentType,
    retention,
  });
  return {
    generation: parsed.generation,
    size: parsed.size,
    ...(parsed.contentType === undefined
      ? {}
      : { contentType: parsed.contentType }),
    ...(parsed.retention === undefined ? {} : { retention: parsed.retention }),
  };
}

/**
 * The GCS WORM backend (ADR-0267). Every key is `assertSafeKey`-guarded BEFORE any I/O; `put` is a
 * multipart insert with `ifGenerationMatch=0` (412/409 → `ArtifactExistsError`); `get` throws
 * `NotFoundError` on 404; `head` resolves `null` on 404. Construct via {@link GcsArtifactStore.create}
 * ONLY — the sync constructor cannot verify the bucket's Object Retention Lock capability, and an
 * un-verified store must never exist (fail-closed).
 */
export class GcsArtifactStore implements ArtifactStore {
  private readonly transport: GcsSendable;
  private readonly bucket: string;

  private constructor(config: GcsArtifactStoreConfig) {
    this.transport = config.transport;
    this.bucket = config.bucket.trim();
    if (this.bucket.length === 0) {
      throw new ValidationError(
        "audit-worm: GcsArtifactStore requires a bucket",
      );
    }
  }

  /**
   * The only sanctioned constructor. Verifies Object Retention Lock is ENABLED on the bucket before
   * returning a usable store (ADR-0267) — a bucket relying only on a bucket-level retention policy
   * cannot honor an arbitrary per-put `retainUntil`, so construction refuses fail-closed
   * (`ConfigError`) rather than silently under-retain every future write.
   */
  static async create(
    config: GcsArtifactStoreConfig,
  ): Promise<GcsArtifactStore> {
    const store = new GcsArtifactStore(config);
    await store.assertObjectRetentionEnabled();
    return store;
  }

  private async assertObjectRetentionEnabled(): Promise<void> {
    const res = await this.transport(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(this.bucket)}`,
      { method: "GET" },
    );
    if (!res.ok) {
      throw new ConfigError(
        "audit-worm: could not read GCS bucket metadata to verify Object Retention Lock",
        { bucket: this.bucket, status: res.status },
      );
    }
    try {
      const raw = jsonRecord(await res.json());
      parseStrict(GcsBucketProjectionSchema, {
        objectRetention:
          raw.objectRetention === undefined
            ? undefined
            : (() => {
                const objectRetention = jsonRecord(raw.objectRetention);
                return { mode: objectRetention.mode };
              })(),
      });
    } catch {
      throw new ConfigError(
        "audit-worm: GCS bucket does not have Object Retention Lock enabled — refusing to " +
          "construct a store that cannot honor an arbitrary per-put retention (ADR-0267)",
        { bucket: this.bucket },
      );
    }
  }

  async put(
    key: string,
    body: Uint8Array,
    opts: PutOptions,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    assertValidRetainUntil(opts.retainUntil);
    const contentType = opts.contentType ?? "application/octet-stream";
    // The content type is spliced into MIME part headers below — reject anything outside printable
    // ASCII so a CR/LF (header injection) or control byte can never reach the multipart envelope.
    if (/[^\x20-\x7e]/.test(contentType)) {
      throw new ValidationError(
        "audit-worm: contentType contains non-printable characters",
        { key },
      );
    }
    const boundary = `caisson-${randomUUID()}`;
    const metadata = {
      name: key,
      contentType,
      retention: {
        mode: "Unlocked" satisfies GcsRetentionMode,
        retainUntilTime: opts.retainUntil.toISOString(),
      },
    };
    const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;
    const url =
      `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o` +
      `?uploadType=multipart&ifGenerationMatch=0`;
    const res = await this.transport(url, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      // A bare `Uint8Array` types as `Uint8Array<ArrayBufferLike>` (covers SharedArrayBuffer too),
      // which `Blob`'s `BlobPart` union rejects; `new Uint8Array(body)` always allocates a fresh
      // ArrayBuffer-backed copy regardless of the source's backing buffer, satisfying the type
      // without an unsound cast.
      body: new Blob([head, new Uint8Array(body), tail]),
    });
    if (res.status === 412 || res.status === 409) {
      throw new ArtifactExistsError(key);
    }
    if (!res.ok) {
      throw new InternalError("audit-worm: GCS object insert failed", {
        key,
        status: res.status,
      });
    }
    const created = await this.readObjectResource(res, key, "immutable insert");
    // Fail-closed: don't trust the accepted insert — assert GCS actually APPLIED the requested
    // retention (a NaN/absent applied time fails the comparison and refuses). Without this, an
    // API-drift insert that ignored the retention field would return success while the object
    // sits unprotected (ADR-0267).
    const applied = created.retention?.retainUntil.getTime() ?? Number.NaN;
    if (
      created.retention?.mode !== "Unlocked" ||
      !(applied >= opts.retainUntil.getTime())
    ) {
      throw new InternalError(
        "audit-worm: GCS accepted the insert but did not apply the requested retention — " +
          "treating the object as unprotected (ADR-0267)",
        {
          key,
          requested: opts.retainUntil.toISOString(),
          appliedMode: created.retention?.mode,
          appliedRetainUntil: Number.isFinite(applied)
            ? created.retention?.retainUntil.toISOString()
            : undefined,
        },
      );
    }
    try {
      assertValidArtifactVersionId(created.generation);
    } catch {
      throw new InternalError(
        "audit-worm: GCS returned an invalid generation identity",
        { key },
      );
    }
    return this.metaFromResource(key, created, contentType);
  }

  async get(key: string, versionId?: string): Promise<ArtifactObject> {
    assertSafeKey(key);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    const meta = await this.headOrThrow(key, versionId);
    const res = await this.transport(
      this.objectUrl(key, { alt: "media" }, versionId),
      {
        method: "GET",
      },
    );
    if (res.status === 404) {
      throw new NotFoundError("artifact not found", { key });
    }
    if (!res.ok) {
      throw new InternalError("audit-worm: GCS object read failed", {
        key,
        status: res.status,
      });
    }
    const body = new Uint8Array(await res.arrayBuffer());
    return { ...meta, body };
  }

  async head(key: string, versionId?: string): Promise<ArtifactMeta | null> {
    assertSafeKey(key);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    const res = await this.transport(this.objectUrl(key, {}, versionId), {
      method: "GET",
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new InternalError("audit-worm: GCS object metadata read failed", {
        key,
        status: res.status,
      });
    }
    const resource = await this.readObjectResource(res, key, "metadata read");
    this.assertRequestedGeneration(key, versionId, resource.generation);
    return this.metaFromResource(key, resource);
  }

  /**
   * Extend the object's retention to a STRICTLY later date (mirrors S3's ADR-0202 contract). Reads
   * the current retention via a metadata GET, refuses anything not strictly later
   * (`ValidationError`, never clamps), then PATCHes the new date. An object with NO current
   * retention gains one (extend-from-nothing strengthens the lock). 404 → `NotFoundError`.
   */
  async extendRetention(
    key: string,
    newRetainUntil: Date,
    versionId?: string,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    assertValidRetainUntil(newRetainUntil);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    const current = await this.headOrThrow(key, versionId);
    if (
      current.retainUntil !== undefined &&
      newRetainUntil.getTime() <= current.retainUntil.getTime()
    ) {
      throw new ValidationError(
        "audit-worm: retention can only be EXTENDED — the new date must be strictly later than " +
          "the current lock (ADR-0267, mirroring ADR-0202)",
        {
          key,
          currentRetainUntil: current.retainUntil.toISOString(),
          requested: newRetainUntil.toISOString(),
        },
      );
    }
    const res = await this.transport(this.objectUrl(key, {}, versionId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retention: {
          mode: "Unlocked" satisfies GcsRetentionMode,
          retainUntilTime: newRetainUntil.toISOString(),
        },
      }),
    });
    if (res.status === 404) {
      throw new NotFoundError("artifact not found", { key });
    }
    if (!res.ok) {
      throw new InternalError("audit-worm: GCS retention extend failed", {
        key,
        status: res.status,
      });
    }
    const resource = await this.readObjectResource(res, key, "retention PATCH");
    this.assertRequestedGeneration(key, versionId, resource.generation);
    const applied = resource.retention?.retainUntil.getTime() ?? Number.NaN;
    if (
      resource.retention?.mode !== "Unlocked" ||
      !(applied >= newRetainUntil.getTime())
    ) {
      throw new InternalError(
        "audit-worm: GCS retention PATCH did not apply the requested retention",
        {
          key,
          requested: newRetainUntil.toISOString(),
          appliedMode: resource.retention?.mode,
          appliedRetainUntil: Number.isFinite(applied)
            ? resource.retention?.retainUntil.toISOString()
            : undefined,
        },
      );
    }
    return this.metaFromResource(key, resource);
  }

  private objectUrl(
    key: string,
    query: Record<string, string> = {},
    versionId?: string,
  ): string {
    const params = new URLSearchParams(query);
    if (versionId !== undefined) params.set("generation", versionId);
    const qs = params.toString();
    return (
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(this.bucket)}` +
      `/o/${encodeURIComponent(key)}${qs.length > 0 ? `?${qs}` : ""}`
    );
  }

  private async headOrThrow(
    key: string,
    versionId?: string,
  ): Promise<ArtifactMeta> {
    const meta = await this.head(key, versionId);
    if (meta === null) throw new NotFoundError("artifact not found", { key });
    return meta;
  }

  private assertRequestedGeneration(
    key: string,
    requested: string | undefined,
    returned: string | undefined,
  ): void {
    if (requested === undefined) return;
    if (returned !== requested) {
      throw new InternalError(
        "audit-worm: GCS exact-version response generation did not match the recorded generation",
        { key, requestedGeneration: requested, returnedGeneration: returned },
      );
    }
  }

  private async readObjectResource(
    response: Response,
    key: string,
    operation: string,
  ): Promise<GcsObjectResource> {
    try {
      return projectGcsObject(await response.json());
    } catch {
      throw new InternalError(
        "audit-worm: GCS object generation/size/retention metadata response failed validation",
        { key, operation },
      );
    }
  }

  private metaFromResource(
    key: string,
    resource: GcsObjectResource,
    fallbackContentType?: string,
  ): ArtifactMeta {
    const meta: ArtifactMeta = {
      key,
      size: resource.size,
      versionId: resource.generation,
    };
    const contentType = resource.contentType ?? fallbackContentType;
    if (contentType !== undefined) meta.contentType = contentType;
    if (resource.retention !== undefined) {
      meta.retainUntil = resource.retention.retainUntil;
    }
    return meta;
  }
}

// --- Real transport: RFC 7523 JWT-bearer service-account OAuth exchange ---

const DEFAULT_GCS_SCOPE =
  "https://www.googleapis.com/auth/devstorage.read_write";
const GCS_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** The service-account credentials {@link createGcsServiceAccountTransport} signs with. */
export interface GcsServiceAccountCredentials {
  clientEmail: string;
  /** PEM-encoded RSA private key (the `private_key` field of a GCP service-account JSON key). */
  privateKey: string;
  /** Defaults to the read-write Cloud Storage scope. */
  scope?: string;
}

const GcsTokenResponseSchema = strictObject({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string(),
});

/** Mints one OAuth access token via the RFC 7523 JWT-bearer grant — no SDK, `node:crypto` RS256
 *  signing plus one `fetchWithTimeout` POST. Exported for the round-trip signing test; the real
 *  transport calls it and caches the result until near expiry. */
export async function mintGcsAccessToken(
  creds: GcsServiceAccountCredentials,
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.clientEmail,
    scope: creds.scope ?? DEFAULT_GCS_SCOPE,
    aud: GCS_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(
    JSON.stringify(claims),
  ).toString("base64url")}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(creds.privateKey);
  const assertion = `${signingInput}.${signature.toString("base64url")}`;
  const res = await fetchWithTimeout(GCS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new ConfigError(
      "audit-worm: GCS service-account token exchange failed",
      { status: res.status },
    );
  }
  const parsed = parseStrict(GcsTokenResponseSchema, await res.json());
  return { token: parsed.access_token, expiresAt: now + parsed.expires_in };
}

/**
 * The real {@link GcsSendable} transport (ADR-0267): mints + caches a service-account bearer token
 * (refreshed 60s before expiry) and attaches it to every call via `fetchWithTimeout`. This is the
 * only un-exercised-by-design path — CI never constructs it; `live/store.gcs.live.test.ts` is the
 * proof against real GCS (ADR-0201 live-test convention).
 */
export function createGcsServiceAccountTransport(
  creds: GcsServiceAccountCredentials,
): GcsSendable {
  let cached: { token: string; expiresAt: number } | undefined;
  return async (url, init) => {
    const now = Math.floor(Date.now() / 1000);
    if (cached === undefined || cached.expiresAt - 60 <= now) {
      cached = await mintGcsAccessToken(creds);
    }
    return fetchWithTimeout(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${cached.token}`,
      },
    });
  };
}
