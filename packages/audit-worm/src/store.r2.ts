// src/store.r2.ts — the R2 `ArtifactStore` backend (ADR-0267, extending ADR-0054). R2 splits data
// plane from retention plane: object bytes flow over R2's S3-compatible API (reusing the
// `S3Sendable` DI seam verbatim, ADR-0054), but retention is enforced by a BUCKET-LEVEL lock rule
// (Cloudflare's REST `lock` endpoint), never S3 Object Lock — R2 implements neither
// `GetObjectLockConfiguration` nor `PutObjectRetention`; this driver never calls them.
//
// Fail-closed bound (ADR-0267, BINDING): at construction, the store's declared `keyPrefix` must be
// covered by an ENABLED lock rule (no covering rule → `ConfigError`, never a store that silently
// writes unprotected objects). Per `put`/`extendRetention`, the guaranteed horizon is computed from
// the best matching rule for the actual key at the relevant reference time (an `Age` rule's horizon
// is anchored to the object's real creation time, never to "now" at read-time) — a requested
// `retainUntil` that exceeds the horizon THROWS before any write, never silently under-retains.
// Because R2 has no per-object retention mechanism, `extendRetention` can only succeed when the
// governing rule is `Indefinite`; an `Age`/`Date` rule cannot grant one object more protection than
// the rule already provides, and the driver refuses rather than fake it (documented gap, ADR-0267).
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  ConfigError,
  InternalError,
  NotFoundError,
  ValidationError,
  fetchWithTimeout,
} from "@caisson/kernel";
import type { S3Sendable } from "./store.s3.ts";
import {
  ArtifactExistsError,
  assertSafeKey,
  assertValidRetainUntil,
  type ArtifactMeta,
  type ArtifactObject,
  type ArtifactStore,
  type PutOptions,
} from "./store.ts";

/** One Cloudflare R2 bucket-lock rule (`GET/PUT /accounts/{account}/r2/buckets/{bucket}/lock`). */
export type R2LockCondition =
  | { type: "Age"; maxAgeSeconds: number }
  | { type: "Date"; date: string }
  | { type: "Indefinite" };

export interface R2LockRule {
  id: string;
  enabled: boolean;
  /** Empty string (or absent) applies the rule bucket-wide. */
  prefix?: string;
  condition: R2LockCondition;
}

/** The injected bucket-lock-rules reader — mirrors `S3Sendable`'s DI shape: a single callable, a
 *  real REST transport in prod ({@link createR2LockReader}), a canned stub in tests. */
export type R2LockReader = () => Promise<R2LockRule[]>;

/** Construction config for {@link R2ArtifactStore}. */
export interface R2ArtifactStoreConfig {
  /** The S3-compatible data-plane transport, pointed at R2's endpoint (reuses `S3Sendable`). */
  client: S3Sendable;
  bucket: string;
  /** Reads the bucket's current lock rules (real: {@link createR2LockReader}; tests: a stub). */
  lockReader: R2LockReader;
  /**
   * The key prefix this store instance is responsible for; a governing enabled rule must cover it.
   * Defaults to `""` (the whole bucket) — set this to a tenant/evidence-class prefix to scope the
   * construction-time check to a narrower, dedicated rule.
   */
  keyPrefix?: string;
}

function httpStatusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("$metadata" in err)) {
    return undefined;
  }
  const meta = (err as { $metadata?: unknown }).$metadata;
  if (
    typeof meta !== "object" ||
    meta === null ||
    !("httpStatusCode" in meta)
  ) {
    return undefined;
  }
  const code = (meta as { httpStatusCode?: unknown }).httpStatusCode;
  return typeof code === "number" ? code : undefined;
}

/** A rule "covers" `key` when it is enabled and its prefix is a prefix of the key (empty prefix
 *  matches every key). */
function ruleCovers(rule: R2LockRule, key: string): boolean {
  return rule.enabled && key.startsWith(rule.prefix ?? "");
}

/** The guaranteed retention horizon (epoch ms) a rule provides, anchored at `referenceTime` — the
 *  object's real creation time for `Age` rules, irrelevant for `Date`/`Indefinite`. */
function ruleHorizonMs(rule: R2LockRule, referenceTime: Date): number {
  switch (rule.condition.type) {
    case "Indefinite":
      return Number.POSITIVE_INFINITY;
    case "Date":
      return new Date(rule.condition.date).getTime();
    case "Age":
      return referenceTime.getTime() + rule.condition.maxAgeSeconds * 1000;
  }
}

/**
 * The R2 WORM backend (ADR-0267). Construct via {@link R2ArtifactStore.create} ONLY — the sync
 * constructor cannot read the bucket's lock rules, and an un-verified store must never exist
 * (fail-closed).
 */
