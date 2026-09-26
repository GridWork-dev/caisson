# @caisson-sh/ds-manifest

Shared data + analysis layer for a design-system kit's agent-facing surface.

- **Layer:** base

A strict component-manifest schema plus a typed reader for the committed 39-component generated
manifest, a browser-rendered WCAG contrast checker, and a pure static-usage checker. None of it
renders anything or reaches the network—every input (token objects, file contents, the manifest
itself) is passed in by the caller. This is the one shared layer a CLI command, an MCP tool, and the
`@caisson-sh/ui` build-time generator import without duplicating contracts.

See `AGENTS.md` for the public API and invariants.

Licensed Apache-2.0 (open Base substrate).
