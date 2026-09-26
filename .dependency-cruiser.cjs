/**
 * dependency-cruiser — the GRAPH layer of the boundary gate (ADR-0022). Complements, not
 * duplicates, the other two layers:
 *   - ESLint `no-restricted-imports` (tooling/eslint-config/boundaries.js) = fast static signal.
 *   - @caisson-sh/standards-gate (Bun) = the SPDX/license authority (AGPL boundary, manifest agreement)
 *     — graph tools read SPDX poorly.
 *   - THIS = the real module graph: catches dynamic `import()` + `require()` + TRANSITIVE reach
 *     that static ESLint misses, and the base→edition direction.
 *
 * Run in CI (ADR-0016/0022): `bunx depcruise packages apps tooling --config .dependency-cruiser.cjs`.
 * NOTE: dependency-cruiser cannot key on a package's SPDX `license`, so AGPL-by-license stays the
 * Bun gate's job; here we cover provider-SDK reachability + composition direction + cycles.
 */

// One boundary-policy data source (consolidation C24): the provider denylist regex and the
// bundle/edition meta-package dir list come from tooling/lint-policy/boundary-policy.cjs —
// this stays the authoritative dynamic/transitive graph layer (ADR-0022 Gate 2), it just no
// longer hand-mirrors the data. (The previous hand-copy had drifted: it still named the deleted
// `local-ai` and missed the five ADR-0257 bundle roots entirely — a live false-green class.)
const {
  PROVIDER_SDK_RE,
  BUNDLE_META_DIRS,
} = require("./tooling/lint-policy/boundary-policy.cjs");

const EDITIONS = BUNDLE_META_DIRS;
// Trailing slash is load-bearing: without it `packages/compliance` also matches
// `packages/compliance-core` (a commercial MODULE, not a bundle) and the rules misfire.
const EDITION_PKGS = `packages/(${EDITIONS.join("|")})/`;

// One rule per edition forbidding the OTHER editions from importing it (catches dynamic/transitive
// edition→edition the Bun gate's static-dep check misses). Per-edition phrasing avoids a self-match
// false positive (a file in an edition importing its own sibling files).
const editionIsolation = EDITIONS.map((e) => ({
  name: `no-edition-cross-${e}`,
  comment: `Edition ${e} must not be imported by another edition — editions compose base, not peers (ADR-0003).`,
  severity: "error",
  from: { path: `packages/(${EDITIONS.filter((o) => o !== e).join("|")})/` },
  to: { path: `packages/${e}/` },
}));

/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-provider-sdk-outside-ai",
      comment:
        "Only @caisson-sh/ai-config + @caisson-sh/ai-kit may reach a provider SDK (ADR-0011) — incl. dynamic/transitive.",
      severity: "error",
      from: { pathNot: "packages/(ai-config|ai-kit)" },
      to: { path: PROVIDER_SDK_RE },
    },
    {
      name: "down-only-no-base-to-edition",
      comment:
        "No non-bundle package may depend on a bundle/edition meta-package (ADR-0003). Coverage " +
        "is every packages/* dir EXCEPT the bundles themselves, so a NEW package is guarded by " +
        "default — the former hand-list of 25 base dirs silently omitted 26 packages from this rule.",
      severity: "error",
      from: { path: "^packages/", pathNot: EDITION_PKGS },
      to: { path: EDITION_PKGS },
    },
    ...editionIsolation,
    {
      name: "no-circular",
      comment: "Circular dependency — breaks composition + build ordering.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    // Record the edge into node_modules (so the provider-SDK `to` rule still matches) but never
    // recurse INTO it — following the full npm tree OOM-crashes the cruiser. Skip build output too.
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: ["npm-no-pkg", "npm-unknown"],
    },
    exclude: { path: "(^|/)(\\.next|dist|\\.turbo|coverage)(/|$)" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
