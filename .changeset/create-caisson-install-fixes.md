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

Fixes a second real-install bug in the same generated project: the `.npmrc` file that wires up
module installation and your license key was silently missing from every generated project once
the CLI was installed from a real package (package registries never ship a file literally named
`.npmrc`). The generator now writes it correctly every time.

`--help` now names the correct license-token environment variable, `CAISSON_LICENSE_TOKEN`
(it previously named the wrong one).

The `create-caisson` documentation page no longer describes a lockfile or a result type the
generator does not produce — it now matches what the tool actually writes and returns.
