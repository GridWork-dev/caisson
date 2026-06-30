// An eslint-CLI-driven NEGATIVE test for the provider-SDK import boundary (ADR-0011/0022,
// boundaries.js). Until now "a base package importing @ai-sdk/* must fail" was asserted only by a
// code COMMENT at the top of boundaries.js — nothing actually RAN the rule. This spawns the real
// `eslint` binary against the package's real composed config (index.js, which spreads `boundaries`)
// and asserts on its JSON report:
//   - a base-package-shaped fixture importing a provider SDK is FLAGGED by `no-restricted-imports`;
//   - the gateway carve-out (ai-kit's own real provider transport, `PROVIDER_EXEMPT`) is NOT flagged.
//
// `cwd` is pinned to REPO_ROOT for every invocation: boundaries.js's `PROVIDER_EXEMPT` globs are
// repo-root-relative via an explicit `basePath`, but the OTHER (non-exempt) config entry has no
// `basePath` and so defaults to eslint's own cwd — running this file's `bun test` from inside
// `tooling/eslint-config` (the turbo/per-package default) would otherwise put any file outside this
// package "outside of base path" and silently skip it (verified empirically; see boundaries.js's own
// comment on this exact cwd trap).
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const ESLINT_BIN = resolve(HERE, "node_modules/.bin/eslint");
const CONFIG = resolve(HERE, "index.js");

interface EslintMessage {
  readonly ruleId: string | null;
}
interface EslintFileResult {
  readonly filePath: string;
  readonly messages: readonly EslintMessage[];
}

/**
 * Lint one real file with the package's actual composed config (`index.js`) via the real `eslint`
 * binary — `execFileSync` with an argument array (no shell), per the security floor. ESLint exits
 * 1 when it finds lint errors; the JSON report still lands on stdout either way, so the assertion
 * reads the report, never the exit code.
 */
function lintBoundary(filePath: string): readonly string[] {
  let stdout: string;
  try {
    stdout = execFileSync(
      ESLINT_BIN,
      ["--config", CONFIG, "--no-config-lookup", "--format", "json", filePath],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
  } catch (err) {
    const failure = err as { stdout?: string };
    stdout = failure.stdout ?? "";
  }
  const results = JSON.parse(stdout) as EslintFileResult[];
  const result = results[0];
  if (result === undefined) {
    throw new Error(`eslint produced no report for ${filePath}`);
  }
  return result.messages
    .map((m) => m.ruleId)
    .filter((id): id is string => id !== null);
}

describe("provider-SDK import boundary (ADR-0011/0022) — eslint-driven", () => {
  test("a base-package @ai-sdk/* import is flagged by no-restricted-imports", () => {
    const fixture = resolve(
      HERE,
      "__fixtures__/boundaries/base-package-violation.ts",
    );
    const ruleIds = lintBoundary(fixture);
    expect(ruleIds).toContain("no-restricted-imports");
  });

  test("the ai-kit gateway carve-out (PROVIDER_EXEMPT) is not flagged", () => {
    // The gateway's own real provider transport — exactly the file the carve-out exists to allow
    // (ADR-0059). Linting the real source, not a synthetic stand-in, proves the exemption actually
    // applies to the package it is scoped to.
    const exempt = resolve(REPO_ROOT, "packages/ai-kit/src/providers.ts");
    const ruleIds = lintBoundary(exempt);
    expect(ruleIds).not.toContain("no-restricted-imports");
  });
});
