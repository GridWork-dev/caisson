# @caisson/ui — agent usage note

Provides the typed OKLCH token floor: palette and type-scale token objects that generate `tokens.css` (ADR-0042 design foundation, expanded by ADR-0078).

## Key surface

- Import tokens from `@caisson/ui/tokens`; the generated `tokens.css` is at `@caisson/ui/styles/tokens.css`.
- Tokens are typed TypeScript objects — use them in code; do not hardcode hex/OKLCH values inline.
- Regenerate `tokens.css` via `bun run gen:tokens` after any token-object change.
- The token contract is the stable surface; internal OKLCH values may change between releases.

## Scope

Design tokens (palette, type scale, spacing) and the component library built on them — see RECIPE.md for the component-authoring rules. Framework-specific bindings (e.g. a framework-router wrapper) are out of scope; components are framework-agnostic raw `.tsx`.
