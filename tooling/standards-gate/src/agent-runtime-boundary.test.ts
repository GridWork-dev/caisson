// Agent-runtime slice-1 dependency-boundary fixture (CAISSON-109, ADR-0349/0351). Real-tree
// assertions in the catalog-checks.test.ts house style: the committed workspace must satisfy the
// trajectory-observation contract that slice 1 introduces. This records the T3 dependency-direction
// decision as an executable lock — agent-trajectory is the engine-neutral substrate, agent-runner
// and ai-kit are its consumers, and the AI SDK stays confined to ai-kit.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRoot, readWorkspace } from "./workspace";

const ROOT = findRoot(import.meta.dir);
const pkgs = readWorkspace(ROOT);
const byName = new Map(pkgs.map((p) => [p.name, p]));

const TRAJECTORY = "@caisson-sh/agent-trajectory";
const RUNNER = "@caisson-sh/agent-runner";
const AI_KIT = "@caisson-sh/ai-kit";

// The kernel-level primitives agent-trajectory (a `primitive`) may sit on. It is the engine-neutral
// contract; it depends only "down" onto kernel — never onto a runner, an edition, or ai-kit
// (ADR-0003 down-only; ADR-0351: the trajectory is the substrate, never the consumer).
// tenancy-rls joined the set with the durable PG stores (ADR-0360 U-3): the FORCE-RLS
// TrajectoryStore/RunStateStore sit on the same Base tenancy primitive every other row store uses —
// still down-only, still no runner/edition/ai-kit. field-crypto joined the set with the encRef wrap
// of `parked_state` (S5, ADR-0361's mandate: the wrap MUST land before publish, and ADR-0361
// explicitly requires field-crypto's OWN key/tenancy conventions, not a new key-material shape) —
// field-crypto is itself a Base-kernel-only primitive (see its own manifest.ts), so this widening is
// still a lateral primitive→primitive dependency, never "up" onto a runner/edition/ai-kit.
// ai-meter joined the set with the ./usage fold (ADR-0402): priceUsage upgrades estimated
// model.usage events to pricebook-computed credits via ai-meter's BUNDLED_PRICE_BOOK — ai-meter is
// itself a primitive on Base primitives only (credits/kernel/tenancy-rls), so this too is lateral;
// the engine-neutral core stays clean because usage adapters live behind the subpath, off the barrel.
const KERNEL_LEVEL = new Set([
  "@caisson-sh/kernel",
  "@caisson-sh/tenancy-rls",
  "@caisson-sh/field-crypto",
  "@caisson-sh/ai-meter",
]);

describe("agent-runtime slice-1 dependency boundary (ADR-0349/0351)", () => {
  test("agent-trajectory (primitive) depends on nothing above kernel-level", () => {
    const p = byName.get(TRAJECTORY);
    expect(p).toBeDefined();
    const upward = p!.workspaceDeps.filter((d) => !KERNEL_LEVEL.has(d));
    expect(upward).toEqual([]);
  });

  test("agent-trajectory never depends 'up' on its consumers (runner/ai-kit)", () => {
    const deps = byName.get(TRAJECTORY)!.workspaceDeps;
    expect(deps).not.toContain(RUNNER);
    expect(deps).not.toContain(AI_KIT);
  });

  test("agent-runner and ai-kit depend on agent-trajectory (direction: consumer -> contract)", () => {
    expect(byName.get(RUNNER)!.workspaceDeps).toContain(TRAJECTORY);
    expect(byName.get(AI_KIT)!.workspaceDeps).toContain(TRAJECTORY);
  });

  test("ai-kit remains the only packages/* module importing `ai` / `@ai-sdk/*`", () => {
    // `\s+` spans newlines, so a multi-line import still matches; requiring `from`/`import` before
    // the specifier excludes value strings (e.g. email's `w === "ai"` scroll-token comparison).
    const importRe = /(?:from|import)\s+["'](?:ai|@ai-sdk\/[^"']+)["']/;
    const glob = new Bun.Glob("packages/*/src/**/*.{ts,tsx}");
    const importers = new Set<string>();
    for (const rel of glob.scanSync({ cwd: ROOT })) {
      if (importRe.test(readFileSync(join(ROOT, rel), "utf8"))) {
        importers.add(rel.split("/").slice(0, 2).join("/")); // packages/<name>
      }
    }
    expect([...importers].sort()).toEqual(["packages/ai-kit"]);
  });
});
