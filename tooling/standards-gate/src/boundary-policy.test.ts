// Completeness/parity pins for the one boundary-policy data source (consolidation C24). The three
// enforcement engines stay separate; this test is what makes their shared data drift-proof —
// the exact class it closes: dependency-cruiser hand-mirrors that named the deleted `local-ai`
// and silently omitted the five ADR-0257 bundle roots (a false-green on base→bundle reach).
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { BUNDLE_IDS } from "@caisson/registry-schema";
import { EDITION_NAMES } from "./checks.ts";

const req = createRequire(import.meta.url);
const policy = req("../../eslint-config/boundary-policy.cjs") as {
  PROVIDER_SDKS: readonly string[];
  PROVIDER_SDK_RE: string;
  BUNDLE_META_DIRS: readonly string[];
  BUNDLE_META_NAMES: readonly string[];
};
const REPO_ROOT = join(import.meta.dir, "../../..");

describe("boundary-policy parity (C24)", () => {
  test("standards-gate EDITION_NAMES is exactly the policy's BUNDLE_META_NAMES", () => {
    expect([...EDITION_NAMES].sort()).toEqual(
      [...policy.BUNDLE_META_NAMES].sort(),
    );
  });

  test("every canonical bundle id (registry-schema) has a policy dir AND name row", () => {
    for (const id of BUNDLE_IDS) {
      expect(policy.BUNDLE_META_DIRS).toContain(id);
      expect(policy.BUNDLE_META_NAMES).toContain(`@caisson/${id}`);
    }
  });

  test("every policy dir exists on disk as packages/<dir> with the matching @caisson name", () => {
    for (const dir of policy.BUNDLE_META_DIRS) {
      const manifestPath = join(REPO_ROOT, "packages", dir, "package.json");
      expect(existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
      };
      expect(manifest.name).toBe(`@caisson/${dir}`);
    }
  });

  test("every disk meta-package whose name is a policy NAME row has its dir listed (completeness)", () => {
    // The inverse direction: a bundle meta-package present on disk but missing from
    // BUNDLE_META_DIRS would silently escape the graph layer's isolation + down-only rules.
    for (const name of policy.BUNDLE_META_NAMES) {
      const dir = name.slice("@caisson/".length);
      const onDisk = existsSync(
        join(REPO_ROOT, "packages", dir, "package.json"),
      );
      if (onDisk) expect(policy.BUNDLE_META_DIRS).toContain(dir);
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
    );
    expect(downOnly).toBeDefined();
    for (const dir of policy.BUNDLE_META_DIRS) {
      expect(downOnly?.to?.path ?? "").toContain(dir);
    }
    const providerRule = cruiser.forbidden.find(
      (r) => r.name === "no-provider-sdk-outside-ai",
    );
    expect(providerRule?.to?.path).toBe(policy.PROVIDER_SDK_RE);
  });
});