export class R2ArtifactStore implements ArtifactStore {
  private readonly client: S3Sendable;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private rules: R2LockRule[] = [];

  private constructor(config: R2ArtifactStoreConfig) {
    this.client = config.client;
    this.bucket = config.bucket.trim();
    this.keyPrefix = config.keyPrefix ?? "";
    if (this.bucket.length === 0) {
      throw new ConfigError("audit-worm: R2ArtifactStore requires a bucket");
    }
  }

  /**
   * The only sanctioned constructor. Reads the bucket's current lock rules and refuses fail-closed
   * (`ConfigError`) unless an ENABLED rule covers `keyPrefix` — a store with no covering rule could
   * write objects R2 will never actually protect.
   */
  static async create(config: R2ArtifactStoreConfig): Promise<R2ArtifactStore> {
    const store = new R2ArtifactStore(config);
    store.rules = await config.lockReader();
    if (!store.rules.some((r) => ruleCovers(r, store.keyPrefix))) {
      throw new ConfigError(
        "audit-worm: no enabled R2 bucket-lock rule covers this store's key prefix — refusing " +
          "to construct a store that cannot honor any retention (ADR-0267)",
        { bucket: store.bucket, keyPrefix: store.keyPrefix },
      );
    }
    return store;
  }

  /** The largest horizon any matching enabled rule guarantees for `key`, at `referenceTime`. */
  private guaranteedHorizonMs(key: string, referenceTime: Date): number {
    let best = Number.NEGATIVE_INFINITY;
    for (const rule of this.rules) {
      if (ruleCovers(rule, key)) {
        best = Math.max(best, ruleHorizonMs(rule, referenceTime));
      }
    }
    return best;
  }

  /** Fail-closed per-op bound (ADR-0267): throws BEFORE any write when no covering rule's horizon
   *  reaches `retainUntil` — never silently under-retains. */
  private assertRetentionCovered(
    key: string,
    retainUntil: Date,
    referenceTime: Date,
  ): void {
    const horizon = this.guaranteedHorizonMs(key, referenceTime);
    if (retainUntil.getTime() > horizon) {
      throw new ConfigError(
        "audit-worm: no R2 bucket-lock rule guarantees the requested retention for this key — " +
          "the driver refuses rather than silently under-retain (ADR-0267)",
        {
          key,
          requested: retainUntil.toISOString(),
          guaranteedHorizonMs: horizon,
        },
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
    this.assertRetentionCovered(key, opts.retainUntil, new Date());
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      // R2 supports the same create-only conditional write as S3; it has no Object-Lock fields.
      IfNoneMatch: "*",
      ...(opts.contentType !== undefined
        ? { ContentType: opts.contentType }
        : {}),
    });
    try {
      await this.client.send(command);
    } catch (err) {
      const status = httpStatusOf(err);
      if (status === 412 || status === 409) throw new ArtifactExistsError(key);
      throw err;
    }
    const meta: ArtifactMeta = {
      key,
      size: body.byteLength,
      retainUntil: opts.retainUntil,
    };
    if (opts.contentType !== undefined) meta.contentType = opts.contentType;
    return meta;
  }

  async get(key: string): Promise<ArtifactObject> {
    assertSafeKey(key);
    let output;
    try {
      output = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      if (httpStatusOf(err) === 404) {
        throw new NotFoundError("artifact not found", { key });
      }
      throw err;
    }
    if (output.Body === undefined) {
      throw new InternalError("audit-worm: R2 GetObject returned no body", {
        key,
      });
    }
    const body = await output.Body.transformToByteArray();
    const meta = this.metaFrom(key, body.byteLength, {
      contentType: output.ContentType,
      lastModified: output.LastModified,
    });
    return { ...meta, body };
  }

  async head(key: string): Promise<ArtifactMeta | null> {
    const raw = await this.headRaw(key);
    if (raw === null) return null;
    return this.metaFrom(key, raw.size, raw);
  }

