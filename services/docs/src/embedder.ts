// src/embedder.ts — the CI/offline embedding seam (ADR-0096, the ADR-0064 stub pattern). `FakeEmbedder`
// implements `@caisson/local-store`'s `Embedder` port with a DETERMINISTIC hashed bag-of-words vector:
// no model, no network, stable for a fixed input — yet shaped like a real embedding (fixed `dim`,
// L2-normalized) and weakly semantic (texts sharing tokens get higher cosine similarity), so the hybrid
// vector + RRF wiring is genuinely exercised in tests. At DEPLOY a real embedder (OpenRouter
// `qwen3-embedding-8b`, 1024-dim) is wired in its place against the same `Embedder` interface; that
// live transport is the one un-exercised path (out of scope for this slice).
import { createHash } from "node:crypto";
import type { Embedder } from "@caisson/local-store";

/** Small default width — big enough to spread tokens, small enough to keep the test suite fast. */
export const FAKE_EMBED_DIM = 64;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/** Stable bucket in [0, dim) for a token — first 8 hex of its sha256 as an int, modulo dim. */
function bucket(token: string, dim: number): number {
  return (
    parseInt(createHash("sha256").update(token).digest("hex").slice(0, 8), 16) %
    dim
  );
}

/**
 * A deterministic, offline embedder. Accumulates a per-token hashed bag-of-words histogram, then
 * L2-normalizes (a zero vector for empty/symbol-only text stays zero — a valid, in-bounds vector).
 */
export class FakeEmbedder implements Embedder {
  readonly dim: number;

  constructor(dim: number = FAKE_EMBED_DIM) {
    this.dim = dim;
  }

  embed(text: string): Promise<number[]> {
    const vec = new Array<number>(this.dim).fill(0);
    for (const tok of tokenize(text)) {
      const i = bucket(tok, this.dim);
      vec[i] = (vec[i] ?? 0) + 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return Promise.resolve(norm === 0 ? vec : vec.map((v) => v / norm));
  }
}
