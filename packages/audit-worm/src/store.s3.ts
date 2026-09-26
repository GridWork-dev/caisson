// src/store.s3.ts — the PROD `ArtifactStore` backend (ADR-0054, ADR-0051). A real S3 Object-Lock
// store over `@aws-sdk/client-s3`, write-once and tenant-scoped, with the COMPLIANCE-mode footgun
// fenced behind a typed irreversible opt-in. Two invariants are enforced at this backend:
//   1. Write-once — every `put` is a conditional `IfNoneMatch: '*'` PUT; S3 answers 412 on an
//      existing key, which becomes `ArtifactExistsError` (the WORM essence + chain-anchor safety,
//      ADR-0052). No overwrite path exists.
//   2. Retention lock — every object carries `ObjectLockMode` + `ObjectLockRetainUntilDate`, with
//      the date == the caller's `retainUntil` so the S3 lock date provably equals the DB row date.
//   3. Monotonic escalation (ADR-0202) — `extendRetention` moves a lock strictly LATER preserving
//      the mode; `escalateToCompliance` hardens GOVERNANCE→COMPLIANCE behind the SAME three-belt
//      gate as write-time COMPLIANCE. No path shortens a date or weakens a mode.
//
// The S3 TRANSPORT is injected as `S3Sendable = Pick<S3Client, "send">` (ADR-0054). CI binds a stub
// `send`, so NO live cloud call runs in tests — a real `S3Client` (the live transport) is the only
// un-exercised path, the same seam-real / cloud-behind-the-port precedent as `field-crypto`'s
// `kms.ts` (ADR-0047). COMPLIANCE-mode is refused outside a production deployment so a dev or test
// bucket can never be irreversibly bricked (ADR-0051).
import {
  GetObjectCommand,
  GetObjectRetentionCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectRetentionCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import {
  ConfigError,
  InternalError,
  NotFoundError,
  ValidationError,
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
 * The injected S3 transport — only `send` is used, so the whole AWS SDK surface collapses to one
 * method (ADR-0054). Production passes a real `S3Client`; CI passes a stub, so no live call runs.
 */
export type S3Sendable = Pick<S3Client, "send">;

/**
 * S3 Object-Lock retention mode (ADR-0051). `GOVERNANCE` (the default everywhere) is bypassable by a
 * caller holding `s3:BypassGovernanceRetention`; `COMPLIANCE` is the SEC-17a-4 grade — root-proof and
 * irreversible until `retain_until`. The literals match the AWS `ObjectLockMode` enum exactly.
 */
export type RetentionMode = "GOVERNANCE" | "COMPLIANCE";

interface RetentionReadback {
  readonly mode: RetentionMode | undefined;
  readonly retainUntil: Date | undefined;
}

/** The exact acknowledgement a buyer must echo to escalate an evidence class to COMPLIANCE. */
export const COMPLIANCE_ACKNOWLEDGEMENT =
  "I acknowledge COMPLIANCE-mode S3 Object-Lock is irreversible: this data cannot be deleted or " +
  "shortened by anyone — including the AWS account root — until its retain-until date.";

const OPT_IN_BRAND: unique symbol = Symbol(
  "audit-worm.irreversible-compliance-opt-in",
);

/**
 * The typed, opaque proof that a buyer has acknowledged COMPLIANCE-mode is irreversible (ADR-0051).
 * It is unforgeable in practice — the only constructor is {@link irreversibleComplianceOptIn}, which
 * demands the exact acknowledgement string and the bucket it applies to. No code path selects
 * COMPLIANCE without one of these in hand, so the footgun is impossible to pull by accident.
 */
export interface IrreversibleComplianceOptIn {
  readonly [OPT_IN_BRAND]: true;
  /** The exact bucket this opt-in authorizes — the store rejects a mismatch. */
  readonly bucket: string;
}

/**
 * Mint the irreversible-COMPLIANCE opt-in for one bucket. Fail-closed: the acknowledgement must be
 * the exact {@link COMPLIANCE_ACKNOWLEDGEMENT} and `deployment` must be the literal `"production"`,
 * so neither a typo nor a default ever yields one. This proves *intent*; the store separately proves
 * *environment* (it refuses COMPLIANCE unless `NODE_ENV === "production"`, ADR-0051).
 */
export function irreversibleComplianceOptIn(input: {
  bucket: string;
  acknowledgement: string;
  deployment: "production";
}): IrreversibleComplianceOptIn {
  const bucket = input.bucket.trim();
  if (bucket.length === 0) {
    throw new ValidationError(
      "audit-worm: COMPLIANCE opt-in requires the target bucket",
    );
  }
  if (input.acknowledgement !== COMPLIANCE_ACKNOWLEDGEMENT) {
    throw new ConfigError(
      "audit-worm: COMPLIANCE opt-in requires the exact irreversible acknowledgement string",
    );
  }
  // `deployment` is a `"production"` literal at the type level; re-check at runtime (callers can be
  // untyped JS) so the opt-in can never be minted for a non-production target.
  if (input.deployment !== "production") {
    throw new ConfigError(
      "audit-worm: COMPLIANCE opt-in is only valid for a production deployment",
    );
  }
  return { [OPT_IN_BRAND]: true, bucket };
}

/** Construction config for {@link S3ArtifactStore}. */
export interface S3ArtifactStoreConfig {
  /** The injected S3 transport (real `S3Client` in prod, stub in CI). */
  client: S3Sendable;
  /** The Object-Lock-enabled bucket. */
  bucket: string;
  /**
   * Object-Lock mode for every object this store writes (one store == one evidence class, ADR-0051).
   * Defaults to `GOVERNANCE`. `COMPLIANCE` additionally requires {@link complianceOptIn} naming this
   * bucket AND `NODE_ENV === "production"`.
   */
  mode?: RetentionMode;
  /** Required iff `mode === "COMPLIANCE"`; must name {@link bucket}. */
  complianceOptIn?: IrreversibleComplianceOptIn;
  /**
   * Optional per-tenant SSE-KMS key id. When set, every PUT is encrypted with `aws:kms` under this
   * key — the per-tenant cryptographic boundary that backs key-prefix isolation (ADR-0054).
   */
  sseKmsKeyId?: string;
}

function errorNameOf(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("name" in err)) {
    return undefined;
  }
  const name = (err as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
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

/**
 * The prod WORM backend (ADR-0054). Every key is `assertSafeKey`-guarded BEFORE any I/O (tenant
 * scoping + traversal guard); `put` is a conditional `IfNoneMatch: '*'` write (412 →
 * `ArtifactExistsError`); `get` throws `NotFoundError` on 404; `head` resolves `null` on 404.
 */
export class S3ArtifactStore implements ArtifactStore {
  private readonly client: S3Sendable;
  private readonly bucket: string;
  readonly mode: RetentionMode;
  private readonly sseKmsKeyId: string | undefined;

  constructor(config: S3ArtifactStoreConfig) {
    this.client = config.client;
    this.bucket = config.bucket.trim();
    if (this.bucket.length === 0) {
      throw new ValidationError(
        "audit-worm: S3ArtifactStore requires a bucket",
      );
    }
    this.mode = config.mode ?? "GOVERNANCE";
    this.sseKmsKeyId = config.sseKmsKeyId;
    if (this.mode === "COMPLIANCE") {
      this.assertComplianceAllowed(config.complianceOptIn);
    }
  }

  /**
   * Fail-closed COMPLIANCE gate (ADR-0051), three belts, all at construction so a COMPLIANCE
   * store cannot even be built without clearance:
   *   1. never under a test runner (`NODE_ENV === "test"`);
   *   2. never outside a production deployment (`NODE_ENV !== "production"`);
   *   3. only with a typed irreversible opt-in that names THIS bucket.
   */
  private assertComplianceAllowed(
    optIn: IrreversibleComplianceOptIn | undefined,
  ): void {
    if (process.env.NODE_ENV === "test") {
      throw new ConfigError(
        "audit-worm: COMPLIANCE-mode Object-Lock is never selected under a test runner (TM-A)",
      );
    }
    if (process.env.NODE_ENV !== "production") {
      throw new ConfigError(
        "audit-worm: COMPLIANCE-mode Object-Lock is refused outside a production deployment (NODE_ENV must be 'production')",
      );
    }
    if (optIn === undefined || optIn[OPT_IN_BRAND] !== true) {
      throw new ConfigError(
        "audit-worm: COMPLIANCE mode requires an irreversibleComplianceOptIn() — no code path selects it silently",
      );
    }
    if (optIn.bucket !== this.bucket) {
      throw new ConfigError(
        "audit-worm: COMPLIANCE opt-in names a different bucket than this store",
      );
    }
  }

  async put(
    key: string,
    body: Uint8Array,
    opts: PutOptions,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      // Write-once: S3 fails a conditional PUT to an existing key with 412.
      IfNoneMatch: "*",
      // Retention lock: object date == DB `retain_until` (ADR-0051/0054).
      ObjectLockMode: this.mode,
      ObjectLockRetainUntilDate: opts.retainUntil,
      ...(opts.contentType !== undefined
        ? { ContentType: opts.contentType }
        : {}),
      ...(this.sseKmsKeyId !== undefined
        ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: this.sseKmsKeyId }
        : {}),
    });
    let output;
    try {
      output = await this.client.send(command);
    } catch (err) {
      // 412 Precondition Failed == the key already holds an immutable object (WORM violation).
      if (httpStatusOf(err) === 412) throw new ArtifactExistsError(key);
      throw err;
    }
    if (output.VersionId === undefined || output.VersionId.length === 0) {
      throw new InternalError(
        "audit-worm: S3 accepted the Object-Lock write but returned no version identity",
        { key },
      );
    }
    const meta: ArtifactMeta = {
      key,
      size: body.byteLength,
      versionId: output.VersionId,
      retainUntil: opts.retainUntil,
    };
    if (opts.contentType !== undefined) meta.contentType = opts.contentType;
    return meta;
  }

  async get(key: string, versionId?: string): Promise<ArtifactObject> {
    assertSafeKey(key);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    let output;
    try {
      output = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...(versionId !== undefined ? { VersionId: versionId } : {}),
        }),
      );
    } catch (err) {
      if (httpStatusOf(err) === 404) {
        throw new NotFoundError("artifact not found", { key });
      }
      throw err;
    }
    if (output.Body === undefined) {
      throw new InternalError("audit-worm: S3 GetObject returned no body", {
        key,
      });
    }
    this.assertRequestedVersion(key, versionId, output.VersionId);
    const body = await output.Body.transformToByteArray();
    return { ...this.metaFrom(key, body.byteLength, output), body };
  }

  async head(key: string, versionId?: string): Promise<ArtifactMeta | null> {
    assertSafeKey(key);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    try {
      const output = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...(versionId !== undefined ? { VersionId: versionId } : {}),
        }),
      );
      const size =
        typeof output.ContentLength === "number" ? output.ContentLength : 0;
      this.assertRequestedVersion(key, versionId, output.VersionId);
      return this.metaFrom(key, size, output);
    } catch (err) {
      if (httpStatusOf(err) === 404) return null;
      throw err;
    }
  }

  /**
   * Extend the object's retention to a STRICTLY later date, preserving this store's mode
   * (ADR-0202). Reads the current lock via `GetObjectRetention` (the authoritative retention read —
   * `HeadObject` silently OMITS lock fields when the caller lacks `s3:GetObjectRetention`, which
   * would fail OPEN), refuses anything not strictly later (`ValidationError`, never clamps), then
   * issues `PutObjectRetention`. An object with NO current retention gains one — an
   * extend-from-nothing strengthens the lock, so it is allowed. 404 → `NotFoundError` (mirrors
   * `get`). Extending never needs a governance bypass: S3 always permits a LATER date.
   */
  async extendRetention(
    key: string,
    newRetainUntil: Date,
    versionId?: string,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    assertValidRetainUntil(newRetainUntil);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    const current = await this.currentRetention(key, versionId);
    if (
      current?.retainUntil !== undefined &&
      newRetainUntil.getTime() <= current.retainUntil.getTime()
    ) {
      throw new ValidationError(
        "audit-worm: retention can only be EXTENDED — the new date must be strictly later than the current lock (ADR-0202)",
        {
          key,
          currentRetainUntil: current.retainUntil.toISOString(),
          requested: newRetainUntil.toISOString(),
        },
      );
    }
    await this.putRetention(key, this.mode, newRetainUntil, versionId);
    // GetObjectRetention is the authoritative post-write read. PutObjectRetention's empty success
    // body and HeadObject's optional lock fields cannot prove the date S3 actually applied.
    const appliedRetainUntil = this.assertAppliedRetention(
      key,
      await this.currentRetention(key, versionId),
      this.mode,
      newRetainUntil,
      "retention extension",
    );
    const meta = await this.headOrThrow(key, versionId);
    return { ...meta, retainUntil: appliedRetainUntil };
  }

  /**
   * Escalate an EXISTING object's lock GOVERNANCE→COMPLIANCE (ADR-0202, riding the ADR-0051 gate).
   * The escalation is exactly as guarded as a write-time COMPLIANCE store: the SAME three belts
   * (`assertComplianceAllowed`) — never under a test runner, never outside a production deployment,
   * only with a typed irreversible opt-in naming THIS bucket — run BEFORE any I/O.
   *
   * Date rule: strictly-later-OR-EQUAL to the current retention. EQUAL is deliberate — a mode
   * escalation is orthogonal to a date extension: hardening GOVERNANCE→COMPLIANCE at the SAME
   * retain-until strengthens the lock without touching its length, and refusing equal would force
   * callers to artificially inflate the date just to harden the mode. EARLIER stays refused (that
   * would shorten — the ADR-0202 monotonicity floor). No de-escalation path exists anywhere: this
   * method only ever writes `Mode: COMPLIANCE`, and S3 itself refuses COMPLIANCE→anything.
   */
  async escalateToCompliance(
    key: string,
    retainUntil: Date,
    optIn: IrreversibleComplianceOptIn,
    versionId?: string,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    assertValidRetainUntil(retainUntil);
    if (versionId !== undefined) assertValidArtifactVersionId(versionId);
    this.assertComplianceAllowed(optIn);
    const current = await this.currentRetention(key, versionId);
    if (
      current?.retainUntil !== undefined &&
      retainUntil.getTime() < current.retainUntil.getTime()
    ) {
      throw new ValidationError(
        "audit-worm: COMPLIANCE escalation cannot shorten retention — the date must be at or later than the current lock (ADR-0202)",
        {
          key,
          currentRetainUntil: current.retainUntil.toISOString(),
          requested: retainUntil.toISOString(),
        },
      );
    }
    await this.putRetention(key, "COMPLIANCE", retainUntil, versionId);
    const appliedRetainUntil = this.assertAppliedRetention(
      key,
      await this.currentRetention(key, versionId),
      "COMPLIANCE",
      retainUntil,
      "COMPLIANCE escalation",
    );
    const meta = await this.headOrThrow(key, versionId);
    return { ...meta, retainUntil: appliedRetainUntil };
  }

  /**
   * The object's current `RetainUntilDate` via `GetObjectRetention`. `undefined` means the object
   * EXISTS but carries no retention (S3 answers `NoSuchObjectLockConfiguration` — extend-from-nothing
   * territory, not an error); any other 404 is a missing object → `NotFoundError`.
   */
  private async currentRetention(
    key: string,
    versionId?: string,
  ): Promise<RetentionReadback | undefined> {
    try {
      const output = await this.client.send(
        new GetObjectRetentionCommand({
          Bucket: this.bucket,
          Key: key,
          ...(versionId !== undefined ? { VersionId: versionId } : {}),
        }),
      );
      const mode = output.Retention?.Mode;
      return {
        mode: mode === "GOVERNANCE" || mode === "COMPLIANCE" ? mode : undefined,
        retainUntil: output.Retention?.RetainUntilDate,
      };
    } catch (err) {
      if (errorNameOf(err) === "NoSuchObjectLockConfiguration") {
        return undefined;
      }
      if (httpStatusOf(err) === 404) {
        throw new NotFoundError("artifact not found", { key });
      }
      throw err;
    }
  }

  private assertAppliedRetention(
    key: string,
    applied: RetentionReadback | undefined,
    expectedMode: RetentionMode,
    requested: Date,
    operation: string,
  ): Date {
    const appliedTime = applied?.retainUntil?.getTime() ?? Number.NaN;
    if (
      applied?.mode !== expectedMode ||
      !(appliedTime >= requested.getTime())
    ) {
      throw new InternalError(
        `audit-worm: S3 accepted ${operation} but authoritative readback did not prove the requested lock`,
        {
          key,
          expectedMode,
          appliedMode: applied?.mode,
          requested: requested.toISOString(),
          appliedRetainUntil: Number.isFinite(appliedTime)
            ? applied?.retainUntil?.toISOString()
            : undefined,
        },
      );
    }
    return applied.retainUntil!;
  }

  private async putRetention(
    key: string,
    mode: RetentionMode,
    retainUntil: Date,
    versionId?: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectRetentionCommand({
          Bucket: this.bucket,
          Key: key,
          ...(versionId !== undefined ? { VersionId: versionId } : {}),
          Retention: { Mode: mode, RetainUntilDate: retainUntil },
        }),
      );
    } catch (err) {
      if (httpStatusOf(err) === 404) {
        throw new NotFoundError("artifact not found", { key });
      }
      throw err;
    }
  }

  private async headOrThrow(
    key: string,
    versionId?: string,
  ): Promise<ArtifactMeta> {
    const meta = await this.head(key, versionId);
    if (meta === null) throw new NotFoundError("artifact not found", { key });
    return meta;
  }

  private assertRequestedVersion(
    key: string,
    requested: string | undefined,
    returned: string | undefined,
  ): void {
    if (requested === undefined) return;
    if (returned !== requested) {
      throw new InternalError(
        "audit-worm: S3 exact-version response did not match the recorded object version",
        { key, requestedVersionId: requested, returnedVersionId: returned },
      );
    }
  }

  /** Project an S3 get/head response into the port's `ArtifactMeta` (retention + content-type). */
  private metaFrom(
    key: string,
    size: number,
    output: {
      ContentType?: string | undefined;
      ObjectLockRetainUntilDate?: Date | undefined;
      VersionId?: string | undefined;
    },
  ): ArtifactMeta {
    const meta: ArtifactMeta = { key, size };
    if (output.VersionId !== undefined) meta.versionId = output.VersionId;
    if (output.ObjectLockRetainUntilDate !== undefined) {
      meta.retainUntil = output.ObjectLockRetainUntilDate;
    }
    if (output.ContentType !== undefined) meta.contentType = output.ContentType;
    return meta;
  }
}
