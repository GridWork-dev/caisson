// @caisson/local-store — local hybrid retrieval (sqlite-vec vec0 + FTS5 + RRF, RRF_K=60) plus the
// file-per-tenant isolation floor (ADR-0067 / ADR-0073). A `kind: base` primitive both P4 editions
// (local-ai, agent-dev) compose DOWN-ONLY — it never imports an edition (ADR-0022 Gate-3 / ADR-0003).
// No vendor SDK, no LLM call: the embedding that produces a query/doc vector is an injected SEAM the
// consuming edition wires; this package only stores and fuses.
//
// Scaffold barrel — `src/store.ts` (the hybrid retrieval) and `src/tenant-db.ts` (the file-per-tenant
// resolver) land in the follow-up tasks (ADR-0067 logic, ADR-0073 isolation floor) and export here.
export {};
