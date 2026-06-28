// src/store.s3.ts — the PROD `ArtifactStore` backend (ADR-0054, ADR-0051). A real S3 Object-Lock
// store over `@aws-sdk/client-s3`, write-once and tenant-scoped, with the COMPLIANCE-mode footgun
// fenced behind a typed irreversible opt-in. Two invariants are enforced at this backend:
//   1. Write-once — every `put` is a conditional `IfNoneMatch: '*'` PUT; S3 answers 412 on an
//      existing key, which becomes `ArtifactExistsError` (the WORM essence + chain-anchor safety,
//      ADR-0052/TM-H). No overwrite path exists.
//   2. Retention lock — every object carries `ObjectLockMode` + `ObjectLockRetainUntilDate`, with
//      the date == the caller's `retainUntil` so the S3 lock date provably equals the DB row date.
//
// The S3 TRANSPORT is injected as `S3Sendable = Pick<S3Client, "send">` (ADR-0054). CI binds a stub
// `send`, so NO live cloud call runs in tests — a real `S3Client` (the live transport) is the only
// un-exercised path, the same seam-real / cloud-behind-the-port precedent as `field-crypto`'s
// `kms.ts` (ADR-0047). COMPLIANCE-mode is refused outside a production deployment so a dev or test
// bucket can never be irreversibly bricked (ADR-0051/TM-A).
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import {
  ConfigError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "@caisson/kernel";
import {
  ArtifactExistsError,
  assertSafeKey,
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
 * COMPLIANCE without one of these in hand, so the footgun (TM-A) is impossible to pull by accident.
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
 * *environment* (it refuses COMPLIANCE unless `NODE_ENV === "production"`, ADR-0051/TM-A).
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
   * key — the per-tenant cryptographic boundary that backs key-prefix isolation (ADR-0054/TM-C).
   */
  sseKmsKeyId?: string;
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
 * scoping + traversal guard, TM-C); `put` is a conditional `IfNoneMatch: '*'` write (412 →
 * `ArtifactExistsError`, TM-H); `get` throws `NotFoundError` on 404; `head` resolves `null` on 404.
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
   * Fail-closed COMPLIANCE gate (ADR-0051/TM-A), three belts, all at construction so a COMPLIANCE
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
      // Write-once: S3 fails a conditional PUT to an existing key with 412 (TM-H).
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
    try {
      await this.client.send(command);
    } catch (err) {
      // 412 Precondition Failed == the key already holds an immutable object (WORM violation).
      if (httpStatusOf(err) === 412) throw new ArtifactExistsError(key);
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
      throw new InternalError("audit-worm: S3 GetObject returned no body", {
        key,
      });
    }
    const body = await output.Body.transformToByteArray();
    return { ...this.metaFrom(key, body.byteLength, output), body };
  }

  async head(key: string): Promise<ArtifactMeta | null> {
    assertSafeKey(key);
    try {
      const output = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const size =
        typeof output.ContentLength === "number" ? output.ContentLength : 0;
      return this.metaFrom(key, size, output);
    } catch (err) {
      if (httpStatusOf(err) === 404) return null;
      throw err;
    }
  }

  /** Project an S3 get/head response into the port's `ArtifactMeta` (retention + content-type). */
  private metaFrom(
    key: string,
    size: number,
    output: {
      ContentType?: string | undefined;
      ObjectLockRetainUntilDate?: Date | undefined;
    },
  ): ArtifactMeta {
    const meta: ArtifactMeta = { key, size };
    if (output.ObjectLockRetainUntilDate !== undefined) {
      meta.retainUntil = output.ObjectLockRetainUntilDate;
    }
    if (output.ContentType !== undefined) meta.contentType = output.ContentType;
    return meta;
  }
}
