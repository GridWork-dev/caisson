// The Drizzle `customType` encrypted column (ADR-0006/0046) — encrypt-on-write / decrypt-on-read,
// transparent to queries. `toDriver`/`fromDriver` are SYNCHRONOUS and CONTEXT-FREE, so the active
// tenant flows in through an AsyncLocalStorage the caller sets with `withFieldCryptoContext` (the
// Compliance edition wires this alongside `withTenant`, ADR-0005 — the encryption boundary EQUALS
// the RLS tenant boundary). No context bound → encrypt/decrypt REFUSE (fail-closed): a column can
// never be read or written outside a tenant scope. The sync derived-key path backs this; a KMS
// (async) provider pre-resolves + caches keys into the context (P2 wiring, not the sync hot-path).
import { AsyncLocalStorage } from "node:async_hooks";
import { InternalError, ValidationError } from "@caisson-sh/kernel";
import { customType } from "drizzle-orm/pg-core";
import { type AeadCipher, aesGcm, cipherForAlg } from "./cipher.ts";
import { parseEnvelope, serializeEnvelope } from "./envelope.ts";
import { buildAad } from "./aad.ts";
import type { FieldKeyProvider, SyncFieldKeyProvider } from "./provider.ts";

/** The synchronous tenant context the column reads. Carries the tenant id + a sync key resolver. */
export interface FieldCryptoContext {
  readonly tenantId: string;
  /**
   * Run one operation against the tenant key for `keyVersion` — synchronously.
   *
   * The key is LENT, never returned. The context owns the buffer passed to `use` and zeroizes it
   * as soon as `use` returns or throws (ADR-0393, superseding ADR-0392 decision 5). This replaced a
   * `deriveKey()` that returned the buffer: callers then held plaintext DEKs for the whole request,
   * one per call, unbounded in row count.
   *
   * Precisely what that buys: SEQUENTIAL operations no longer accumulate working copies. It is not
   * "one lend at a time" — nested `withKey` calls hold one copy per active invocation — and it says
   * nothing about a KMS context's PREFETCHED sources, which stay resident for the whole request by
   * design (ADR-0389) and are erased at `dispose()`.
   *
   * The honest boundary: a `use` that deliberately copies the bytes out (`Buffer.from(key)`, a
   * string, another typed array) still escapes, and no JavaScript API can prevent that. What is
   * eliminated is escape BY DEFAULT — the ergonomic path no longer hands back something to keep.
   */
  withKey<T>(keyVersion: number, use: (key: Buffer) => SyncOnly<T>): T;
  /** The version a new write encrypts under. */
  currentVersion(): number;
}

/**
 * Collapses a thenable return to `never`, so an `async` (or promise-returning) `withKey` callback
 * is a TYPE error rather than a runtime one.
 *
 * This matters because the runtime backstop cannot be clean: by the time a thenable is observed,
 * `use()` has already produced a live pending promise whose continuation will resume against the
 * zeroized key. Catching the misuse at `bun run check` means the process never reaches that state.
 * Every legitimate synchronous return (string, number, Buffer, arrays, booleans, objects) passes
 * through unchanged.
 */
type SyncOnly<T> = T extends PromiseLike<unknown> ? never : T;

/** A request-local KMS context whose plaintext DEKs can be actively zeroized at scope exit. */
export interface DisposableFieldCryptoContext extends FieldCryptoContext {
  /** Zero every prefetched DEK and make further key access fail closed. Idempotent. */
  dispose(): void;
}

/** Request-local controls for bounded KMS prefetch and plaintext lifetime. */
export interface KmsContextOptions {
  readonly abortSignal?: AbortSignal;
  /** Maximum concurrent unwraps. Defaults to 4 and is bounded to 1–16. */
  readonly concurrency?: number;
  /**
   * Maximum historical key versions this context will prefetch. Defaults to
   * {@link KMS_CONTEXT_MAX_PREFETCH_VERSIONS}.
   *
   * The prefetch-all design (ADR-0389) costs provider round trips per version at EVERY context
   * bind, and the hosted request budget is finite, so rotation depth and request latency are
   * directly coupled. Uncapped, exceeding the budget surfaces as a bare deadline timeout that
   * names nothing; capped, a tenant past the supported depth gets an error that says so.
   */
  readonly maxPrefetchVersions?: number;
}

export const KMS_CONTEXT_PREFETCH_CONCURRENCY = 4;

/**
 * Deliberately far below the 0xffff the key-version format allows: at roughly two provider round
 * trips per version and 4-way concurrency this stays comfortably inside a 15s request budget,
 * where the format ceiling would not. Raise it only with evidence that the budget still holds.
 */
export const KMS_CONTEXT_MAX_PREFETCH_VERSIONS = 64;

