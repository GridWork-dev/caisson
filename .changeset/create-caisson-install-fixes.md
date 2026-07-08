---
"@caisson/cli": patch
"@caisson/site": patch
---

`create-caisson` now accepts the advertised quickstart form `create-caisson my-app` — a bare
project name with no `--name` flag — matching every install command shown in the docs and the
site. An explicit `--name` still wins if both are given.

Fixes a real-install bug where the generator could not find its module registry once installed
from npm outside this monorepo: the registry snapshot is now bundled into the published package,
so a fresh `bunx create-caisson` install resolves it correctly instead of failing.

`--help` now names the correct license-token environment variable, `CAISSON_LICENSE_TOKEN`
(it previously named the wrong one).

The `create-caisson` documentation page no longer describes a lockfile or a result type the
generator does not produce — it now matches what the tool actually writes and returns.
