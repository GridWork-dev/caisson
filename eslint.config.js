/**
 * Root ESLint flat config — wires the shared standards config so `bunx eslint .` actually loads
 * the import boundaries (ADR-0022 Layer 2). Without this file the boundary rules never load.
 * Foundations' strict base flows in via `@caisson/eslint-config`'s own MERGE POINT (ADR-0002).
 */
import config from "@caisson/eslint-config";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.d.ts",
      "outputs/**",
      "infra/**",
      "**/*.cjs",
    ],
  },
  ...config,
];
