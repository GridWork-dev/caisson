// The browser-safe entry (`@caisson-sh/prompt-registry/browser`, ADR-0396): the two halves of this
// package that never touch a database — `name@selector` addressing and the injection-safe render
// boundary with its strict variable schemas. ADDITIVE: the `.` barrel is untouched and stays the
// full node-capable surface; every name here is also on `.`, one-way (the subset test in
// browser-safety.test.ts pins that direction).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - registry.ts — registerPrompt / getVersion / getCurrentVersion / listVersions / setAlias /
//     getAlias / resolvePrompt each take a `@caisson-sh/tenancy-rls` TenantExecutor and run SQL inside
//     a `withTenant` scope. The database half is server-only and never joins this entry. That is
//     not only a bundle-size line: those functions are where fail-closed tenant isolation lives,
//     and moving one browser-side would move a trust boundary into untrusted code.
//   - schema.ts (PROMPT_REGISTRY_SCHEMA_SQL, PROMPT_VERSION_TABLE, PROMPT_ALIAS_TABLE) — it
//     value-imports `buildTenantPolicySql`, so it drags `@caisson-sh/tenancy-rls` and the `pg` driver
//     into the graph. That single edge is the one this entry exists to cut.
//   - renderVersion — it lives in registry.ts and is typed on PromptVersion (a database row shape).
//     `renderPrompt` below is the same escaping-and-substitution boundary with the messages and
//     var spec passed directly.
export { parsePromptRef } from "./refs.ts";
export type { PromptRef } from "./refs.ts";

export {
  PROMPT_ROLES,
  VAR_TYPES,
  VAR_NAME_RE,
  promptMessageSchema,
  promptMessagesSchema,
  varSpecSchema,
  buildVarSchema,
  renderPrompt,
} from "./render.ts";
export type {
  PromptRole,
  PromptMessage,
  RenderedMessage,
  VarType,
  VarSpec,
} from "./render.ts";
