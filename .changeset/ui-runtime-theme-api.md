---
"@caisson/ui": minor
---

Adds a runtime theme API: `createTheme`/`applyTheme` plus a preset registry
(`registerPreset`/`getPreset`/`listPresets`), available from `@caisson/ui/theme`. Three
built-in presets ship out of the box — `caisson` (the default), `pressure`, and
`bulkhead` — and buyers can layer their own token overrides on top of any of them or
register a fully custom preset. `applyTheme` swaps the live theme in the browser by
upserting a `<style>` tag; `createTheme`/`themeToCssVars`/`themeToCssText` are pure and
safe to call during server-side rendering.
