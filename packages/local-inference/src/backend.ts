// src/inference/backend.ts — the edition-side InferenceBackend PORT (ADR-0064). The shared base
// @caisson-sh/local-store treats the embedding as an INJECTED seam — it stores and fuses vectors but
// never calls a model. This port is where the EDITION wires that seam: `embed(text) → Float32Array`
// of the locked embedding dimension (which MUST equal the `dim` the local-store vec0 table is opened
// with — a mismatch throws at the store's dim-guard, never silently pads/truncates) plus a
// `complete(...)` text-generation seam.
//
// No live model in CI (ADR-0064): the real local backend (transformers.js / onnxruntime) and
// the rented/hosted backend implement THIS SAME port; CI exercises only the deterministic stub
// (`stub.ts`), so the live transport stays the one un-exercised path. The port is framework-free and
// SDK-free (ADR-0044) — it imports no model runtime and opens no socket.

/**
 * The locked embedding dimension the edition's default local embedding model produces. vec0 fixes
 * the vector width at table creation (ADR-0067), so this is the value the local store MUST be opened
 * with, and every {@link InferenceBackend.embed} result is exactly this many floats. The real
 * default backend is MiniLM-class (384-dim); the stub mirrors it so CI runs over the same
 * embedding geometry as production without loading a model.
 */
export const EMBEDDING_DIM = 384;

/** A text-completion request — the generation seam (real local LLM, or metered hosted). */
export interface CompletionRequest {
  prompt: string;
  /** Soft upper bound on the generated length. Optional; the backend defines its own default. */
  maxTokens?: number;
}

/** A text-completion result. `model` identifies the producing backend (audit / telemetry / golden). */
export interface CompletionResult {
  text: string;
  model: string;
}

/**
 * The edition-side inference port. Both `embed` and `complete` are async: the real backends load or
 * first-run-fetch a model, or call a metered remote, so the seam is Promise-shaped from
 * the start and a deterministic backend (the stub) simply resolves immediately.
 */
export interface InferenceBackend {
  /** A stable identifier for the backing model / provider (telemetry, golden labelling). */
  readonly model: string;
  /** The fixed embedding width this backend emits — MUST match the local-store vec0 `dim`. */
  readonly dim: number;
  /**
   * Embed text into a fixed-`dim` vector. The result length is ALWAYS `dim`, so it feeds the local
   * store's dim-guard without padding or truncation. A deterministic backend (the stub) returns the
   * byte-identical vector for identical input.
   */
  embed(text: string): Promise<Float32Array>;
  /** Generate a completion for a prompt — the generation seam (stubbed, never networked, in CI). */
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
