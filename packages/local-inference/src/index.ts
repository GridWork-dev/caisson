export { EMBEDDING_DIM } from "./backend.ts";
export type {
  InferenceBackend,
  CompletionRequest,
  CompletionResult,
} from "./backend.ts";
export { DEFAULT_ONNX_MODEL } from "./model.ts";
export { StubInferenceBackend } from "./stub.ts";
export {
  OnnxEmbeddingBackend,
  type OnnxBackendConfig,
} from "./onnx-backend.ts";
export {
  RentedInferenceBackend,
  createLiveRentedTransport,
  type RentedBackendConfig,
  type RentedTransport,
  type RentedEmbedResponse,
  type RentedCompleteResponse,
  type MeterSink,
  type LiveRentedTransportConfig,
} from "./rented-backend.ts";
export {
  createOpenRouterRentedTransport,
  type OpenRouterRentedTransportConfig,
} from "./openrouter-transport.ts";
export {
  createAzureOpenAIRentedTransport,
  type AzureOpenAIRentedTransportConfig,
} from "./azure-openai-transport.ts";
export {
  createBedrockRentedTransport,
  type BedrockRentedTransportConfig,
} from "./bedrock-transport.ts";
export {
  EgressGuard,
  createEgressGuard,
  localOnlyPolicy,
  ZERO_EGRESS_POLICY,
  type EgressSink,
  type GuardedFetch,
  type PrivacyPolicy,
  type PrivacyMode,
  type SanctionedSinkKind,
} from "@caisson-sh/local-privacy";
