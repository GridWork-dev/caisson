// Browser-safe inference port (`@caisson-sh/local-inference/browser`): the framework-free contract,
// locked embedding/model coordinates, and deterministic zero-network stub. The main `.` barrel is
// unchanged and remains the full server surface; every runtime value here is also exported there.
//
// Deliberately excluded: OnnxEmbeddingBackend and its optional runtime/model-fetch path; every
// rented/provider transport; credentials and SigV4 signing; meter sinks; privacy guards; and any
// network-bearing code. Fixture and presentation helpers are consumer-owned and are not public API.
export { EMBEDDING_DIM } from "./backend.ts";
export type {
  CompletionRequest,
  CompletionResult,
  InferenceBackend,
} from "./backend.ts";
export { DEFAULT_ONNX_MODEL } from "./model.ts";
export { StubInferenceBackend } from "./stub.ts";
