# @caisson/ui — agent usage note

Provides the typed OKLCH token floor: palette and type-scale token objects that generate `tokens.css` (ADR-0042 design foundation, expanded by ADR-0078).

## Key surface

- Import tokens from `@caisson/ui/tokens`; the generated `tokens.css` is at `@caisson/ui/styles/tokens.css`.
- Tokens are typed TypeScript objects — use them in code; do not hardcode hex/OKLCH values inline.
- Regenerate `tokens.css` via `bun run gen:tokens` after any token-object change.
- The token contract is the stable surface; internal OKLCH values may change between releases.

## Scope

Design token primitives only (palette, type scale, spacing). Component implementations and framework-specific bindings are out of scope for this package.
