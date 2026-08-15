---
"@caisson/site": patch
"@caisson/ui": patch
"@caisson/registry": patch
---

Routine non-major dependency refresh. `better-auth` and its Kysely adapter move
`1.6.25` to `1.6.26` in the site; Storybook `10.5.0` to `10.5.6` and Vite `8.1.4`
to `8.2.0` in the UI kit; `wrangler` `4.106.0` to `4.119.0` in the registry
worker. Everything but the better-auth pair is a devDependency. No API or
behaviour change in any of the three packages.
