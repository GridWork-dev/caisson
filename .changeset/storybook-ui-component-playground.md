---
"@caisson/ui": patch
---

Add a Storybook 10.5 component playground for the kit (`.storybook/`, `vitest.config.ts`, one `*.stories.tsx` per component covering all 39 exported primitives). Wires `@storybook/addon-a11y` + `@storybook/addon-vitest` for browser-mode axe accessibility checks per story (`bun run test:storybook`) and `@storybook/addon-mcp` for agent-facing component documentation and story-preview tooling (`bun run storybook`). Dev-only tooling — no production runtime code changed.