const store = new AsyncLocalStorage<FieldCryptoContext>();

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new InternalError("field-crypto: KMS context request aborted");
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function wipeByteView(value: unknown): void {
  if (!ArrayBuffer.isView(value)) return;
  new Uint8Array(value.buffer, value.byteOffset, value.byteLength).fill(0);
}

/** Run `fn` with the field-crypto tenant context bound. Wrap your tenant-scoped DB work in this. */
export function withFieldCryptoContext<T>(
  ctx: FieldCryptoContext,
  fn: () => T,
): T {
  return store.run(ctx, fn);
}

/** The bound context, or throw — never encrypt/decrypt unscoped (fail-closed, ADR-0005). */
export function currentFieldCryptoContext(): FieldCryptoContext {
  const ctx = store.getStore();
  if (ctx === undefined) {
    // A query reached an encrypted column outside `withFieldCryptoContext` — a wiring bug, not user
    // input. Fail closed as a 500 (never a partial/unscoped read); never coerce a tenant.
    throw new InternalError(
      "field-crypto: no tenant context bound — refusing to encrypt/decrypt unscoped (fail-closed)",
    );
  }
  return ctx;
}

/**
 * Fail closed when a `withKey` callback returns a thenable.
 *
 * `withKey` lends the key for a SYNCHRONOUS operation and zeroizes it when `use` returns. An
 * `async` callback returns at its first `await`, so the key is wiped while the continuation still
 * intends to use it — and the continuation then encrypts under an all-zero key, which round-trips
 * successfully. That is silent confidentiality loss, strictly worse than the residency leak the
 * old returning API produced for the same misuse, so it must be loud.
 *
 * Only thenables are rejected. Iterables are NOT: returning an array or any other iterable from a
 * synchronous callback is legitimate, and a generator body is exotic enough not to justify
 * false-positives on `Symbol.iterator`.
 */
function assertSyncUseResult(result: unknown): void {
  if (
    (typeof result === "object" || typeof result === "function") &&
    result !== null &&
    typeof Reflect.get(result, "then") === "function"
  ) {
    // ADOPT the orphan before throwing. `use()` has already returned a live pending promise whose
    // continuation will resume against the key this frame's `finally` is about to zeroize, and
    // will typically reject (AEAD authentication failure on an all-zero key). With no handler
    // attached that is an unhandled rejection, which Node terminates the process over by default —
    // so a guard meant to make a silent failure loud would instead take down every in-flight
    // request on the instance. Swallowing here is safe precisely because the caller is getting a
    // thrown error carrying the same diagnosis.
    void (result as PromiseLike<unknown>).then(undefined, () => {});
    throw new InternalError(
      "field-crypto: withKey() callback must be synchronous — it returned a thenable, so the lent key was zeroized before the continuation could run",
    );
  }
}

/** Build a `FieldCryptoContext` from a sync provider (e.g. DerivedKeyProvider) for one tenant. */
export function derivedContext(
  provider: SyncFieldKeyProvider,
  tenantId: string,
): FieldCryptoContext {
  return {
    tenantId,
    withKey(keyVersion, use) {
      // `SyncFieldKeyProvider.deriveKey` returns caller-owned material (provider.ts OWNERSHIP names
      // this method explicitly), so this buffer is ours to wipe — no defensive copy needed.
      const key = provider.deriveKey(tenantId, keyVersion);
      // A provider that violates that contract by returning a CACHED buffer gets its cache wiped
      // by the first operation here. Without this guard the second operation would encrypt under
      // an all-zero key and still round-trip, so the tenant would store "encrypted" data under a
      // publicly known key with every check green. An all-zero HKDF output is otherwise a 2^-256
      // event, so treating it as impossible is safe and this is the loud failure instead.
      if (key.every((byte) => byte === 0)) {
        throw new InternalError(
          "field-crypto: sync provider returned an all-zero key — deriveKey() must return fresh, caller-owned material, not a cached buffer a prior operation already zeroized",
        );
      }
      try {
        const result = use(key);
        assertSyncUseResult(result);
        return result;
      } finally {
        key.fill(0);
      }
    },
    currentVersion: () => provider.currentVersionSync(tenantId),
  };
}

/**
 * Build a synchronous request-local context from an async KMS provider.
 *
 * Every version from 1 through current is unwrapped before the context becomes usable, preserving
 * the no-remigration invariant for historical envelopes. The returned context MUST be disposed;
 * production callers should use {@link withKmsFieldCryptoContext}, which guarantees cleanup.
 */
