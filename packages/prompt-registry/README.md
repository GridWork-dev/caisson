# @caisson/prompt-registry

Append-only versioned prompts with `name@version` / `name@alias` addressing and an injection-safe
templating boundary. A base **primitive** (Apache-2.0) of the AI
Production Kit (ADR-0061). Built on `@caisson/kernel` (versioning + errors) and
`@caisson/tenancy-rls` (FORCE-RLS); never depends "up" on an edition (ADR-0003).

## What it gives you

- **Append-only versions (ADR-0006).** `registerPrompt` mints v1, then each call supersedes the tip
  (`supersedes_id` chain via the kernel `versioning` module). "Current" is derived, never stored. A
  version row cannot be updated or deleted (append-only at the grant level).
- **Addressing.** `resolvePrompt(tx, accountId, ref)` resolves `name` (current), `name@3` (exact
  version), or `name@prod` (alias). `setAlias` promotes a `prod`/`canary` pointer with no redeploy —
  mutating only the pointer, never a version.
- **Injection-safe templating.** `renderVersion(version, vars)` validates vars against the version's
  typed `.strict()` schema, then substitutes `{{name}}` placeholders in a single non-recursive pass
  with delimiter escaping — an untrusted value can never form/re-open a placeholder, add a message,
  or forge a role. The render contract is golden-pinned (`src/__golden__/render.json`).
- **Fail-closed tenant isolation.** Both tables are FORCE-RLS; every call runs inside `withTenant`.

## Entry points

- `.` — the full surface: the schema, the registry API, addressing, and templating (node-capable,
  reaches `@caisson/tenancy-rls` and the `pg` driver through the schema module).
- `./browser` — addressing (`parsePromptRef`) and the injection-safe templating boundary
  (`renderPrompt`, `buildVarSchema`, and the message/var schemas), safe inside a client bundle. The
  registry functions and the schema are deliberately absent: each takes a `TenantExecutor` and runs
  SQL, and fail-closed tenant isolation belongs on the server. Every name on `./browser` is also on
  `.`.
- `./ui` — the React surface.

## Usage

```ts
import { withTenant } from "@caisson/tenancy-rls";
import {
  PROMPT_REGISTRY_SCHEMA_SQL,
  registerPrompt,
  resolvePrompt,
  setAlias,
  renderVersion,
} from "@caisson/prompt-registry";

// migrate: exec PROMPT_REGISTRY_SCHEMA_SQL once (a numbered migration in prod, ADR-0014/0070).

await withTenant(db, accountId, async (tx) => {
  const v1 = await registerPrompt(tx, {
    accountId,
    name: "soc2-summary",
    messages: [
      { role: "system", content: "You are {{persona}}." },
      { role: "user", content: "Summarize:\n{{document}}" },
    ],
    varSpec: { persona: "string", document: "string" },
  });
  await setAlias(tx, {
    accountId,
    name: "soc2-summary",
    alias: "prod",
    version: v1.version,
  });

  const live = await resolvePrompt(tx, accountId, "soc2-summary@prod");
  const messages = renderVersion(live, {
    persona: "a compliance assistant",
    document: untrustedUserInput, // escaped — cannot break out of its slot
  });
});
```

## Test

```sh
bun test ./src        # render golden (BLESS unset) + RLS/versioning integration (PGlite)
```
