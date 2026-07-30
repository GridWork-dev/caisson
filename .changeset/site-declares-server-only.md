---
"@caisson/site": patch
---

The site now declares `server-only` as a dependency instead of relying on the framework to
substitute it at build time. The demo preview module imports it as a guard that fails the build if
that server module is ever pulled into a browser bundle, but the package was in no manifest and on
no lockfile — it resolved solely through an internal build alias. The guard therefore worked only
inside a full framework build and would have failed to resolve anywhere else, including a plain
test run. Nothing about the guard's behavior changes; it is now backed by a real installed package.
