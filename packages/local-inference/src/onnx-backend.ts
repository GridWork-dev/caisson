// src/inference/onnx-backend.ts — the REAL local embedding backend behind the `InferenceBackend`
// port (ADR-0064). It runs a MiniLM-class ONNX model on-device via transformers.js
// (`@huggingface/transformers` / onnxruntime) and emits the locked `EMBEDDING_DIM` vector the
// shared base `@caisson-sh/local-store` is opened with.
//
// THIS PATH IS NEVER EXERCISED IN CI (ADR-0064). The deterministic `StubInferenceBackend` is the
// only backend CI runs; the live model load + first-run download is the single un-exercised seam.
// To keep tsc + CI free of the heavy native onnxruntime dependency, the runtime is loaded by a
// DYNAMIC import with a NON-LITERAL specifier (`TRANSFORMERS_MODULE`) — tsc never resolves it and no
// test ever calls it, so `@huggingface/transformers` is an OPTIONAL peer the deployer installs.
//
// Egress + integrity posture (the two risks this file carries):
//   - Egress — every byte the runtime fetches routes through ONE guarded chokepoint
//     (`#guardedFetch`). The host/scheme decision is UNIFIED onto the shared `EgressGuard`
//     (ADR-0221) with the reserved `model-fetch` sink kind — the same fail-closed policy layer
//     the rented lane enforces — then through the kernel `fetchWithTimeout` (the native
//     `AbortSignal.timeout` is forbidden on Bun). transformers.js's own `env.fetch` is overwritten
//     with it, so the library cannot egress out-of-band: any host but the single sanctioned
//     `modelHost` is blocked, any non-https scheme is rejected, and the `model-fetch` sink kind is
//     purpose-bound — fail-closed-to-offline, never a silent hosted fallback.
//   - Model integrity — the model is FIRST-RUN-FETCHED + cached (NOT shipped in the tarball — see
//     `.npmignore`) and every pinned file is SHA-256 hash-verified before it reaches the runtime;
//     a mismatch fails closed. Air-gap buyers pre-seed the cache and run with `offline: true`
//     (`allowRemoteModels=false` + `local_files_only`) for literally zero egress.
//
// The file is framework-free (ADR-0044): it imports no model SDK statically and opens no socket at
// module load — every side effect is lazy, inside `embed()`.
import { createHash } from "node:crypto";
import {
  InternalError,
  ValidationError,
  fetchWithTimeout,
  safeEqualFixed,
} from "@caisson-sh/kernel/node";
import { type EgressGuard, createEgressGuard } from "@caisson-sh/local-privacy";
import { localOnlyPolicy } from "@caisson-sh/local-privacy";
import type {
  CompletionRequest,
  CompletionResult,
  InferenceBackend,
} from "./backend.ts";

// ── @huggingface/transformers (v4) minimal surface ──────────────────────────────────────────────
// Only the subset this backend touches is declared, so the dynamic-import result is narrowed to a
// real type without pulling the package's (uninstalled) `.d.ts` into the build.

