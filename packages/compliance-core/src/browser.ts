// The browser-safe entry (`@caisson-sh/compliance-core/browser`, ADR-0396): the evidence-collector
// contract with its flag-never-guess result constructors, the four pure collectors, the canonical
// pack format, the cross-framework rollup, and the pack ASSEMBLY (the flag-never-guess refusal plus
// the derived, schema-validated manifest body). ADDITIVE — the `.` barrel is untouched and stays the
// full node-capable surface; every name here is also on `.` (the subset test in
// browser-safety.test.ts pins that direction).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - evidence/generate.ts — phase 3 is a deterministic ZIP (`node:zlib`) plus a SHA-256 digest
//     (`node:crypto`). Irreducibly node-only; phases 1 + 2 were extracted to assemble.ts precisely
//     so a browser caller gets the honest half without them.
//   - evidence/collectors/chain-verify.ts — value-imports `verifyChain` from `@caisson-sh/kernel/node`,
//     whose recompute is the sync `node:crypto` hash. The browser twin of that hash
//     (`hashChainLinkAsync`, `@caisson-sh/kernel/audit-verify`) is ASYNC, and `EvidenceCollector.collect`
//     is synchronous by contract — so admitting this collector would mean either a node builtin in
//     the graph or an async fork of the collector contract. Neither is worth one card.
//   - evidence/collectors/field-crypto-policy.ts — value-imports `parseEnvelope` from
//     `@caisson-sh/field-crypto`, whose barrel reaches three cloud-KMS SDKs AND whose envelope module
//     is written against the node `Buffer` GLOBAL (invisible to a source-graph walk, absent in a
//     browser). Retiring that one needs the envelope rewritten off `Buffer`, a breaking change to a
//     published type.
//   - evidence/external-anchor.ts, evidence/binding-table.ts, evidence/drift/* — no consumer needs
//     them browser-side; drift/anchor-sink.ts and drift/schedule.ts import `node:crypto` outright.
//   - the `@caisson-sh/oscal-spine` re-export — reachable browser-side through that package's own
//     `./browser` entry; duplicating it here would widen this surface for no caller.
// ponytail: admission is per-consumer, not aspirational — the shared walk in browser-safety.test.ts
// is what any future addition has to pass.
export * from "./evidence/collector.ts";
export * from "./evidence/collectors/rls-force.ts";
export * from "./evidence/collectors/worm-retention.ts";
export * from "./evidence/collectors/ai-risk-register.ts";
export * from "./evidence/collectors/impersonation.ts";
export * from "./evidence/crosswalk-rollup.ts";
export * from "./evidence/pack-format.ts";
export * from "./evidence/assemble.ts";
