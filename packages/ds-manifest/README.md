# @caisson/ds-manifest

Shared data + analysis layer for a design-system kit's agent-facing surface.

- **Layer:** base

A component-manifest schema plus three small, dependency-light pieces built on top of it: a typed
reader for the committed manifest JSON, a pure WCAG contrast checker, and (once the usage-doctor
lands) a pure static-usage checker. None of it renders anything or reaches the network — every
input (token objects, file contents, the manifest itself) is passed in by the caller. This is the
one shared layer a CLI command, an MCP tool, and a build-time generator can all import without
depending on each other.

See `AGENTS.md` for the public API and invariants.

Licensed Apache-2.0 (open Base substrate).
