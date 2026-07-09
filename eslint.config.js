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
      "**/out/**",
      "**/.source/**",
      "**/coverage/**",
      // Local-only Python artifacts (services/support-bot dev venv) — git-ignored, but eslint
      // does not read .gitignore, so a local `bunx eslint .` fails on vendored JS without this.
      "**/.venv/**",
      "**/.pytest_cache/**",
      "**/*.d.ts",
      "outputs/**",
      "infra/**",
      "**/*.cjs",
      // Deliberate negative-test fixtures (e.g. tooling/eslint-config/__fixtures__/boundaries/
      // base-package-violation.ts) are meant to violate the rules they exist to test — they are
      // exercised by boundaries.test.ts, which invokes eslint directly against
      // tooling/eslint-config/index.js (NOT this root config), so excluding them here only keeps
      // the repo-wide `bunx eslint .` gate from flagging them; the meta-test is unaffected.
      "**/__fixtures__/**",
    ],
  },
  ...config,
];
