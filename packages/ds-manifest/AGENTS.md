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

| Symbol                    | Use                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `componentManifestSchema` | The Zod schema for a generated component manifest; `.strict()` at every level.        |
| `parseComponentManifest`  | Validate + parse an unknown value into a `ComponentManifest`; throws on any mismatch. |
| `loadBaseManifest`        | Read + validate the committed base component manifest off disk.                       |
| `checkContrast`           | Run the shared browser-rendered WCAG matrix, including optional code-syntax tokens.   |
| `renderedContrastRatio`   | Score the stricter channel-clamp/CSS-Color-4 rendered sRGB contrast ratio.            |

## Invariants

- Every exported function is pure: no network call, no renderer, no filesystem write. `loadBaseManifest`
  is the one read from disk, and it only ever reads the manifest bundled with this package.
- `checkContrast` takes the theme/functional-token objects as arguments rather than importing
  `@caisson/ui`; the kit calls this shared implementation in its own gate, so gamut mapping,
  thresholds, semantic pairs, functional colors, and code-syntax colors cannot drift.
- `componentManifestSchema` rejects an unrecognized field at any level (component, prop, or the
  manifest envelope itself) — a generator bug or a hand-edit typo fails loudly, not silently.

## Scope

This package owns the shared shape, generated artifact, and pure checks. Generation from
`@caisson/ui` source lives in the kit's build-time script; authorization remains the MCP server's
Bearer-gate concern.
