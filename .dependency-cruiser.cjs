/**
 * dependency-cruiser — the GRAPH layer of the boundary gate (ADR-0022). Complements, not
 * duplicates, the other two layers:
 *   - ESLint `no-restricted-imports` (tooling/eslint-config/boundaries.js) = fast static signal.
 *   - @caisson/standards-gate (Bun) = the SPDX/license authority (AGPL boundary, manifest agreement,
 *     edition↔edition) — graph tools read SPDX poorly.
 *   - THIS = the real module graph: catches dynamic `import()` + `require()` + TRANSITIVE reach
 *     that static ESLint misses, and the base→edition direction.
 *
 * Run in CI (ADR-0016/0022): `bunx depcruise packages apps tooling --config .dependency-cruiser.cjs`.
 * NOTE: dependency-cruiser cannot key on a package's SPDX `license`, so AGPL-by-license stays the
 * Bun gate's job; here we cover provider-SDK reachability + composition direction + cycles.
 */

const PROVIDER_SDK_RE =
  "node_modules/(openai|@azure/openai|@anthropic-ai/(sdk|bedrock|vertex-sdk)|@google/(genai|generative-ai)|@aws-sdk/client-bedrock-runtime|@mistralai/mistralai|cohere-ai|groq-sdk|replicate|together-ai|ollama)";

const BASE_PKGS =
  "packages/(auth|tenancy-rls|billing|credits|ai-config|mcp-server|ui|jobs|email|kernel|audit-worm|field-crypto|cli)";
const EDITIONS = ["compliance", "ai-kit", "local-ai", "agent-dev"];
const EDITION_PKGS = `packages/(${EDITIONS.join("|")})`;

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
        "Only @caisson/ai-config + @caisson/ai-kit may reach a provider SDK (ADR-0011) — incl. dynamic/transitive.",
      severity: "error",
      from: { pathNot: "packages/(ai-config|ai-kit)|apps/ai-kit" },
      to: { path: PROVIDER_SDK_RE },
    },
    {
      name: "down-only-no-base-to-edition",
      comment:
        "A base/primitive package may not depend on an edition (ADR-0003).",
      severity: "error",
      from: { path: BASE_PKGS },
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
    doNotFollow: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