export async function kmsContext(
  provider: FieldKeyProvider,
  tenantId: string,
  options: KmsContextOptions = {},
): Promise<DisposableFieldCryptoContext> {
  if (tenantId.trim().length === 0) {
    throw new ValidationError("field-crypto: tenantId is required");
  }
  const concurrency = options.concurrency ?? KMS_CONTEXT_PREFETCH_CONCURRENCY;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new ValidationError(
      "field-crypto: KMS context concurrency must be an integer from 1 through 16",
    );
  }
  const maxPrefetchVersions =
    options.maxPrefetchVersions ?? KMS_CONTEXT_MAX_PREFETCH_VERSIONS;
  if (
    !Number.isInteger(maxPrefetchVersions) ||
    maxPrefetchVersions < 1 ||
    maxPrefetchVersions > 0xffff
  ) {
    throw new ValidationError(
      "field-crypto: KMS context maxPrefetchVersions must be an integer from 1 through 65535",
    );
  }
  if (isAborted(options.abortSignal)) {
    throw abortError(options.abortSignal);
  }
  const currentVersion = await provider.currentVersion(tenantId);
  if (isAborted(options.abortSignal)) {
    throw abortError(options.abortSignal);
  }
  if (
    !Number.isInteger(currentVersion) ||
    currentVersion < 1 ||
    currentVersion > 0xffff
  ) {
    throw new InternalError(
      "field-crypto: KMS provider returned an invalid current key version",
    );
  }
  // Fail with a diagnosis rather than an anonymous deadline timeout: prefetch-all means every bind
  // pays for the tenant's whole rotation history, so past this depth the request budget is the real
  // limit and the operator needs to know that is what happened.
  if (currentVersion > maxPrefetchVersions) {
    throw new InternalError(
      `field-crypto: tenant has rotated to key version ${String(currentVersion)}, past the ` +
        `${String(maxPrefetchVersions)}-version prefetch limit this request context supports; ` +
        "raise maxPrefetchVersions only with evidence the KMS request budget still holds",
      { tenantId, currentVersion, maxPrefetchVersions },
    );
  }

  const keys = new Map<number, Buffer>();
  let failure: unknown;
  let nextVersion = 1;
  let stopScheduling = false;
  const recordFailure = (error: unknown): void => {
    if (failure === undefined) {
      failure =
        error ??
        new InternalError(
          "field-crypto: KMS provider rejected a DEK unwrap without an error",
        );
    }
    stopScheduling = true;
  };
  const worker = async (): Promise<void> => {
    while (!stopScheduling) {
      if (isAborted(options.abortSignal)) {
        recordFailure(abortError(options.abortSignal));
        return;
      }
      const version = nextVersion;
      if (version > currentVersion) return;
      nextVersion += 1;
      let value: unknown;
      try {
        value = await provider.keyFor(tenantId, version);
        if (isAborted(options.abortSignal)) {
          wipeByteView(value);
          recordFailure(abortError(options.abortSignal));
          return;
        }
        if (!Buffer.isBuffer(value) || value.length !== 32) {
          wipeByteView(value);
          recordFailure(
            new InternalError(
              "field-crypto: KMS provider returned an invalid 32-byte Buffer DEK",
            ),
          );
          return;
        }
        // Length alone is not proof of a key. An all-zero unwrap passes every shape check, gets
        // cached, and is then lent to every operation — so writes would be "encrypted" under a
        // publicly known key and would still round-trip green. Same 2^-256 reasoning as the sync
        // path's guard in `derivedContext`; this closes the asymmetry between the two contexts.
        if (value.every((byte) => byte === 0)) {
          wipeByteView(value);
          recordFailure(
            new InternalError(
              "field-crypto: KMS provider returned an all-zero DEK — refusing to bind a context that would encrypt under a publicly known key",
            ),
          );
          return;
        }
        keys.set(version, value);
      } catch (error) {
        wipeByteView(value);
        recordFailure(error);
        return;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, currentVersion) }, async () =>
      worker(),
    ),
  );

  if (failure !== undefined) {
    for (const key of keys.values()) key.fill(0);
    keys.clear();
    throw failure;
  }

  let disposed = false;
  // Holds ONLY lends that are executing right now — each is removed in its own `finally`. This is
  // not the old `workingKeys`, which retained every COMPLETED lend until dispose and is what made
  // residency scale with the request's row count. A synchronous `use` cannot be interrupted by an
  // event-loop-delivered abort, so this set is non-empty at dispose only when the callback itself
  // disposed the context (directly, or by triggering the abort).
  const activeLends = new Set<Buffer>();
  const assertLive = (): void => {
    if (disposed) {
      throw new InternalError(
        "field-crypto: KMS context is disposed — refusing key access",
      );
    }
  };

  const context: DisposableFieldCryptoContext = {
    tenantId,
    withKey(keyVersion, use) {
      assertLive();
      const key = keys.get(keyVersion);
      if (key === undefined) {
        throw new InternalError(
          `field-crypto: request KMS context has no prefetched key v${String(keyVersion)}`,
        );
      }
      // `use` gets a COPY, so a callback that follows the overwrite-after-use convention cannot
      // zero the context's cached source and silently break every later operation in the request.
      // The copy dies with the operation rather than at dispose(), so plaintext residency is now
      // bounded by ONE operation instead of by the request's row count (ADR-0393).
      const workingKey = Buffer.from(key);
      activeLends.add(workingKey);
      try {
        const result = use(workingKey);
        assertSyncUseResult(result);
        // If the callback disposed the context (or aborted the request) partway through, `dispose`
        // has already zeroized this lend underneath it — so anything computed after that point ran
        // against an all-zero key. Refuse the result rather than hand back ciphertext that may be
        // partly or wholly encrypted under a publicly known key.
        if (disposed) {
          throw new InternalError(
            "field-crypto: KMS context was disposed during the operation — refusing a result computed across disposal",
          );
        }
        return result;
      } finally {
        workingKey.fill(0);
        activeLends.delete(workingKey);
      }
    },
    currentVersion() {
      assertLive();
      return currentVersion;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      options.abortSignal?.removeEventListener("abort", disposeOnAbort);
      for (const key of keys.values()) key.fill(0);
      keys.clear();
      // A lend whose callback is still running has NOT reached its `finally` yet, so completed
      // lends being self-wiping is not sufficient — dispose must reach the in-flight one too, or a
      // callback that disposes and then keeps running holds live plaintext past disposal.
      for (const lend of activeLends) lend.fill(0);
      activeLends.clear();
    },
  };
  const disposeOnAbort = (): void => {
    context.dispose();
  };
  options.abortSignal?.addEventListener("abort", disposeOnAbort, {
    once: true,
  });
  if (isAborted(options.abortSignal)) {
    context.dispose();
    throw abortError(options.abortSignal);
  }
  return context;
}

