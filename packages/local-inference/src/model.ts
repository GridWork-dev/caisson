import { EMBEDDING_DIM } from "./backend.ts";

/**
 * Default MiniLM-class embedder coordinates. This leaf contains configuration data only: the ONNX
 * runtime, first-run fetch, cache path, and integrity pins remain in the server-only backend.
 */
export const DEFAULT_ONNX_MODEL = {
  modelId: "Xenova/all-MiniLM-L6-v2",
  revision: "main",
  dim: EMBEDDING_DIM,
  modelHost: "huggingface.co",
} as const;
