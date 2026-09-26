// @caisson-sh/prompt-registry — append-only versioned prompts + `name@version` / `name@alias`
// addressing + a mutable alias pointer + injection-safe templating (ADR-0061). A base primitive the
// AI Production Kit gateway resolves prompts through; never imports an edition (ADR-0003).

// Schema (DDL + table names).
export {
  PROMPT_REGISTRY_SCHEMA_SQL,
  PROMPT_VERSION_TABLE,
  PROMPT_ALIAS_TABLE,
} from "./schema.ts";

// Templating.
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

// Addressing (`name@version` / `name@alias` parsing — no database, no driver).
export { parsePromptRef } from "./refs.ts";
export type { PromptRef } from "./refs.ts";

// Registry API.
export {
  registerPromptInput,
  setAliasInput,
  registerPrompt,
  getVersion,
  getCurrentVersion,
  listVersions,
  setAlias,
  getAlias,
  resolvePrompt,
  renderVersion,
} from "./registry.ts";
export type {
  RegisterPromptInput,
  SetAliasInput,
  PromptVersion,
} from "./registry.ts";
