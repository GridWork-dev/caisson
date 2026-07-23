// Deterministic client-side engine for the local-inference poke (ADR-0378 lock 2, kimi CANDIDATES
// section B "On-device inference"). Every export below is either a literal mirror of a real
// `@caisson/local-inference` / `@caisson/local-privacy` constant (parity-pinned in
// local-inference-logic.test.ts against the real package) or a pure browser-safe port of the
// package's deterministic logic. Nothing here fetches, persists, measures, or runs a live model.
//
// Why mirrored instead of imported: `onnx-backend.ts` and `stub.ts` both import `node:crypto`
// (`createHash`) directly, and `@caisson/local-privacy`'s `policy.ts` / `egress-guard.ts` import
// `@caisson/kernel` — whose barrel `index.ts` re-exports `crypto.ts` / `audit-chain.ts` /
// `migration-assembly.ts` (node:crypto) and `ssrf.ts` (node:dns/promises). None of that resolves in
// a browser bundle. The one substitution WebCrypto forces: SHA-256 via `crypto.subtle.digest`
// instead of node:crypto's synchronous `createHash` — `sampleEmbed` is therefore async where the
// package's own `StubInferenceBackend.embed` is effectively sync work wrapped in a resolved Promise.
// Everything else (the mulberry32 PRNG, the seed derivation, the unit-norm, the egress allow
// decision) is a line-for-line port.
//
// The real on-device backend (`OnnxEmbeddingBackend`) runs a live MiniLM-class ONNX model via
// transformers.js — this poke deliberately never loads that runtime (ADR-0378 lock 2: no live
// model in the browser). `sampleEmbed` instead ports `StubInferenceBackend.embed` — the package's
// OWN deterministic, zero-network stand-in for the live model (the only inference path CI ever
// exercises, per stub.ts) — so the rendered vector is a real, parity-pinned package algorithm,
// visibly labeled as a sample rather than passed off as live MiniLM output.

// ---- Real constants (packages/local-inference/src/backend.ts + onnx-backend.ts) ---------------

/** Verbatim: backend.ts `EMBEDDING_DIM` — the locked embedding width every backend must emit. */
export const EMBEDDING_DIM = 384;

/** Verbatim: onnx-backend.ts `DEFAULT_ONNX_MODEL` — the default MiniLM-class model coordinates. */
export const DEFAULT_ONNX_MODEL = {
  modelId: "Xenova/all-MiniLM-L6-v2",
  revision: "main",
  dim: EMBEDDING_DIM,
  modelHost: "huggingface.co",
} as const;

/** A sample prompt. Edit it below the fold; the embedding is never sent anywhere. */
export const SAMPLE_PROMPT =
  "Summarize the buyer's renewal risk from this support thread.";

// ---- Sample embedding (packages/local-inference/src/stub.ts, StubInferenceBackend.embed) -------

/** Verbatim: stub.ts `mulberry32` — a tiny deterministic PRNG seeded from a 32-bit value. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * WebCrypto port of stub.ts `seedFromText` (SHA-256 → first 4 bytes, big-endian). Async only
 * because `crypto.subtle.digest` is promise-based; the package's node:crypto version is sync.
 */
async function seedFromText(text: string): Promise<number> {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return (
    ((digest[0]! << 24) |
      (digest[1]! << 16) |
      (digest[2]! << 8) |
      digest[3]!) >>>
    0
  );
}

/**
 * A fixed, deterministic sample vector — the browser-safe port of `StubInferenceBackend.embed()`.
 * NOT a live MiniLM output; no model runs here. Byte-identical to the real stub on the same input
 * (parity-pinned in the test). The real on-device backend is `OnnxEmbeddingBackend` over
 * {@link DEFAULT_ONNX_MODEL}; rendering its constants alongside this fixed vector is honest about
 * the substitution, not a claim that this IS its output.
 */
export async function sampleEmbed(
  text: string,
  dim: number = EMBEDDING_DIM,
): Promise<Float32Array> {
  const rand = mulberry32(await seedFromText(text));
  const raw = new Array<number>(dim);
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    const v = rand() * 2 - 1; // [-1, 1)
    raw[i] = v;
    sumSq += v * v;
  }
  const inv = sumSq > 0 ? 1 / Math.sqrt(sumSq) : 0;
  return Float32Array.from(raw, (v) => v * inv);
}

