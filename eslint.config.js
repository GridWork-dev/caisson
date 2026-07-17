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
      // Same class: the Semgrep floor-rule fixtures (tools/security/semgrep-rules/*.ts|py) exist to
      // TRIP their rules — deliberate console.log / unused args / insecure compares — so eslint on the
      // repo-wide `bunx eslint .` must skip them (they are exercised only by `semgrep test`).
      "tools/security/semgrep-rules/**",
      // Vendored third-party detector (the impeccable anti-slop catalog, ADR-0334 quality leg) —
      // not house code; exercised via apps/site/scripts/anti-slop.ts, never linted to our standards.
      "apps/site/scripts/anti-slop/detector/**",
      // Public-mirror asset TEMPLATES copied verbatim into the caisson-oss mirror by
      // scripts/export-public-mirror.ts. mirror-assets/eslint.config.js imports the mirror-only
      // @caisson-sh/eslint-config; ESLint 10's per-file config lookup would load it during a repo-root
      // `bunx eslint .` and crash (package absent in the private repo). The mirror's own CI
      // (mirror-assets/ci.yml) lints these there — never here.
      "scripts/mirror-assets/**",
    ],
  },
  ...config,
];
