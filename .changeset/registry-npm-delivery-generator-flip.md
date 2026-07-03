---
"@caisson/cli": patch
---

Flip the generator's buyer-repo `.npmrc`: `@caisson:registry` now points at
`https://registry.caisson.sh` with `//registry.caisson.sh/:_authToken=${CAISSON_LICENSE_TOKEN}`
(npm's own env interpolation at install time -- no token is ever committed), replacing the
retired `npm.pkg.github.com` GitHub Packages channel. Updates both the live `templatesEngine`
template (`templates/base/.npmrc` + `README.md`) and the legacy `defaultEngine` literal in
`generate.ts` for parity, with golden fixtures re-blessed to match.
