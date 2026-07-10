# @caisson/registry-schema

The open, dependency-light contract for a module registry: the shape of a module manifest, the
shape of the built catalog index, and pure helpers for turning a purchase into the set of module
ids it entitles. Zod validation and filesystem reads only — no network, no database, no
credentials.

- **Layer:** base

## What it gives you

- **A module manifest schema.** `defineModule` validates and defaults a module's declaration — id,
  version, kind (`base` / `primitive` / `app-template` / `bundle` — `bundle` is the current
  aggregate kind; `edition` is a legacy/back-compat kind kept for historical entries), license,
  price, dependencies, and (for a bundle, or legacy edition) its frozen member-version pin map.
  Invalid combinations reject at build time: an open-source module can't carry a price, a paid
  module must carry one, and a bundle (or edition) must declare which modules it composes.
- **A registry index schema.** `loadRegistryIndex` / `loadRegistryIndexFromFile` parse the built
  catalog — every module, every published version, and the manifest + provenance record for each.
  `moduleAllowlist` projects it down to the flat set of known module ids; `assertKnownModule` /
  `assertKnownVersion` throw on anything not in the catalog.
- **Entitlement expansion.** A registry sells modules three ways at once — a whole edition, a
  bundle of everything, or a module bought individually. `expandEntitlements` (and the
  file-reading convenience `expandEntitlementsFromFile`) turns a list of purchased ids into the flat
  set of module ids that purchase actually grants, resolved against the index's real membership —
  never a hand-maintained list that can drift out of sync with what's actually published.
- **A closed feature-tag registry.** `FeatureTagSchema` / `assertRegisteredFeatureTag` validate that
  a metered action's tag is one that's actually been registered, so a typo can't silently mint a new
  billable action.

## Usage

```ts
import {
  defineModule,
  loadRegistryIndexFromFile,
  expandEntitlements,
} from "@caisson/registry-schema";

const manifest = defineModule({
  id: "@caisson/example",
  version: "1.0.0",
  kind: "base",
  tier: "oss",
  license: "Apache-2.0",
  description: "An example module.",
});

const index = loadRegistryIndexFromFile("registry/index.json");
const grantedModuleIds = expandEntitlements(index, ["everything"]);
```

## Test

```sh
bun test packages/registry-schema/src
```
