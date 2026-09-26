# @caisson-sh/ui — agent usage note

Provides the typed OKLCH token floor: palette and type-scale token objects that generate `tokens.css` (the design foundation, later expanded).

## Key surface

- Import tokens from `@caisson-sh/ui/tokens`; the generated `tokens.css` is at `@caisson-sh/ui/styles/tokens.css`.
- Tokens are typed TypeScript objects — use them in code; do not hardcode hex/OKLCH values inline.
- Regenerate `tokens.css` via `bun run gen:tokens` after any token-object change.
- Regenerate the agent-readable component manifest via `bun run gen:manifest` after a component
  barrel, prop, JSDoc, or co-located CSS change; `bun run check:manifest` must remain byte-clean.
- The token contract is the stable surface; internal OKLCH values may change between releases.

## Scope

Design tokens (palette, type scale, spacing) and the component library built on them — see RECIPE.md for the component-authoring rules. Framework-specific bindings (e.g. a framework-router wrapper) are out of scope; components are framework-agnostic raw `.tsx`.
