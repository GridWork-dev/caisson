// An eslint-CLI-driven NEGATIVE test for the provider-SDK import boundary (ADR-0011/0022,
// boundaries.js). Until now "a base package importing @ai-sdk/* must fail" was asserted only by a
// code COMMENT at the top of boundaries.js — nothing actually RAN the rule. This runs the real
// ESLint engine against the package's real composed config (index.js, which spreads `boundaries`)
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
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { ESLint } from "eslint";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const CONFIG = resolve(HERE, "index.js");

/**
 * Lint one real file with the package's actual composed config (`index.js`) through ESLint's Node
 * API. Keeping the engine in-process avoids spawning another ESLint binary while Turbo is already
 * running every workspace lint task concurrently.
 */
async function lintBoundary(filePath: string): Promise<readonly string[]> {
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: CONFIG,
  });
  const results = await eslint.lintFiles([filePath]);
  const result = results[0];
  if (result === undefined) {
    throw new Error(`eslint produced no report for ${filePath}`);
  }
  return result.messages
    .map((m) => m.ruleId)
    .filter((id): id is string => id !== null);
}

describe("provider-SDK import boundary (ADR-0011/0022) — eslint-driven", () => {
  test("a base-package @ai-sdk/* import is flagged by no-restricted-imports", async () => {
    const fixture = resolve(
      HERE,
      "__fixtures__/boundaries/base-package-violation.ts",
    );
    const ruleIds = await lintBoundary(fixture);
    expect(ruleIds).toContain("no-restricted-imports");
  });

  test("the ai-kit gateway carve-out (PROVIDER_EXEMPT) is not flagged", async () => {
    // The gateway's own real provider transport — exactly the file the carve-out exists to allow
    // (ADR-0059). Linting the real source, not a synthetic stand-in, proves the exemption actually
    // applies to the package it is scoped to.
    const exempt = resolve(REPO_ROOT, "packages/ai-kit/src/providers.ts");
    const ruleIds = await lintBoundary(exempt);
    expect(ruleIds).not.toContain("no-restricted-imports");
  });
});
