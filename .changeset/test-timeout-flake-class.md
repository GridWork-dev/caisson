---
---

No package release: this pass raises the bun test timeout on every package test script and widens a
React settle helper's flush bound. Only `scripts.test` and test files change, so no published
artifact moves.

Bun's 5s default was under 5x the idle cost of real work in this repo, so three suites failed only
under full-graph load while passing standalone. A PGlite instance costs 0.8-1.6s to boot and grows
within a process when instances are held rather than closed; the design-system manifest generator
takes about 4s for one pass and the determinism test runs two. The bound lives on each package's
test script because bun does not read the root bunfig from a package's working directory and there
is no environment-variable equivalent.
