// Free-floor regression (CAISSON-63, ADR-0136): an anonymous (unauthenticated) caller of the LIVE
// registry Worker must see EXACTLY the Apache-2.0 base set — no commercial module, ever. Drives the
// real composition root (deploy-entry's `worker`, the same object registered as the Worker's default
// export at DEPLOY) with NO Authorization header, and asserts its response against the PREDICATE
// codified in `packages/registry-schema/src/entitlements.ts` `baseModuleIds`
// (`manifest.editions.length === 0 && manifest.license === "Apache-2.0"`) computed independently over
// the COMMITTED `registry/index.json` — not a hardcoded id list. A hardcoded list would need editing
// every time a legitimate new open-base package publishes; asserting the predicate instead only fails
// when the live behavior actually diverges from ADR-0136 (a filter regression, a misclassified
// manifest, or the gate silently falling back to the unfiltered branch).
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import worker from "./deploy-entry";
import {
  baseModuleIds,
  loadRegistryIndexFromFile,
} from "../schema/registry-index";

const COMMITTED_INDEX = loadRegistryIndexFromFile(
  join(import.meta.dir, "..", "index.json"),
);

// The 9 carve/ui-pro commercial packages (ADR-0257/0258) that must NEVER reach an anonymous caller.
// Named explicitly — belt-and-suspenders alongside the predicate assertion below, so a bug that made
// the predicate ITSELF over-permissive (not just a dropped filter) is still caught.
const COMMERCIAL_PACKAGE_IDS = [
  "@caisson/compliance-core",
  "@caisson/frameworks-pack",
  "@caisson/signing-primitive",
  "@caisson/org-controls",
  "@caisson/billing-orchestration",
  "@caisson/local-sync",
  "@caisson/local-inference",
  "@caisson/local-privacy",
  "@caisson/ui-pro",
] as const;

async function anonModuleIds(): Promise<string[]> {
  const res = await worker.fetch(
    new Request("https://registry.caisson.sh/index.json"),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { modules: { id: string }[] };
  return body.modules.map((m) => m.id);
}

/** The manifest for a module's `latest` version — same lookup shape `baseModuleIds` uses internally,
 *  recomputed independently here (not imported) so a bug in that private helper can't hide itself. */
function latestManifestOf(id: string): {
  editions: readonly string[];
  license: string;
} {
  const entry = COMMITTED_INDEX.modules.find((m) => m.id === id);
  if (entry === undefined)
    throw new Error(`unknown module in test fixture: ${id}`);
  const version =
    entry.versions.find((v) => v.version === entry.latest) ?? entry.versions[0];
  if (version === undefined) throw new Error(`module ${id} has no versions`);
  return version.manifest;
}

describe("registry Worker free floor (CAISSON-63, ADR-0136)", () => {
  test("the anon /index.json set is EXACTLY the predicate-derived Apache-2.0 base", async () => {
    const expected = new Set(baseModuleIds(COMMITTED_INDEX));
    const actual = new Set(await anonModuleIds());
    expect(actual).toEqual(expected);
  });

  test("baseline count — bump this ONLY for a legitimate new OSS base package publish", async () => {
    const ids = await anonModuleIds();
    // Snapshot of the committed registry/index.json at CAISSON-55/63 time. `@caisson/credits` is
    // NOT in this set — it flipped to LicenseRef-Caisson-Commercial (the catalog-program commercial
    // flip); this baseline reflects the CURRENT predicate output, not any historical listing.
    // Bumped 16 -> 17: @caisson/ds-manifest published (Apache-2.0, editions: [] — a legitimate new
    // OSS base package, the agent-ready design-system surface's shared manifest/doctor layer).
    // Lowered 17 -> 16: @caisson/analytics RETIRED (ADR-0410) — the ADR-0287 analytics port never
    // acquired a consumer and is deleted + module-delisted. This is the first downward move of this
    // baseline; a retirement is as legitimate a reason to change it as a publish, but it still only
    // moves with an ADR behind it.
    expect(ids.length).toBe(baseModuleIds(COMMITTED_INDEX).length);
    expect(ids.length).toBe(16);
  });

  test("none of the 9 carve/ui-pro commercial packages ever appear in the anon set", async () => {
    const ids = new Set(await anonModuleIds());
    for (const commercialId of COMMERCIAL_PACKAGE_IDS) {
      expect(ids.has(commercialId)).toBe(false);
    }
  });

  test("every anon-served module independently satisfies the ADR-0136 predicate", async () => {
    const ids = await anonModuleIds();
    expect(ids.length).toBeGreaterThan(0); // guard against a vacuously-true empty-set pass
    for (const id of ids) {
      const manifest = latestManifestOf(id);
      expect(manifest.editions.length).toBe(0);
      expect(manifest.license).toBe("Apache-2.0");
    }
  });
});