  /** The raw S3 `HeadObject` fields — `null` on 404. Kept separate from {@link metaFrom}'s
   *  `ArtifactMeta` projection because `extendRetention` needs the numeric horizon (which may be
   *  `Infinity` for an `Indefinite` rule) rather than the lossy `Date | undefined` the public port
   *  type allows — `ArtifactMeta.retainUntil` cannot distinguish "no retention" from "indefinite". */
  private async headRaw(key: string): Promise<{
    size: number;
    contentType?: string | undefined;
    lastModified?: Date | undefined;
  } | null> {
    assertSafeKey(key);
    try {
      const output = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size:
          typeof output.ContentLength === "number" ? output.ContentLength : 0,
        contentType: output.ContentType,
        lastModified: output.LastModified,
      };
    } catch (err) {
      if (httpStatusOf(err) === 404) return null;
      throw err;
    }
  }

  /**
   * R2 has NO per-object retention mechanism — retention is enforced entirely by the bucket-lock
   * rule matched at the object's actual creation time (`LastModified`). This can only ever grant
   * "more" protection when the governing rule is `Indefinite` (any requested date is trivially
   * already covered by an unbounded horizon); an `Age`/`Date` rule's horizon is fixed once the
   * object exists and cannot be individually extended, so a request that exceeds it is refused
   * (`ConfigError`, ADR-0267) rather than faked. A request at or before the object's current
   * guaranteed horizon is refused as a non-extension (`ValidationError`, mirrors S3's
   * never-shortens contract) — except when the horizon is already unbounded, where every request
   * is trivially satisfied.
   */
  async extendRetention(
    key: string,
    newRetainUntil: Date,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    assertValidRetainUntil(newRetainUntil);
    const raw = await this.headRaw(key);
    if (raw === null) throw new NotFoundError("artifact not found", { key });
    const referenceTime = raw.lastModified ?? new Date();
    const horizon = this.guaranteedHorizonMs(key, referenceTime);
    if (!Number.isFinite(horizon)) {
      // Indefinite-covered: any future date is already guaranteed — trivially satisfied, no infra
      // mutation possible or needed.
      const meta: ArtifactMeta = {
        key,
        size: raw.size,
        retainUntil: newRetainUntil,
      };
      if (raw.contentType !== undefined) meta.contentType = raw.contentType;
      return meta;
    }
    const requested = newRetainUntil.getTime();
    if (requested <= horizon) {
      throw new ValidationError(
        "audit-worm: retention can only be EXTENDED — the new date must be strictly later than " +
          "the current rule-derived retention (ADR-0267, mirroring ADR-0202)",
        {
          key,
          currentRetainUntil: new Date(horizon).toISOString(),
          requested: newRetainUntil.toISOString(),
        },
      );
    }
    throw new ConfigError(
      "audit-worm: no R2 bucket-lock rule guarantees the requested extension for this key — R2 " +
        "has no per-object retention mechanism; the driver refuses rather than silently " +
        "under-retain (ADR-0267)",
      {
        key,
        guaranteedHorizonMs: horizon,
        requested: newRetainUntil.toISOString(),
      },
    );
  }

  private metaFrom(
    key: string,
    size: number,
    output: {
      contentType?: string | undefined;
      lastModified?: Date | undefined;
    },
  ): ArtifactMeta {
    const meta: ArtifactMeta = { key, size };
    if (output.contentType !== undefined) meta.contentType = output.contentType;
    const referenceTime = output.lastModified ?? new Date();
    const horizon = this.guaranteedHorizonMs(key, referenceTime);
    // An Indefinite-covered object has no finite `retainUntil` to report — `ArtifactMeta.retainUntil`
    // stays undefined (the port's "optional" slot), not a lie about a bounded date.
    if (Number.isFinite(horizon)) {
      meta.retainUntil = new Date(horizon);
    }
    return meta;
  }
}

// --- Real transport: Cloudflare's bucket-lock REST API ---

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/** Config for the real {@link R2LockReader} (ADR-0267) — a Bearer API token scoped to "Edit" on the
 *  bucket's lock configuration. */
export interface R2LockReaderConfig {
  accountId: string;
  bucket: string;
  apiToken: string;
}

interface CfLockRulesResponse {
  success: boolean;
  result?: { rules?: R2LockRule[] };
  errors?: { message: string }[];
}

/** The real {@link R2LockReader}: `GET /accounts/{account}/r2/buckets/{bucket}/lock` over
 *  `fetchWithTimeout`. CI never constructs this; `live/store.r2.live.test.ts` proves it against a
 *  real bucket (ADR-0201 live-test convention). */
export function createR2LockReader(config: R2LockReaderConfig): R2LockReader {
  return async () => {
    const res = await fetchWithTimeout(
      `${CF_API_BASE}/accounts/${encodeURIComponent(config.accountId)}/r2/buckets/${encodeURIComponent(config.bucket)}/lock`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${config.apiToken}` },
      },
    );
    const body = (await res.json()) as CfLockRulesResponse;
    if (!res.ok || !body.success) {
      throw new ConfigError("audit-worm: could not read R2 bucket-lock rules", {
        bucket: config.bucket,
        status: res.status,
        errors: body.errors,
      });
    }
    return body.result?.rules ?? [];
  };
}
