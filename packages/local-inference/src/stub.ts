// src/inference/stub.ts — the deterministic CI inference backend (ADR-0064: no live model in CI).
// Implements the `InferenceBackend` port with ZERO network and ZERO model: an embedding is a PURE
// function of its input text (SHA-256-seeded mulberry32 PRNG → L2-normalized vector), so identical
// text always yields the byte-identical vector and distinct texts yield distinct vectors. This is
// the ONLY inference backend exercised in CI — the real on-device and rented backends share the
// same port and are never called in tests, leaving the live model fetch / remote call the single
// un-exercised path. Determinism keeps any embedding-derived fixture golden-stable across runs/hosts.
import { ValidationError } from "@caisson-sh/kernel/browser";
import { EMBEDDING_DIM } from "./backend.ts";
import type {
  CompletionRequest,
  CompletionResult,
  InferenceBackend,
} from "./backend.ts";

/** A tiny, fully-deterministic PRNG (mulberry32) seeded from a 32-bit value → floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash text with the browser-native WebCrypto primitive shared by Bun and modern browsers. */
async function sha256(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

/** Derive a deterministic 32-bit seed from text (SHA-256 → first 4 bytes, big-endian). */
async function seedFromText(text: string): Promise<number> {
  const digest = await sha256(text);
  return new DataView(
    digest.buffer,
    digest.byteOffset,
    digest.byteLength,
  ).getUint32(0, false);
}

/**
 * The deterministic, offline `InferenceBackend` used by every CI test. `dim` defaults to the locked
 * {@link EMBEDDING_DIM} so the stub matches production geometry; a smaller `dim` may be injected for
 * focused tests. A non-positive `dim` fails closed at construction (never a silently malformed seam).
 */
export class StubInferenceBackend implements InferenceBackend {
  readonly model = "caisson-stub-embed";
  readonly dim: number;

  constructor(opts: { dim?: number } = {}) {
    const dim = opts.dim ?? EMBEDDING_DIM;
    if (!Number.isInteger(dim) || dim <= 0) {
      throw new ValidationError(
        "stub inference dim must be a positive integer",
        { received: dim },
      );
    }
    this.dim = dim;
  }

  /** Pure text → unit-norm vector. Same text ⇒ byte-identical result; no model, no socket. */
  async embed(text: string): Promise<Float32Array> {
    const rand = mulberry32(await seedFromText(text));
    const raw = new Array<number>(this.dim);
    let sumSq = 0;
    for (let i = 0; i < this.dim; i++) {
      const v = rand() * 2 - 1; // [-1, 1)
      raw[i] = v;
      sumSq += v * v;
    }
    // L2-normalize to a unit vector (embedding-space convention); never divide by zero.
    const inv = sumSq > 0 ? 1 / Math.sqrt(sumSq) : 0;
    return Float32Array.from(raw, (v) => v * inv);
  }

  /** Deterministic offline echo — a stable transform of the prompt, never a model/network call. */
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const digest = Array.from((await sha256(req.prompt)).subarray(0, 4), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const max = req.maxTokens ?? 64;
    const text = `stub:${digest} ${req.prompt}`.slice(0, Math.max(0, max));
    return { text, model: this.model };
  }
}
