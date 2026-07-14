# @caisson/ds-manifest — agent contract

Shared data + analysis layer for a design-system kit's agent-facing surface: a component-manifest
schema, a typed reader, and pure static-check functions. Zod/fs-only — no network, no renderer, no
`@caisson/*` runtime dependency.

## What it does

Everything in this package is a pure function or a schema: it never renders a component and never
calls out to a network. Every input a check needs (token objects, file contents, the manifest
itself) is passed in by the caller, so it composes into a CLI command, an MCP tool, or a
build-time generator without any of those needing to depend on each other.

## Public API

| Symbol                    | Use                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `componentManifestSchema` | The Zod schema for a generated component manifest; `.strict()` at every level.               |
| `parseComponentManifest`  | Validate + parse an unknown value into a `ComponentManifest`; throws on any mismatch.        |
| `loadBaseManifest`        | Read + validate the committed base component manifest off disk.                              |
| `checkContrast`           | Run the WCAG contrast matrix (semantic pairs + functional/status tokens) for one theme mode. |

## Invariants

- Every exported function is pure: no network call, no renderer, no filesystem write. `loadBaseManifest`
  is the one read from disk, and it only ever reads the manifest bundled with this package.
- `checkContrast` takes the theme/functional-token objects as arguments rather than importing
  `@caisson/ui` — it stays in parity with the kit's own contrast gate without creating a runtime
  dependency on it.
- `componentManifestSchema` rejects an unrecognized field at any level (component, prop, or the
  manifest envelope itself) — a generator bug or a hand-edit typo fails loudly, not silently.

## Scope

This package owns the shared shape and the pure checks. It does not generate the manifest from
`@caisson/ui`'s source (that lives in the kit's own build-time script) and it does not decide who
is allowed to call which check (that is the buyer MCP's entitlement gate).
