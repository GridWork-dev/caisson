// Completeness/parity pins for the one boundary-policy data source (consolidation C24). The
// enforcement engines stay separate; this test is what makes their shared data drift-proof —
// the exact class it closes: dependency-cruiser hand-mirrors that named a deleted package and
// silently omitted real composition roots (a false-green on base→composition reach).
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const req = createRequire(import.meta.url);
const policy = req("@caisson-sh/lint-policy/boundary-policy.cjs") as {
  PROVIDER_SDKS: readonly string[];
  PROVIDER_SDK_RE: string;
  BUNDLE_META_DIRS: readonly string[];
};
const REPO_ROOT = join(import.meta.dir, "../../..");

describe("boundary-policy parity (C24)", () => {
  test("every policy dir exists on disk as packages/<dir> with the matching @caisson-sh name", () => {
    expect(policy.BUNDLE_META_DIRS.length).toBeGreaterThan(0);
    for (const dir of policy.BUNDLE_META_DIRS) {
      const manifestPath = join(REPO_ROOT, "packages", dir, "package.json");
      expect(existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
      };
      expect(manifest.name).toBe(`@caisson-sh/${dir}`);
    }
  });

  test("the provider regex matches every denylisted SDK and no lookalike sibling", () => {
    const re = new RegExp(policy.PROVIDER_SDK_RE);
    for (const name of policy.PROVIDER_SDKS) {
      const probe =
        name === "ai"
          ? "node_modules/ai/dist/index.js"
          : `node_modules/${name}/dist/index.js`;
      expect(re.test(probe)).toBe(true);
    }
    // The two known lookalikes the `ai/` anchoring exists for, plus an ordinary dep.
    expect(re.test("node_modules/airtable/lib/index.js")).toBe(false);
    expect(re.test("node_modules/ai-tools/lib/index.js")).toBe(false);
    expect(re.test("node_modules/zod/lib/index.js")).toBe(false);
  });

  test("the cruiser config derives from the policy: isolation rule per dir + down-only covers all dirs", () => {
    const cruiser = req(join(REPO_ROOT, ".dependency-cruiser.cjs")) as {
      forbidden: Array<{ name: string; to?: { path?: string } }>;
    };
    const names = cruiser.forbidden.map((r) => r.name);
    for (const dir of policy.BUNDLE_META_DIRS) {
      expect(names).toContain(`no-edition-cross-${dir}`);
    }
    const downOnly = cruiser.forbidden.find(
      (r) => r.name === "down-only-no-base-to-edition",
    ) as
      | { from?: { path?: string; pathNot?: string }; to?: { path?: string } }
      | undefined;
    expect(downOnly).toBeDefined();
    for (const dir of policy.BUNDLE_META_DIRS) {
      expect(downOnly?.to?.path ?? "").toContain(dir);
      // Coverage is derived, not hand-listed: from = every packages/* dir EXCEPT the bundles.
      expect(downOnly?.from?.pathNot ?? "").toContain(dir);
    }
    expect(downOnly?.from?.path).toBe("^packages/");
    // The trailing-slash boundary keeps `compliance` from matching `compliance-core`.
    expect((downOnly?.to?.path ?? "").endsWith(")/")).toBe(true);
    const providerRule = cruiser.forbidden.find(
      (r) => r.name === "no-provider-sdk-outside-ai",
    );
    expect(providerRule?.to?.path).toBe(policy.PROVIDER_SDK_RE);
  });

  test("the oxlint config derives from the policy: one no-restricted-imports group per SDK", () => {
    // The THIRD engine (ADR-0408 replaced ESLint with oxlint here). `.oxlintrc.json` is JSONC and
    // cannot `require` the policy, so this is the same parity-pin mechanism the cruiser arm above
    // uses: a stale denylist in the linter is a hole, and only a test can see it.
    const oxlintrc = readJsonc(join(REPO_ROOT, ".oxlintrc.json")) as {
      rules: Record<string, unknown>;
    };
    const rule = oxlintrc.rules["eslint/no-restricted-imports"] as [
      string,
      { patterns: Array<{ group: string[] }> },
    ];
    expect(rule[0]).toBe("error");
    const group = rule[1].patterns[0]?.group ?? [];
    // Each SDK contributes its bare name plus the `/*` subpath form, exactly as boundaries.js did.
    const expected = policy.PROVIDER_SDKS.flatMap((n) => [n, `${n}/*`]);
    expect([...group].sort()).toEqual([...expected].sort());
  });
});

describe("lint canary config parity (ADR-0408)", () => {
  // The canary runs against its OWN config because `ignorePatterns` accumulate down an `extends`
  // chain and so cannot be lifted to reach the deliberately-violating fixtures. That duplication
  // is the drift risk this closes: a plugin renamed or a rule disabled in the root config must not
  // leave a canary quietly passing against a stale copy of itself.
  const root = readJsonc(join(REPO_ROOT, ".oxlintrc.json")) as OxlintConfig;
  const canary = readJsonc(
    join(REPO_ROOT, "tooling/lint-policy/canary.oxlintrc.json"),
  ) as OxlintConfig;

  const jsPluginNames = (c: OxlintConfig): string[] =>
    (c.overrides ?? [])
      .flatMap((o) => o.jsPlugins ?? [])
      .map((p) => (typeof p === "string" ? p : p.name))
      .sort();

  test("both configs load the same set of JS plugins", () => {
    expect(jsPluginNames(canary)).toEqual(jsPluginNames(root));
  });

  test("every rule the canary asserts is also enabled in the root config", () => {
    // Collect EVERY severity a rule id carries anywhere in the config, not a last-write-wins
    // flatten: a rule can be "error" at the top level and scoped "off" in one override (which is
    // exactly what no-restricted-imports does for the ai-config/ai-kit seam). Flattening reads
    // that as globally disabled and fails on a correct config.
    const severities = new Map<string, string[]>();
    const record = (id: string, sev: unknown) =>
      severities.set(id, [...(severities.get(id) ?? []), severityOf(sev)]);
    for (const [id, sev] of Object.entries(root.rules ?? {})) record(id, sev);
    for (const o of root.overrides ?? [])
      for (const [id, sev] of Object.entries(o.rules ?? {})) record(id, sev);

    const canaryRuleIds = new Set<string>();
    for (const [id] of Object.entries(canary.rules ?? {}))
      canaryRuleIds.add(id);
    for (const o of canary.overrides ?? [])
      for (const [id, sev] of Object.entries(o.rules ?? {}))
        if (severityOf(sev) !== "off") canaryRuleIds.add(id);

    expect(canaryRuleIds.size).toBeGreaterThan(0);
    for (const id of canaryRuleIds) {
      const seen = severities.get(id) ?? [];
      expect(seen.length).toBeGreaterThan(0);
      // Enabled SOMEWHERE is the property: a canary lane cannot assert a rule the root turned off
      // everywhere, but a narrowly scoped exemption is legitimate.
      expect(seen.some((s) => s !== "off")).toBe(true);
    }
  });
});

type OxlintConfig = {
  rules?: Record<string, unknown>;
  overrides?: Array<{
    rules?: Record<string, unknown>;
    jsPlugins?: Array<string | { name: string; specifier: string }>;
  }>;
};

/** oxlint config files are JSONC — strip line comments before parsing. */
function readJsonc(path: string): unknown {
  const raw = readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(raw);
}

function severityOf(value: unknown): string {
  return Array.isArray(value) ? String(value[0]) : String(value);
}