/** The outbound fetch signature transformers.js's `env.fetch` accepts (the guard implements this). */
type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/** The transformers.js `env` config object — the offline + outbound-`fetch` injection points. */
interface TransformersEnv {
  allowRemoteModels: boolean;
  allowLocalModels: boolean;
  cacheDir: string | null;
  useFSCache: boolean;
  /** v4 outbound injection point — overwritten with the guarded, host-allowlisted, hash-pinned fetch. */
  fetch: FetchFn;
}
/** A feature-extraction result Tensor; `.data` is the flat (mean-pooled, normalized) embedding. */
interface FeatureTensor {
  readonly data: ArrayLike<number>;
}
type FeatureExtractor = (
  text: string,
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<FeatureTensor>;
/** The subset of the transformers.js module namespace this backend calls. */
interface TransformersModule {
  readonly env: TransformersEnv;
  pipeline(
    task: "feature-extraction",
    model: string,
    opts: { revision: string; cache_dir: string; local_files_only: boolean },
  ): Promise<FeatureExtractor>;
}

/** Package id of the optional runtime — held as a NON-LITERAL so tsc never attempts resolution. */
const TRANSFORMERS_MODULE = "@huggingface/transformers";
/** A 64-char lowercase SHA-256 hex digest — the hash-pin format. */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Deployer configuration for the real local embedding backend. */
export interface OnnxBackendConfig {
  /** Hub model id, e.g. `Xenova/all-MiniLM-L6-v2`. */
  modelId: string;
  /** Model revision/commit selecting the bytes (the SHA-256 pins below are the real integrity gate). */
  revision: string;
  /** Embedding width — MUST equal the local-store vec0 `dim` (default `EMBEDDING_DIM`). */
  dim: number;
  /** The ONE sanctioned egress host (the model-integrity allowlist entry); the only host a model may load from. */
  modelHost: string;
  /** First-run cache directory. NOT shipped in the tarball (see `.npmignore`). */
  cacheDir: string;
  /** `filename → SHA-256 hex` pins; any fetched file in this map is integrity-verified, fail-closed. */
  integrity: Readonly<Record<string, string>>;
  /** Air-gap mode: cache is pre-seeded → force zero egress (`allowRemoteModels=false`, local-only). */
  offline?: boolean;
  /** Per-fetch deadline (ms) for the guarded chokepoint. Default 30s (model files are large). */
  timeoutMs?: number;
}

interface ResolvedConfig {
  modelId: string;
  revision: string;
  dim: number;
  modelHost: string;
  cacheDir: string;
  integrity: Readonly<Record<string, string>>;
  offline: boolean;
  timeoutMs: number;
}

/**
 * Validate + normalize the deployer config, failing closed on any invalid value. The config is a
 * trusted server-side deployment seam (mirrors `crypto/at-rest.ts`); the genuinely UNTRUSTED input —
 * the fetched model bytes — is guarded separately by the host allowlist + the SHA-256 hash-pins.
 */
function resolveConfig(c: OnnxBackendConfig): ResolvedConfig {
  const fail = (path: string, msg: string): never => {
    throw new ValidationError(`invalid onnx backend config: ${msg}`, { path });
  };
  if (c.modelId.trim() === "") fail("modelId", "must be non-empty");
  if (c.revision.trim() === "") fail("revision", "must be non-empty");
  if (c.modelHost.trim() === "") fail("modelHost", "must be non-empty");
  if (c.cacheDir.trim() === "") fail("cacheDir", "must be non-empty");
  if (!Number.isInteger(c.dim) || c.dim <= 0) {
    fail("dim", "must be a positive integer");
  }
  const integrity = c.integrity ?? {};
  const entries = Object.entries(integrity);
  if (entries.length === 0) {
    fail(
      "integrity",
      "at least one SHA-256 hash-pin is required (fail-closed)",
    );
  }
  for (const [file, hex] of entries) {
    if (!SHA256_HEX.test(hex)) {
      fail(
        `integrity.${file}`,
        "must be a 64-char lowercase SHA-256 hex digest",
      );
    }
  }
  const timeoutMs = c.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    fail("timeoutMs", "must be a positive integer");
  }
  return {
    modelId: c.modelId,
    revision: c.revision,
    dim: c.dim,
    modelHost: c.modelHost,
    cacheDir: c.cacheDir,
    integrity: { ...integrity },
    offline: c.offline ?? false,
    timeoutMs,
  };
}

/**
 * The real local embedding backend. Implements the {@link InferenceBackend} port with an on-device
 * ONNX model; completion is intentionally unsupported here (the generation seam is the rented backend).
 * Loading is lazy + memoized, so first `embed()` triggers the (guarded, hash-pinned) model
 * load and every later call reuses the resident extractor with zero further egress.
 */
export class OnnxEmbeddingBackend implements InferenceBackend {
  readonly model: string;
  readonly dim: number;
  readonly #config: ResolvedConfig;
  /** The shared egress guard, allowlisting ONLY `modelHost` as a `model-fetch` sink. */
  readonly #guard: EgressGuard;
  #extractor: FeatureExtractor | null = null;

