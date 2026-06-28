// Tests for registry/scripts/backfill.ts (ADR-0021/0069) — topological backfill driver.
// NOTE: registry/ is not a workspace member, so @caisson/* bare specifiers do not resolve here —
// these tests use only relative imports + node built-ins.
import { describe, expect, test } from "bun:test";
import { ModuleManifest } from "../schema/module-manifest.ts";
import { backfill, topoSort } from "./backfill.ts";
import type { PublisherFn } from "./backfill.ts";

/** Build a minimal valid ModuleManifest for test fixtures. `priceCents: 100` satisfies the
 *  paid > 0 refine (ADR-0007); `kind: "primitive"` is the simplest non-edition kind. */
function mk(id: string, deps: readonly string[]): ModuleManifest {
  return ModuleManifest.parse({
    id,
    version: "0.1.0",
    kind: "primitive",
    tier: "paid",
    priceCents: 100,
    license: "LicenseRef-Caisson-Commercial",
    dependencies: [...deps],
    description: `test fixture ${id}`,
  });
}

describe("backfill driver (ADR-0021/0069)", () => {
  // ---------------------------------------------------------------------------
  // topoSort
  // ---------------------------------------------------------------------------
  describe("topoSort", () => {
    test("kernel before all dependents — kernel → base → primitives chain", () => {
      // Mirrors the real dependency chain: kernel has no deps; tenancy-rls and field-crypto
      // depend on kernel; credits depends on kernel + tenancy-rls.
      const kernel = mk("@caisson/kernel", []);
      const tenancy = mk("@caisson/tenancy-rls", ["@caisson/kernel"]);
      const fc = mk("@caisson/field-crypto", ["@caisson/kernel"]);
      const credits = mk("@caisson/credits", [
        "@caisson/kernel",
        "@caisson/tenancy-rls",
      ]);

      // Pass in unsorted / reverse order; topoSort must output dependencies before dependents.
      const sorted = topoSort([credits, fc, tenancy, kernel]);
      const ids = sorted.map((m) => m.id);

      expect(ids[0]).toBe("@caisson/kernel");
      // Lexicographic tie-break: field-crypto ("f") < tenancy-rls ("t") at the same level.
      expect(ids[1]).toBe("@caisson/field-crypto");
      expect(ids[2]).toBe("@caisson/tenancy-rls");
      // credits depends on both; must come last.
      expect(ids[3]).toBe("@caisson/credits");
    });

    test("absent dependencies are silently skipped — not an error", () => {
      // compliance lists [audit-worm, field-crypto, tenancy-rls, kernel] but only kernel is in
      // the manifests set; the other three edges are absent → skipped.
      const kernel = mk("@caisson/kernel", []);
      const compliance = mk("@caisson/compliance", [
        "@caisson/audit-worm",
        "@caisson/field-crypto",
        "@caisson/tenancy-rls",
        "@caisson/kernel",
      ]);

      // Only the kernel→compliance edge is counted (one within-set dep for compliance).
      const sorted = topoSort([compliance, kernel]);
      expect(sorted.map((m) => m.id)).toEqual([
        "@caisson/kernel",
        "@caisson/compliance",
      ]);
    });

    test("deterministic tie-break: lexicographic ascending by id regardless of input order", () => {
      // Three root nodes (no deps in set) — output must be sorted by id however they arrive.
      const z = mk("@caisson/z-module", []);
      const a = mk("@caisson/a-module", []);
      const m = mk("@caisson/m-module", []);

      const sorted = topoSort([z, m, a]);
      expect(sorted.map((s) => s.id)).toEqual([
        "@caisson/a-module",
        "@caisson/m-module",
        "@caisson/z-module",
      ]);
    });

    test("cycle detection throws with a message naming the culprits", () => {
      const a = mk("@caisson/alpha", ["@caisson/beta"]);
      const b = mk("@caisson/beta", ["@caisson/alpha"]);
      expect(() => topoSort([a, b])).toThrow(/cycle/);
    });

    test("single-node (no deps) returns that node", () => {
      const kernel = mk("@caisson/kernel", []);
      expect(topoSort([kernel]).map((m) => m.id)).toEqual(["@caisson/kernel"]);
    });

    test("empty input returns empty array", () => {
      expect(topoSort([])).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // backfill
  // ---------------------------------------------------------------------------
  describe("backfill", () => {
    test("bootstrap (empty allowlist): all manifests are published in topo order", async () => {
      const kernel = mk("@caisson/kernel", []);
      const fc = mk("@caisson/field-crypto", ["@caisson/kernel"]);
      const published: string[] = [];
      const publish: PublisherFn = (m) => {
        published.push(m.id);
      };

      await backfill({
        manifests: [fc, kernel],
        allowlist: new Set(),
        publish,
      });

      // kernel is the dependency — must come before field-crypto.
      expect(published).toEqual(["@caisson/kernel", "@caisson/field-crypto"]);
    });

    test("already-published modules in allowlist are skipped", async () => {
      const kernel = mk("@caisson/kernel", []);
      const fc = mk("@caisson/field-crypto", ["@caisson/kernel"]);
      const published: string[] = [];
      const publish: PublisherFn = (m) => {
        published.push(m.id);
      };

      await backfill({
        manifests: [kernel, fc],
        allowlist: new Set(["@caisson/kernel"]),
        publish,
      });

      // kernel already in allowlist; only field-crypto is new.
      // kernel dep-edge absent from toPublish → field-crypto in-degree is 0, published alone.
      expect(published).toEqual(["@caisson/field-crypto"]);
    });

    test("absent edition skipped: a dependency absent from manifests does not block publishing", async () => {
      // credits depends on [kernel, registry, tenancy-rls]; only kernel + credits are provided.
      // registry and tenancy-rls absent → those edges skipped; credits still published after kernel.
      const kernel = mk("@caisson/kernel", []);
      const credits = mk("@caisson/credits-test", [
        "@caisson/kernel",
        "@caisson/registry",
        "@caisson/tenancy-rls",
      ]);
      const published: string[] = [];
      const publish: PublisherFn = (m) => {
        published.push(m.id);
      };

      await backfill({
        manifests: [credits, kernel],
        allowlist: new Set(),
        publish,
      });

      expect(published).toEqual(["@caisson/kernel", "@caisson/credits-test"]);
    });

    test("publisher spy receives manifests in dependency order (end-to-end)", async () => {
      const kernel = mk("@caisson/kernel", []);
      const tenancy = mk("@caisson/tenancy-rls", ["@caisson/kernel"]);
      const fc = mk("@caisson/field-crypto", ["@caisson/kernel"]);
      const credits = mk("@caisson/credits", [
        "@caisson/kernel",
        "@caisson/tenancy-rls",
      ]);
      const guardrails = mk("@caisson/guardrails", [
        "@caisson/field-crypto",
        "@caisson/kernel",
      ]);

      const spy: ModuleManifest[] = [];
      const publish: PublisherFn = (m) => {
        spy.push(m);
      };

      await backfill({
        manifests: [guardrails, credits, tenancy, kernel, fc],
        allowlist: new Set(),
        publish,
      });

      const ids = spy.map((m) => m.id);
      // All five modules published.
      expect(spy).toHaveLength(5);
      // kernel must be first (only zero-dep node in the set).
      expect(ids[0]).toBe("@caisson/kernel");
      // field-crypto (dep) before guardrails (dependent).
      expect(ids.indexOf("@caisson/field-crypto")).toBeLessThan(
        ids.indexOf("@caisson/guardrails"),
      );
      // tenancy-rls (dep) before credits (dependent).
      expect(ids.indexOf("@caisson/tenancy-rls")).toBeLessThan(
        ids.indexOf("@caisson/credits"),
      );
    });

    test("no-op when all manifests are already in allowlist", async () => {
      const kernel = mk("@caisson/kernel", []);
      let called = false;
      const publish: PublisherFn = () => {
        called = true;
      };

      await backfill({
        manifests: [kernel],
        allowlist: new Set(["@caisson/kernel"]),
        publish,
      });

      expect(called).toBe(false);
    });

    test("async publisher is awaited before the next call", async () => {
      // Verify sequential ordering even when publish returns a Promise.
      const a = mk("@caisson/a-module", []);
      const b = mk("@caisson/b-module", ["@caisson/a-module"]);
      const order: string[] = [];

      const publish: PublisherFn = async (m) => {
        // Yield to the event loop to confirm backfill waits for each promise.
        await Promise.resolve();
        order.push(m.id);
      };

      await backfill({ manifests: [b, a], allowlist: new Set(), publish });

      expect(order).toEqual(["@caisson/a-module", "@caisson/b-module"]);
    });
  });
});
