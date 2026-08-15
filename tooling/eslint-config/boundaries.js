/**
 * Import-boundary rules (ADR-0022, Gate 2) — the FAST STATIC layer. The provider-SDK boundary
 * (ADR-0011): only `ai-config` + `ai-kit` may import a provider SDK directly; everything else
 * routes inference through `ai-config`. Foundations' base strict config spreads this array (index.js).
 *
 * LIMITS (why this is a backstop, not the whole gate, per ADR-0022): `no-restricted-imports` is
 * STATIC-ONLY — it does not catch `await import("openai")`, `require("openai")`, transitive deps,
 * or published .js that is never linted. A denylist of provider SDKs is also unwinnable by
 * construction (new SDKs ship constantly). dependency-cruiser (real module graph, dynamic +
 * transitive reachability) is the authoritative provider-SDK layer; this catches the obvious case
 * fast, in-editor.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The SDK denylist lives in the shared boundary-policy data file (consolidation C24 — one data
// source, three enforcement engines). Re-exported here so consumers keep their existing import.
const boundaryPolicy = createRequire(import.meta.url)("./boundary-policy.cjs");

/** Prohibited provider SDKs. Keep current — a stale denylist is a hole (ADR-0022). */
export const PROVIDER_SDKS = boundaryPolicy.PROVIDER_SDKS;

const restrictedPatterns = PROVIDER_SDKS.map((name) => ({
  group: [name, `${name}/*`],
  message:
    "Provider SDKs may only be imported by @caisson/ai-config and @caisson/ai-kit (ADR-0011). Route inference through @caisson/ai-config. (dependency-cruiser backstops dynamic/transitive imports.)",
}));

/** Packages exempt from the provider-SDK ban (the AI config seam itself). */
const PROVIDER_EXEMPT = ["packages/ai-config/**", "packages/ai-kit/**"];

// Repo root, computed from THIS file's location (tooling/eslint-config/boundaries.js → ../../).
// PROVIDER_EXEMPT globs are repo-root-relative, but `eslint src` runs per-package with cwd inside
// the package (turbo / `bun run check` / CI) — there basePath is the package dir, so a repo-root
// glob never matches and the exemption silently dies (root `eslint .` masks it). Pinning the
// exempt block's basePath to the real repo root makes the same three globs match identically from
// both the repo-root cwd and any per-package cwd. SCOPE stays exactly ai-config|ai-kit.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import("eslint").Linter.Config[]} */
export const boundaries = [
  {
    name: "stack/provider-sdk-boundary",
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: restrictedPatterns }],
    },
  },
  {
    name: "stack/provider-sdk-boundary-exempt",
    basePath: REPO_ROOT,
    files: PROVIDER_EXEMPT,
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default boundaries;
