// src/store.ts — the WORM `ArtifactStore` port (ADR-0054, extended by ADR-0202). A minimal
// put/get/head/extendRetention object-store contract every backend binds: prod `S3ArtifactStore`
// (Object-Lock) and dev `LocalArtifactStore` (fs, store.local.ts). Invariants live HERE, at the
// port, so no backend can skip them:
//   1. Tenant scoping — every key is `{account_id}/…` and traversal-safe via `assertSafeKey`, so no
//      key can reach another tenant's prefix or escape the store root (ADR-0054).
//   2. Write-once — a key, once written, is immutable; a second `put` to an existing key is an
//      `ArtifactExistsError`, never an overwrite (the WORM essence; chain anchors rely on it, ADR-0052).
//   3. Monotonic retention — `extendRetention` only ever moves a lock LATER (strictly), never
//      shortens or clamps; no de-escalation path exists in the port (ADR-0202).
import { CaissonError, ValidationError } from "@caisson-sh/kernel";

/**
 * Metadata for an artifact — never the body. `retainUntil` is the WORM lock expiry (ADR-0054).
 * `versionId` is the provider's opaque identity for the exact immutable object version. Versioned
 * backends populate it; backends without versioning leave it absent rather than fabricating one.
 */
export interface ArtifactMeta {
  key: string;
  size: number;
  versionId?: string;
  retainUntil?: Date;
  contentType?: string;
}

/** A fetched artifact: its metadata plus the immutable bytes. */
export interface ArtifactObject extends ArtifactMeta {
  body: Uint8Array;
}

/** Options for one write. `retainUntil` is mandatory — a WORM artifact is never unbounded. */
export interface PutOptions {
  retainUntil: Date;
  contentType?: string;
}

/**
 * The WORM object-store port. Backends: `S3ArtifactStore` (prod, Object-Lock) and
 * `LocalArtifactStore` (dev/test, fs). `put` is write-once (re-write → `ArtifactExistsError`); `get`
 * throws `NotFoundError` when the key is absent; `head` resolves `null` for an absent key (a presence
 * probe that never throws). All keys MUST pass `assertSafeKey` before any I/O.
 */
export interface ArtifactStore {
  put(key: string, body: Uint8Array, opts: PutOptions): Promise<ArtifactMeta>;
  /**
   * Read an artifact. Passing the `versionId` returned by `put` targets that exact immutable
   * provider version; omitting it preserves the original key-only contract for nonversioned stores.
   */
  get(key: string, versionId?: string): Promise<ArtifactObject>;
  /**
   * Read artifact metadata. Version-aware callers pass the `versionId` recorded from `put`.
   */
  head(key: string, versionId?: string): Promise<ArtifactMeta | null>;
  /**
   * Extend an existing artifact's retention (ADR-0202). STRICTLY monotonic: `newRetainUntil` must be
   * strictly LATER than the artifact's current retention or the store THROWS a `ValidationError` —
   * never shortens, never silently clamps. An artifact with NO current retention gains one (an
   * extend-from-nothing strengthens the lock, so it is allowed). Absent key → `NotFoundError`
   * (mirrors `get`). Returns the updated metadata — the authoritative new date for the caller's DB
   * `retain_until` row update (the ADR-0006/0051 row==object invariant).
   */
  extendRetention(
    key: string,
    newRetainUntil: Date,
    versionId?: string,
  ): Promise<ArtifactMeta>;
}

/**
 * Guard a retention date before any I/O: an invalid `Date` must never reach a lock API — S3 would
 * either reject it late or, worse, a NaN-comparison would silently pass a monotonicity check
 * (`NaN <= x` is false), turning a garbage date into an accepted "extension". Fail-closed here.
 */
export function assertValidRetainUntil(d: Date): void {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new ValidationError("retention date is not a valid Date");
  }
}

/**
 * Guard a provider version identity before it reaches an SDK or URL. Version ids are opaque and
 * therefore are never normalized; empty, oversized, or control-character values are refused.
 */
export function assertValidArtifactVersionId(versionId: string): void {
  if (
    typeof versionId !== "string" ||
    versionId.length === 0 ||
    versionId.length > 1024 ||
    // eslint-disable-next-line no-control-regex -- opaque provider ids must reject every ASCII control byte.
    /[\u0000-\u001f\u007f]/.test(versionId)
  ) {
    throw new ValidationError("artifact version id is invalid");
  }
}

/** A write to a key that already holds an immutable artifact (a WORM violation). HTTP 409. */
export class ArtifactExistsError extends CaissonError {
  readonly code = "artifact_exists";
  readonly httpStatus = 409;
  constructor(key: string) {
    super("artifact already exists at this WORM key", { key });
  }
}

/** The validated parts of a safe key — the tenant prefix and the unchanged full key. */
export interface SafeKey {
  /** The first path segment: a UUID account id (the tenant boundary). */
  accountId: string;
  /** The full validated key, byte-identical to the input. */
  key: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** S3 caps object keys at 1024 bytes; the local backend matches it so dev mirrors prod. */
const MAX_KEY_LENGTH = 1024;

/**
 * Guard every artifact key before any I/O. Enforces tenant scoping (`{account_id}/…`, the first
 * segment a UUID) and rejects every traversal vector — empty/`.`/`..` segments, null bytes, absolute
 * paths, backslashes, and a Windows drive prefix. Returns the parsed `{ accountId, key }`; THROWS a
 * `ValidationError` otherwise (fail-closed — a malformed key is never coerced).
 */
export function assertSafeKey(key: string): SafeKey {
  if (typeof key !== "string" || key.length === 0) {
    throw new ValidationError("artifact key must be a non-empty string");
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new ValidationError("artifact key exceeds the 1024-byte limit", {
      length: key.length,
    });
  }
  if (key.includes("\0")) {
    throw new ValidationError("artifact key contains a null byte");
  }
  if (key.startsWith("/") || key.includes("\\") || /^[a-zA-Z]:/.test(key)) {
    throw new ValidationError(
      "artifact key must be a relative, forward-slash path",
      { key },
    );
  }
  const segments = key.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    throw new ValidationError(
      "artifact key has an empty or path-traversal segment",
      { key },
    );
  }
  const accountId = segments[0] ?? "";
  if (!UUID_RE.test(accountId)) {
    throw new ValidationError(
      "artifact key must be tenant-scoped as {account_id}/…",
      { key },
    );
  }
  if (segments.length < 2) {
    throw new ValidationError(
      "artifact key needs a path under the tenant prefix",
      { key },
    );
  }
  return { accountId, key };
}

/**
 * Build a safe key from a tenant id and one or more path segments — the only sanctioned way to
 * construct a key, so callers never hand-concatenate a traversal. Each segment must be non-empty and
 * contain no separator, null byte, or `.`/`..`; the result is re-validated through `assertSafeKey`.
 */
export function buildArtifactKey(
  accountId: string,
  ...segments: string[]
): string {
  if (!UUID_RE.test(accountId)) {
    throw new ValidationError("account id must be a UUID", { accountId });
  }
  if (segments.length === 0) {
    throw new ValidationError(
      "artifact key needs at least one segment under the tenant prefix",
    );
  }
  for (const s of segments) {
    if (
      s.length === 0 ||
      s === "." ||
      s === ".." ||
      s.includes("/") ||
      s.includes("\\") ||
      s.includes("\0")
    ) {
      throw new ValidationError("invalid artifact key segment", { segment: s });
    }
  }
  return assertSafeKey([accountId, ...segments].join("/")).key;
}
