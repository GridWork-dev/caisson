# AGENTS — @caisson-sh/prompt-registry

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or the AI
Production Kit gateway must know to use the prompt registry correctly.

## Invariants (do not violate)

- **Versions are APPEND-ONLY (ADR-0006/0061).** `registerPrompt` mints a NEW version that supersedes
  the current tip — it never edits one. The `prompt_version` table GRANTs SELECT + INSERT only;
  UPDATE/DELETE are REVOKED, so "fixing a prompt" is always a new version. "Current" is DERIVED (the
  tip nothing supersedes), never a stored flag — reuse the kernel `versioning` chain, never re-derive.
- **Every call runs inside `withTenant` (ADR-0005).** Both tables are FORCE-RLS. The functions take
  `accountId` for the row's own column + readable errors, NOT to authorize — RLS is the boundary. A
  missing row (or another tenant's) is a fail-closed 404, never a 403 (no existence leak).
- **Rendering is the ONLY untrusted-input boundary (ADR-0061).** Resolve a version, then render with
  `renderVersion(version, vars)` / `renderPrompt`. Vars are validated against the version's typed
  `.strict()` schema (unknown var rejected, missing var fails, types checked), then escaped and
  substituted in a SINGLE non-recursive pass. A value can never form/re-open a `{{placeholder}}`, add
  a message, or forge a role. Never hand-interpolate untrusted strings into a prompt — always render.

## Addressing

- `name` — the current tip (latest version).
- `name@<n>` — an exact immutable version (e.g. `soc2@3`).
- `name@<alias>` — a mutable pointer (`prod`, `canary`). `setAlias` swaps the LIVE prompt with no
  redeploy and mutates ONLY the pointer; the version rows are untouched. `setAlias` to a missing
  version fails closed (no dangling pointer).
- `resolvePrompt(tx, accountId, ref)` parses any of the three and returns the version.

## Entry points

`.` is the full surface. `@caisson-sh/prompt-registry/browser` is the client-safe subset — addressing
(`parsePromptRef`) plus the render boundary (`renderPrompt`, `buildVarSchema`, the message and var
schemas) — and never carries a registry function or the schema module, because those take a
`TenantExecutor` and RLS is the tenant boundary. Import from `./browser` in a client bundle; import
from `.` on the server. Never widen `./browser` with a name that is not already on `.`.

## Variable schema

`var_spec` is a serializable `{ name: "string" | "number" | "boolean" }` map (names are identifiers).
`buildVarSchema` compiles it to a strict Zod object at render time. Non-string scalars are coerced to
their string form at the escaping boundary.

## Out of scope (this primitive)

No provider call, no token metering (that is `@caisson-sh/ai-meter`), no eval linkage logic (that is
`@caisson-sh/ai-evals`). This package only stores, addresses, and renders prompts. The golden fixture
`src/__golden__/render.json` pins the render contract; update only via `BLESS=1`.