  constructor(config: OnnxBackendConfig) {
    this.#config = resolveConfig(config);
    this.model = `${this.#config.modelId}@${this.#config.revision}`;
    this.dim = this.#config.dim;
    // ADR-0221: host/scheme egress enforcement is unified onto the shared EgressGuard — the
    // same fail-closed policy layer the rented lane uses — with the reserved `model-fetch`
    // sink kind. Only the sanctioned modelHost is reachable; the SHA-256 hash-pin below
    // stays inline (the guard vouches for the host, not the bytes).
    this.#guard = createEgressGuard(
      localOnlyPolicy([{ host: this.#config.modelHost, kind: "model-fetch" }]),
    );
  }

  /** Embed text into a unit-norm, fixed-`dim` vector via on-device ONNX mean-pooling. */
  async embed(text: string): Promise<Float32Array> {
    const extractor = await this.#load();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    const vec = Float32Array.from(output.data);
    if (vec.length !== this.dim) {
      // Fail closed: a width mismatch would silently corrupt the vec0 dim-guard downstream.
      throw new InternalError(
        "onnx embedding width does not match the locked dim",
        {
          expected: this.dim,
          received: vec.length,
          model: this.model,
        },
      );
    }
    return vec;
  }

  /**
   * Not supported: this is an embedding-only backend. Local text generation is a separate seam (the
   * rented/hosted backend). Fail closed rather than silently degrade.
   */
  complete(_req: CompletionRequest): Promise<CompletionResult> {
    return Promise.reject(
      new InternalError(
        "the onnx embedding backend does not generate completions; wire a completion backend (the rented-inference seam)",
        { model: this.model },
      ),
    );
  }

  /** Lazily load (and memoize) the feature-extraction pipeline under the guarded egress chokepoint. */
  async #load(): Promise<FeatureExtractor> {
    if (this.#extractor) return this.#extractor;
    // Non-literal specifier ⇒ tsc does not resolve it; the runtime is an optional peer.
    const mod = (await import(TRANSFORMERS_MODULE)) as TransformersModule;
    const { env } = mod;
    env.cacheDir = this.#config.cacheDir;
    env.useFSCache = true;
    env.allowLocalModels = true;
    env.allowRemoteModels = !this.#config.offline; // air-gap ⇒ zero egress
    env.fetch = this.#guardedFetch; // the SINGLE outbound chokepoint
    const extractor = await mod.pipeline(
      "feature-extraction",
      this.#config.modelId,
      {
        revision: this.#config.revision,
        cache_dir: this.#config.cacheDir,
        local_files_only: this.#config.offline,
      },
    );
    this.#extractor = extractor;
    return extractor;
  }

  /**
   * The guarded outbound chokepoint installed as transformers.js's `env.fetch`. The host/scheme/
   * sink-kind decision is delegated to the shared {@link EgressGuard} via `assertAllowedFor(url,
   * "model-fetch")` — the same fail-closed policy layer the rented lane uses (ADR-0221):
   * a non-https scheme, a host off the allowlist, or a wrong sink kind all block BEFORE any socket
   * opens. It then routes through the kernel `fetchWithTimeout` and SHA-256-verifies every pinned
   * file before its bytes reach the runtime; the hash compare is constant-time
   * (`safeEqualFixed`). The guard vouches for the HOST; the hash-pin vouches for the BYTES.
   */
  readonly #guardedFetch: FetchFn = async (input, init) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    // Fail-closed at the shared-policy layer: throws AuthzError (host/scheme/kind) or ValidationError
    // (malformed URL) before any network call — no silent hosted fallback.
    const url = this.#guard.assertAllowedFor(urlStr, "model-fetch");
    const res = await fetchWithTimeout(url, init ?? {}, {
      timeoutMs: this.#config.timeoutMs,
    });
    const file = url.pathname.split("/").pop() ?? "";
    const pin = this.#config.integrity[file];
    if (pin === undefined) return res; // non-pinned (config/tokenizer): pass through unmodified
    const bytes = new Uint8Array(await res.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (!safeEqualFixed(digest, pin)) {
      throw new InternalError(
        "model fetch blocked: integrity hash mismatch (fail-closed)",
        {
          file,
          expected: pin,
          received: digest,
        },
      );
    }
    return new Response(bytes, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}
