import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { deriveDomains, domainForPath, domainIds } from "./domains.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

describe("deriveDomains — the mechanical tree partition (ADR-0233, Fork A)", () => {
  const domains = deriveDomains(REPO_ROOT);

  test("derives one domain per tree unit — no hand-typed list, ≈65 domains", () => {
    // Replaces the v1 hard-coded 24-id `toEqual`. The count is derived from the tree, so it moves as
    // packages are added; the coverage gate (not a literal list) is what proves completeness.
    expect(domains.length).toBeGreaterThanOrEqual(60);
  });

  test("every packages/* dir is a domain (one each)", () => {
    const pkgDomains = domains.filter((d) => d.id.startsWith("packages/"));
    // The exact count is tree-derived; generator-templates is a separate id, not a packages/* dir.
    expect(pkgDomains.length).toBeGreaterThanOrEqual(30);
    expect(domainIds(REPO_ROOT).has("packages/kernel")).toBe(true);
    expect(domainIds(REPO_ROOT).has("packages/audit-worm")).toBe(true);
  });

  test("the synthetic + singleton domains are present", () => {
    const ids = domainIds(REPO_ROOT);
    for (const id of [
      "workflows",
      "agent-skills",
      "generator-templates",
      "docs-content",
      "scripts",
      "root-config",
      "oss-mirror",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test("surface classes are read from license/public-surface, never guessed", () => {
    const byId = new Map(domains.map((d) => [d.id, d]));
    expect(byId.get("packages/kernel")?.class).toBe("oss-source"); // Apache-2.0
    expect(byId.get("packages/compliance")?.class).toBe("oss-source"); // every package is Apache-2.0
    expect(byId.get("tooling/audit-harness")?.class).toBe("internal-only");
    expect(byId.get("tooling/demo-registry")?.class).toBe("internal-only");
    expect(byId.get("apps/site")?.class).toBe("buyer-runtime");
    expect(byId.get("root-config")?.class).toBe("internal-only");
    expect(byId.get("oss-mirror")?.class).toBe("oss-source");
    expect(byId.get("generator-templates")?.class).toBe("sold-source");
  });

  test("domain ids and roots are unique — no double-claim (the v1 overlap bug)", () => {
    const ids = domains.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const roots = domains.flatMap((d) => d.roots);
    expect(new Set(roots).size).toBe(roots.length);
  });
});

describe("domainForPath — every path resolves to exactly one owner (longest-root)", () => {
  const domains = deriveDomains(REPO_ROOT);

  test("a normal package file resolves to its package domain", () => {
    expect(domainForPath("packages/kernel/src/index.ts", domains)?.id).toBe(
      "packages/kernel",
    );
  });

  test("a repository-local CI action resolves with the workflow execution surface", () => {
    expect(
      domainForPath(".github/actions/setup-bun/action.yml", domains)?.id,
    ).toBe("workflows");
  });

  test("the generator-templates carve-out beats its parent cli domain", () => {
    expect(
      domainForPath("packages/cli/templates/base/package.json", domains)?.id,
    ).toBe("generator-templates");
    // cli's own source stays with cli — the carve is nested, resolved by longest root.
    expect(domainForPath("packages/cli/src/generate.ts", domains)?.id).toBe(
      "packages/cli",
    );
  });

  test("audit-relevant root configuration resolves to the root-config domain", () => {
    expect(domainForPath("orca.yaml", domains)?.id).toBe("root-config");
    expect(domainForPath("tokens.config.json", domains)?.id).toBe(
      "root-config",
    );
  });

  test("a path claimed by no domain returns null", () => {
    expect(domainForPath("bun.lock", domains)).toBeNull();
    expect(domainForPath("turbo.json", domains)).toBeNull();
  });
});
