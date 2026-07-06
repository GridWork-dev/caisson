// Bundle manifests (ADR-0257/0258 §3). Each new kind:"bundle" meta-package expands, through the
// registry index, to EXACTLY its frozen `members` map — and the Everything bundle's EXPLICIT
// full-catalog rule contains ui-pro while excluding the private, never-sold brand + license-issue
// packages. The real package manifests are loaded through a runtime dynamic import (the same path
// ci-publish-step uses), so any members-map edit is pinned by these tests without pulling a
// cross-package file into this package's tsc rootDir.
import { beforeAll, describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BundleId } from "./bundle-vocabulary";
import { expandEntitlements } from "./entitlements";
import type { ModuleManifest } from "./module-manifest";
import { loadRegistryIndex, type RegistryIndex } from "./registry-index";

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function loadBundleManifest(slug: string): Promise<ModuleManifest> {
  const mod = (await import(join(PKG_DIR, slug, "manifest.ts"))) as {
    default: ModuleManifest;
  };
  return mod.default;
}

const SPECS = [
  { id: "provenance", legacy: "provenance", slug: "provenance" },
  { id: "ai-production", legacy: "ai-kit", slug: "ai-production" },
  { id: "local-first", legacy: "local-ai", slug: "local-first" },
  { id: "agentic-dev", legacy: "agent-dev", slug: "agentic-dev" },
  { id: "everything", legacy: "bundle", slug: "everything" },
] as const satisfies ReadonlyArray<{
  id: BundleId;
  legacy: string;
  slug: string;
}>;

const manifests = new Map<string, ModuleManifest>();
beforeAll(async () => {
  for (const s of SPECS)
    manifests.set(s.slug, await loadBundleManifest(s.slug));
});

function mf(slug: string): ModuleManifest {
  const m = manifests.get(slug);
  if (m === undefined) throw new Error(`manifest not loaded: ${slug}`);
  return m;
}

/** A minimal indexed open-base module — an allowlist entry so a bundle member resolves. */
function stub(id: string): unknown {
  return {
    id,
    latest: "0.1.0",
    versions: [
      {
        version: "0.1.0",
        publishedAt: "2026-07-06T00:00:00.000Z",
        gateAttestation: "ci-fixture@0000004",
        manifest: {
          id,
          version: "0.1.0",
          kind: "base",
          tier: "oss",
          license: "Apache-2.0",
          description: `${id} stub (fixture).`,
        },
      },
    ],
  };
}

/** An index carrying the bundle plus a stub for every non-self member (all allowlisted). */
function indexWithBundle(m: ModuleManifest): RegistryIndex {
  const memberIds = Object.keys(m.members);
  return loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      {
        id: m.id,
        latest: m.version,
        versions: [
          {
            version: m.version,
            publishedAt: "2026-07-06T00:00:00.000Z",
            gateAttestation: "ci-fixture@0000004",
            manifest: m,
          },
        ],
      },
      ...memberIds.filter((id) => id !== m.id).map(stub),
    ],
  });
}

describe("ADR-0257/0258 bundle manifests expand to their frozen members map", () => {
  for (const { id, legacy, slug } of SPECS) {
    test(`${id} expands to exactly its members map (index-derived, allowlist-guarded)`, () => {
      const m = mf(slug);
      const expected = Object.keys(m.members).sort();
      expect([...expandEntitlements(indexWithBundle(m), [id])].sort()).toEqual(
        expected,
      );
    });

    test(`${id}: the legacy purchased id "${legacy}" resolves to the identical member set (alias)`, () => {
      const index = indexWithBundle(mf(slug));
      expect([...expandEntitlements(index, [legacy])].sort()).toEqual(
        [...expandEntitlements(index, [id])].sort(),
      );
    });
  }

  test('every bundle carries kind:"bundle", a paid tier, and a positive locked price', () => {
    for (const { slug } of SPECS) {
      const m = mf(slug);
      expect(m.kind).toBe("bundle");
      expect(m.tier).toBe("paid");
      expect(typeof m.priceCents).toBe("number");
      expect(m.priceCents ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("ADR-0258 §3 Everything = explicit full-catalog rule (ui-pro IN, private OUT)", () => {
  test("ui-pro is IN the Everything membership", () => {
    expect(Object.hasOwn(mf("everything").members, "@caisson/ui-pro")).toBe(
      true,
    );
  });

  test("the private, never-sold brand + license-issue packages are OUT", () => {
    const members = mf("everything").members;
    expect(Object.hasOwn(members, "@caisson/brand")).toBe(false);
    expect(Object.hasOwn(members, "@caisson/license-issue")).toBe(false);
  });

  test("expansion grants ui-pro but never the private packages", () => {
    const granted = expandEntitlements(indexWithBundle(mf("everything")), [
      "everything",
    ]);
    expect(granted.has("@caisson/ui-pro")).toBe(true);
    expect(granted.has("@caisson/brand")).toBe(false);
    expect(granted.has("@caisson/license-issue")).toBe(false);
  });

  test("the explicit rule replaces the derived scan: everything reads its indexed bundle entry", () => {
    // With the @caisson/everything bundle entry present, expansion reads its explicit members map
    // (not base ∪ all editions) — the derivation is the pre-republish fallback only.
    const m = mf("everything");
    expect(
      [...expandEntitlements(indexWithBundle(m), ["everything"])].sort(),
    ).toEqual(Object.keys(m.members).sort());
  });
});
