// @caisson-sh/local-store — local hybrid retrieval (sqlite-vec vec0 + FTS5 + RRF, RRF_K=60) plus the
// file-per-tenant isolation floor (ADR-0067 / ADR-0073). A `kind: base` primitive both the
// Local-first and Agentic-Dev bundles compose DOWN-ONLY — it never imports a bundle
// (ADR-0022 / ADR-0003).
// No vendor SDK, no LLM call: the embedding that produces a query/doc vector is an injected SEAM the
// consuming edition wires; this package only stores and fuses.
//
export { LocalStore } from "./store.ts";
export type {
  StoreDoc,
  HybridSearchOptions,
  SearchHit,
  ListOptions,
  ListedDoc,
} from "./store.ts";

// The fusion arithmetic itself (also the whole of the `./browser` entry): pure, database-free, and
// the ONE implementation `hybridSearch` fuses its two legs through.
export { RRF_K, fuseByRrf } from "./rrf.ts";
export type { RrfLeg, RrfOptions, RrfRow } from "./rrf.ts";

// The file-per-tenant isolation floor (ADR-0073): the resolved path IS the tenant boundary.
export { tenantDbPath, openTenantDb } from "./tenant-db.ts";

// The pluggable Embedder PORT (ADR-0067): an engine-neutral seam the edition wires; `undefined` ⇒
// the FTS5-only offline floor. The base never calls a model (no live cloud call in CI).
export { assertEmbeddingDim, embedOrSkip } from "./embedder.ts";
export type { Embedder, OptionalEmbedder } from "./embedder.ts";

// The memory-item boundary schema (ADR-0067 / ADR-0002): the validated record handed to the store;
// `scope` is the single-developer-local tenancy seam (no `tenancy-rls` dep).
export { DEFAULT_SCOPE, MemoryItemSchema, parseMemoryItem } from "./schema.ts";
export type { MemoryItem } from "./schema.ts";

// The cloud-egress secret-scrub guard (ADR-0067, security-critical): credential-bearing content is
// scrubbed BEFORE any cloud-embed, and the embed transport is a test-doubled seam (no live cloud call
// in CI). `scrubForEgress` is golden-pinned; `guardEmbedder`/`createCloudEmbedder` apply it.
export {
  scrubForEgress,
  looksLikeSecret,
  guardEmbedder,
  createCloudEmbedder,
} from "./embed-scrub-guard.ts";
export type { CloudEmbedConfig, EmbedFetch } from "./embed-scrub-guard.ts";

// The retention policy (ADR-0067): dedup-on-write (a near-duplicate fact is REINFORCED, not
// copied) + a default sliding TTL + a GC pass (expired / decayed / over-cap) — pure, deterministic,
// buyer-config (`GcConfig`, `.strict()`). Operates over the `MemoryItem` record the edition owns and
// composes ON TOP of the store's `upsert`-by-id; the base never deletes or enumerates store rows.
export {
  parseGcConfig,
  contentDigest,
  dedupKey,
  applyTtlDefault,
  decideWrite,
  isExpired,
  retentionScore,
  planGc,
} from "./gc.ts";
export type {
  GcConfig,
  WriteDecision,
  GcReason,
  GcDrop,
  GcPlan,
} from "./gc.ts";
