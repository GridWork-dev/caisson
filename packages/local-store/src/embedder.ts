// src/embedder.ts — the pluggable Embedder PORT (ADR-0067). Engine-neutral: this `kind: base` package
// ships only the INTERFACE a vector embedder must satisfy — it never bundles a model, opens a socket,
// or reads a key. The consuming EDITION wires a concrete embedder — the seam the egress guard covers,
// with the cloud-embed path test-doubled in CI. When NO embedder is configured the store runs on the
// FTS5 floor alone — fully offline, never a silent fallback to some default model.
import { ValidationError } from "@caisson-sh/kernel";

/**
 * A vector-embedding backend. `dim` is the FIXED vector width — it MUST equal the `LocalStore` dim
 * fixed at table creation (ADR-0067), so a mismatched backend is caught at wiring time, not at query
 * time. `embed` is async because every real backend is a network/model call; this base package never
 * invokes it (the live transport stays the only un-exercised path — no live cloud call in CI).
 */
export interface Embedder {
  /** The fixed embedding width every produced vector must have. */
  readonly dim: number;
  /** Produce an embedding vector for one text. The edition wires the concrete implementation. */
  embed(text: string): Promise<number[]>;
}

/**
 * An OPTIONAL embedder. `undefined` is a FIRST-CLASS mode — no embedder is configured, so retrieval
 * runs on the FTS5 offline floor alone (ADR-0067). A missing embedder is never an error and never
 * triggers a default model; it is the documented zero-config path.
 */
export type OptionalEmbedder = Embedder | undefined;

/**
 * Assert a produced vector matches the expected width. Fail-closed (flag-never-guess): a wrong-width
 * vector THROWS a redaction-safe `ValidationError` (carrying only the lengths, never the vector) —
 * it is never padded, truncated, or guessed, matching the store's dimension contract.
 */
export function assertEmbeddingDim(dim: number, vector: number[]): void {
  if (vector.length !== dim) {
    throw new ValidationError("embedder returned wrong dimension", {
      expected: dim,
      received: vector.length,
    });
  }
}

/**
 * Embed `text` through `embedder`, returning `undefined` when none is configured (the FTS5-only
 * floor). When an embedder IS configured, the produced vector is validated against `embedder.dim`
 * before it leaves this seam — the single place the "no embedder ⇒ FTS floor" decision and the
 * dimension contract are encoded, so a wrong-width vector can never silently corrupt the vec index.
 */
export async function embedOrSkip(
  embedder: OptionalEmbedder,
  text: string,
): Promise<number[] | undefined> {
  if (embedder === undefined) return undefined;
  const vector = await embedder.embed(text);
  assertEmbeddingDim(embedder.dim, vector);
  return vector;
}