/** Chunk-average `vec` down to at most `bars` values for a compact spark strip. Pure. */
export function sparkBars(vec: Float32Array, bars = 48): number[] {
  if (vec.length === 0) return [];
  const chunk = Math.ceil(vec.length / bars);
  const out: number[] = [];
  for (let i = 0; i < vec.length; i += chunk) {
    const slice = vec.subarray(i, i + chunk);
    let sum = 0;
    for (const v of slice) sum += v;
    out.push(slice.length > 0 ? sum / slice.length : 0);
  }
  return out;
}

/** Min-max normalize to 0..100 (CSS bar-height percentages). A flat input renders as flat 50s. */
export function normalizeBars(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 50);
  return values.map((v) => ((v - min) / range) * 100);
}

// ---- Egress boundary (packages/local-privacy/src/{policy,egress-guard}.ts) ---------------------

/** Verbatim: policy.ts `SANCTIONED_SINK_KINDS` — the closed set of egress reasons. */
export const SANCTIONED_SINK_KINDS = ["model-fetch", "rented-backend"] as const;
export type SanctionedSinkKind = (typeof SANCTIONED_SINK_KINDS)[number];

export type BackendChoice = "on-device" | "rented";

/** A sample rented-inference host, illustrative only; this poke never fetches it. */
export const SAMPLE_RENTED_HOST = "api.rented-inference.example";

export type UsageUnit = "credit" | "token" | "request" | "second";

/** Shaped like `@caisson/kernel`'s `UsageMetering.unit`/`.quantity` (the two provider-reported fields). */
export interface SampleUsage {
  readonly unit: UsageUnit;
  readonly quantity: number;
}

/** A fixed, labeled-as-sample usage record — what one rented `embed()` call would meter. */
const SAMPLE_USAGE: SampleUsage = { unit: "token", quantity: 128 };

interface AllowlistEntry {
  readonly host: string;
  readonly kind: SanctionedSinkKind;
}

/**
 * Mirrors the allow decision inside `EgressGuard.assertAllowedFor` (egress-guard.ts): `host` may
 * egress for `kind` only if it appears in the allowlist AND is allowlisted for THAT kind
 * specifically (purpose-binding — a host sanctioned for `model-fetch` never doubles as a
 * `rented-backend` sink). Parity-pinned against the real guard in the test.
 */
export function isAllowlistedFor(
  host: string,
  kind: SanctionedSinkKind,
  allowlist: readonly AllowlistEntry[],
): boolean {
  const entry = allowlist.find((e) => e.host === host);
  return entry !== undefined && entry.kind === kind;
}

export interface EgressReading {
  readonly outcome: "local" | "blocked" | "egressed";
  readonly host: string | null;
  readonly sinkKind: SanctionedSinkKind | null;
  readonly requests: 0 | 1;
  readonly usage: SampleUsage | null;
}

/**
 * Evaluate the egress boundary for one call. `OnnxEmbeddingBackend.embed()` never contacts the
 * network once its first-run model load is cached (onnx-backend.ts) — so "on-device" always reads
 * zero, independent of the allowlist. `RentedInferenceBackend` is off by default
 * (rented-backend.ts): its constructor calls `guard.assertAllowedFor(endpoint, "rented-backend")`
 * and THROWS (fail-closed-to-offline) unless the host is explicitly opted in — mirrored here as the
 * "blocked" outcome, the control's failure/deny path. Opting the sample host in flips the reading to
 * "egressed": one request, one metered usage record.
 */
export function evaluateEgress(
  backend: BackendChoice,
  hostAllowlisted: boolean,
): EgressReading {
  if (backend === "on-device") {
    return {
      outcome: "local",
      host: null,
      sinkKind: null,
      requests: 0,
      usage: null,
    };
  }
  const allowlist: AllowlistEntry[] = hostAllowlisted
    ? [{ host: SAMPLE_RENTED_HOST, kind: "rented-backend" }]
    : [];
  if (!isAllowlistedFor(SAMPLE_RENTED_HOST, "rented-backend", allowlist)) {
    return {
      outcome: "blocked",
      host: SAMPLE_RENTED_HOST,
      sinkKind: "rented-backend",
      requests: 0,
      usage: null,
    };
  }
  return {
    outcome: "egressed",
    host: SAMPLE_RENTED_HOST,
    sinkKind: "rented-backend",
    requests: 1,
    usage: SAMPLE_USAGE,
  };
}
