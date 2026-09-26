# @caisson-sh/registry-schema

The open, dependency-light contract for a module registry: the shape of a module manifest, the
shape of the built catalog index, and pure helpers for checking a module id and version against it.
Zod validation and filesystem reads only — no network, no database, no credentials.

- **Layer:** base

## What it gives you

- **A module manifest schema.** `defineModule` validates and defaults a module's declaration — id,
  version, license (from a curated SPDX allowlist), dependencies, description, and stability. The
  schema is strict: an unknown field is rejected at build time.
- **A registry index schema.** `loadRegistryIndex` / `loadRegistryIndexFromFile` parse the built
  catalog — every module, every published version, and the manifest + provenance record for each.
  `moduleAllowlist` projects it down to the flat set of known module ids; `assertKnownModule` /
  `assertKnownVersion` throw on anything not in the catalog.
- **A closed feature-tag registry.** `FeatureTagSchema` / `assertRegisteredFeatureTag` validate that
  a metered action's tag is one that's actually been registered, so a typo can't silently mint a new
  metered action.

## Usage

```ts
import {
  assertKnownVersion,
  defineModule,
  loadRegistryIndexFromFile,
} from "@caisson-sh/registry-schema";

const manifest = defineModule({
  id: "@caisson-sh/example",
  version: "1.0.0",
  license: "Apache-2.0",
  description: "An example module.",
});

const index = loadRegistryIndexFromFile("registry/index.json");
assertKnownVersion(index, "@caisson-sh/kernel", "0.5.0");
```

## Test

```sh
bun test packages/registry-schema/src
```
