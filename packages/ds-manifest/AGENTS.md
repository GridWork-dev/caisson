# @caisson/ds-manifest — agent contract

Shared data + analysis layer for a design-system kit's agent-facing surface: a component-manifest
schema, a typed reader, and pure static-check functions. Zod/fs-only — no network, no renderer, no
`@caisson/*` runtime dependency.

## What it does

Everything in this package is a pure function or a schema: it never renders a component and never
calls out to a network. Every input a check needs (token objects, file contents, the manifest
itself) is passed in by the caller, so it composes into a CLI command, an MCP tool, or a
build-time generator without any of those needing to depend on each other.

## Scope

This package owns the shared shape and the pure checks. It does not generate the manifest from
`@caisson/ui`'s source (that lives in the kit's own build-time script) and it does not decide who
is allowed to call which check (that is the buyer MCP's entitlement gate).
