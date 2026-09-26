// The browser-safe entry (`@caisson-sh/agent-kernel/browser`, ADR-0396): the artifact schema and its
// authoring helpers, the lifecycle act FSM, the governance decision algebra, and the redacting
// logger. ADDITIVE — the `.` barrel is untouched and stays the full node-capable surface; every
// name here is also on `.` (the subset test in browser-safety.test.ts pins that direction, and it
// is one-way: a name may live on `.` alone, never on `./browser` alone).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - hooks.ts — `commandHandler` runs a fixed argv array through node:child_process `execFile`.
//     Irreducibly node-only; a browser has no process to spawn.
//   - audit-lifecycle.ts — value-imports `@caisson-sh/kernel/node` for the chain/version primitives
//     (node:crypto). The tamper-evident record belongs on the server that owns the store.
// ponytail: the split is "whatever the static walk proves clean", not a curated taste list — the
// two exclusions above are the only modules in this package that fail it.
export * from "./schema.ts";
export * from "./validate.ts";
export * from "./lifecycle.ts";
export * from "./governance.ts";
export * from "./redacting-logger.ts";
