/**
 * Mirror root ESLint flat config — wires the shared standards config so `bunx eslint .` loads the
 * import boundaries + anti-slop rules inside the public mirror too. Copied verbatim into the
 * mirror by export-public-mirror.ts (same mechanism as README/CONTRIBUTING); imports from the
 * renamed @caisson-sh/eslint-config package that ships in the mirror as build-support tooling.
 *
 * See ci.yml for what standards-gate/registry-index/oscal-conformance intentionally do NOT re-run
 * here (they need commercial content or the private registry ledger, neither of which ships).
 */
import config from "@caisson-sh/eslint-config";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/*.d.ts",
      // Deliberate negative-test fixtures (tooling/eslint-config/__fixtures__/boundaries/*) exist
      // to VIOLATE the rules they test — excluded here same as the source repo's root config.
      "**/__fixtures__/**",
    ],
  },
  ...config,
];