/**
 * Bind a KMS-backed field context for one request and zero every prefetched plaintext DEK at exit.
 * AsyncLocalStorage propagates the context through awaited tenant work; cleanup runs on success or
 * failure and no context is retained process-wide.
 */
export async function withKmsFieldCryptoContext<T>(
  provider: FieldKeyProvider,
  tenantId: string,
  fn: (ctx: FieldCryptoContext) => Promise<T> | T,
  options: KmsContextOptions = {},
): Promise<T> {
  const ctx = await kmsContext(provider, tenantId, options);
  try {
    const result = await withFieldCryptoContext(ctx, () => fn(ctx));
    if (isAborted(options.abortSignal)) {
      throw abortError(options.abortSignal);
    }
    return result;
  } finally {
    ctx.dispose();
  }
}

/** Encrypt a plaintext under a context's current key version → the base64 envelope. (Pure; testable.) */
export function sealField(
  ctx: FieldCryptoContext,
  columnContext: string,
  plaintext: string,
  cipher: AeadCipher = aesGcm,
): string {
  const keyVersion = ctx.currentVersion();
  // The key is lent for this operation only; the context wipes it when this callback returns.
  return ctx.withKey(keyVersion, (key) => {
    const aad = buildAad(ctx.tenantId, keyVersion, columnContext);
    const { nonce, ciphertext, tag } = cipher.encrypt(
      key,
      Buffer.from(plaintext, "utf8"),
      aad,
    );
    return serializeEnvelope({
      algId: cipher.algId,
      keyVersion,
      nonce,
      ciphertext,
      tag,
    });
  });
}

/** Decrypt a stored envelope under a context (key version comes from the envelope). (Pure; testable.) */
export function openField(
  ctx: FieldCryptoContext,
  columnContext: string,
  stored: string,
): string {
  const env = parseEnvelope(stored);
  return ctx.withKey(env.keyVersion, (key) => {
    const aad = buildAad(ctx.tenantId, env.keyVersion, columnContext);
    const cipher = cipherForAlg(env.algId);
    return cipher
      .decrypt(
        key,
        { nonce: env.nonce, ciphertext: env.ciphertext, tag: env.tag },
        aad,
      )
      .toString("utf8");
  });
}

/**
 * An encrypted `text` column bound to a stable `columnContext` (the column's identity, bound into
 * AAD so a ciphertext cannot be moved to another column). Use inside a table definition:
 * `ssn: encryptedColumn("patient.ssn")("ssn")`. Reads the ambient tenant context (fail-closed).
 */
export function encryptedColumn(
  columnContext: string,
  cipher: AeadCipher = aesGcm,
) {
  return customType<{ data: string; driverData: string }>({
    dataType() {
      return "text";
    },
    toDriver(plaintext: string): string {
      return sealField(
        currentFieldCryptoContext(),
        columnContext,
        plaintext,
        cipher,
      );
    },
    fromDriver(stored: string): string {
      return openField(currentFieldCryptoContext(), columnContext, stored);
    },
  });
}
