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
import {
  COMPATIBILITY_REEXPORT_ENTITLEMENTS,
  INTERNAL_RUNTIME_ENTITLEMENTS,
  expandEntitlements,
} from "./entitlements";
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
  { id: "provenance", slug: "provenance" },
  { id: "ai-production", slug: "ai-production" },
  { id: "local-first", slug: "local-first" },
  { id: "agentic-dev", slug: "agentic-dev" },
  { id: "everything", slug: "everything" },
] as const satisfies ReadonlyArray<{
  id: BundleId;
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
  const indexedIds = new Set(memberIds);
  let added = true;
  while (added) {
    added = false;
    for (const id of [...indexedIds]) {
      for (const edges of [
        COMPATIBILITY_REEXPORT_ENTITLEMENTS,
        INTERNAL_RUNTIME_ENTITLEMENTS,
      ]) {
        for (const target of edges.get(id) ?? []) {
          if (!indexedIds.has(target)) {
            indexedIds.add(target);
            added = true;
          }
        }
      }
    }
  }
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
      ...[...indexedIds].filter((id) => id !== m.id).map(stub),
    ],
  });
}

function expectedMemberClosure(m: ModuleManifest): string[] {
  const expected = new Set(Object.keys(m.members));
  if (expected.has("@caisson/oscal-spine")) {
    expected.add("@caisson/artifact-render");
  }
  return [...expected].sort();
}

describe("ADR-0257/0258 bundle manifests expand to their frozen members map", () => {
  for (const { id, slug } of SPECS) {
    test(`${id} expands to its members plus only named compatibility/runtime closure`, () => {
      const m = mf(slug);
      expect([...expandEntitlements(indexWithBundle(m), [id])].sort()).toEqual(
        expectedMemberClosure(m),
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

  test("the private, never-sold brand + license-issue + audit-harness packages are OUT", () => {
    const members = mf("everything").members;
    expect(Object.hasOwn(members, "@caisson/brand")).toBe(false);
    expect(Object.hasOwn(members, "@caisson/license-issue")).toBe(false);
    expect(Object.hasOwn(members, "@caisson/audit-harness")).toBe(false);
  });

  test("expansion grants ui-pro but never the private packages", () => {
    const granted = expandEntitlements(indexWithBundle(mf("everything")), [
      "everything",
    ]);
    expect(granted.has("@caisson/ui-pro")).toBe(true);
    expect(granted.has("@caisson/brand")).toBe(false);
    expect(granted.has("@caisson/license-issue")).toBe(false);
    expect(granted.has("@caisson/audit-harness")).toBe(false);
  });

  test("everything reads its indexed bundle entry as the sole grant rule", () => {
    // With the @caisson/everything bundle entry present, expansion reads exactly its explicit
    // members map plus named internal closure — never base ∪ all editions.
    const m = mf("everything");
    expect(
      [...expandEntitlements(indexWithBundle(m), ["everything"])].sort(),
    ).toEqual(expectedMemberClosure(m));
  });
});
