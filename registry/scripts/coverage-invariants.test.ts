// CAISSON-85/86 coverage gates. Two layers:
//   1. Real committed files stay green: latest-coverage (hard), version-coverage and member-pin
//      resolvability (frozen-backlog-exempt). A regression — any writer advancing index.json
//      without its tarball row, or a new dangling pin — fails the `registry-index` CI job here.
//   2. Synthetic red cases pin each failure class so the gates themselves can't rot.
// Plus the pre-publish check: the CURRENT workspace manifests' member pins must resolve on the
// served surface — this is what keeps the NEXT version-PR cut (the release train's first leg)
// green instead of discovering a dangling pin after the ledger append.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadRegistryIndex } from "../schema/registry-index";
import { INDEX_PATH, LEDGER_PATH, parseLedgerLines } from "./build-index";
import {
  SIDECAR_PATH,
  findManifestPaths,
  loadManifest,
} from "./ci-publish-step";
import {
  advertisedPairs,
  checkRegistryCoverage,
  latestCoverageViolations,
  loadGrandfather,
  loadSidecarKeys,
  memberPinViolations,
  versionCoverageViolations,
} from "./coverage-invariants";

const index = loadRegistryIndex(JSON.parse(readFileSync(INDEX_PATH, "utf8")));
const sidecarKeys = loadSidecarKeys(SIDECAR_PATH);
const grandfather = loadGrandfather();

describe("registry coverage gates (CAISSON-85/86)", () => {
  test("every module's latest has a tarball row (HARD — the buyer install path)", () => {
    expect(latestCoverageViolations(index, sidecarKeys)).toEqual([]);
  });

  test("no advertised version outside the frozen backlog is missing its tarball row", () => {
    expect(
      versionCoverageViolations(
        index,
        sidecarKeys,
        new Set(grandfather.rowlessVersions),
      ),
    ).toEqual([]);
  });

  test("every served member pin outside the frozen backlog resolves served+tarball-backed", () => {
    expect(
      memberPinViolations(
        index,
        sidecarKeys,
        new Set(grandfather.danglingMemberPins),
      ),
    ).toEqual([]);
  });

  test("the frozen backlog never grows and only lists real current violations (heal-only)", () => {
    // Every grandfathered entry must still BE a violation-shaped fact or have healed; what it can
    // never do is exempt a pair that is advertised today with a row missing tomorrow. Concretely:
    // rowlessVersions entries must each still be advertised (else the entry is stale — prune it),
    // and the committed lists match the counts frozen at enumeration (2026-07-12) or shrink.
    const advertised = advertisedPairs(index);
    for (const pair of grandfather.rowlessVersions) {
      expect(advertised.has(pair)).toBe(true);
    }
    expect(grandfather.rowlessVersions.length).toBeLessThanOrEqual(88);
    expect(grandfather.danglingMemberPins.length).toBeLessThanOrEqual(44);
  });

  test("checkRegistryCoverage over the committed files reports ok", () => {
    const report = checkRegistryCoverage({
      indexPath: INDEX_PATH,
      sidecarPath: SIDECAR_PATH,
    });
    expect(report.ok).toBe(true);
  });
});

describe("coverage gate red cases (synthetic)", () => {
  // A minimal well-formed index with one module, two versions, latest = 9.9.9.
  const manifestFor = (
    id: string,
    version: string,
    members?: Record<string, string>,
  ) => ({
    id,
    version,
    kind: "base",
    editions: [],
    tier: "paid",
    priceCents: 100,
    license: "LicenseRef-Caisson-Commercial",
    dependencies: [],
    members: members ?? {},
    entry: "src/index.ts",
    agents: "AGENTS.md",
    golden: "src/__golden__",
    stability: "alpha",
    description: "synthetic fixture",
  });
  const version = (
    id: string,
    v: string,
    members?: Record<string, string>,
  ) => ({
    version: v,
    manifest: manifestFor(id, v, members),
    publishedAt: "2026-07-12T00:00:00.000Z",
    gateAttestation: "test@0000000",
  });
  const syntheticIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      {
        id: "@caisson/fixture-a",
        latest: "9.9.9",
        versions: [
          version("@caisson/fixture-a", "9.9.8"),
          version("@caisson/fixture-a", "9.9.9"),
        ],
      },
      {
        id: "@caisson/fixture-b",
        latest: "1.0.0",
        versions: [
          version("@caisson/fixture-b", "1.0.0", {
            "@caisson/fixture-a": "9.9.9",
            "@caisson/fixture-a-gone": "0.1.0",
          }),
        ],
      },
    ],
  });

  test("CAISSON-85 class: a rowless latest fails the hard gate", () => {
    const keys = new Set([
      "@caisson/fixture-a@9.9.8",
      "@caisson/fixture-b@1.0.0",
    ]);
    expect(latestCoverageViolations(syntheticIndex, keys)).toEqual([
      "@caisson/fixture-a@9.9.9",
    ]);
    // And the rowless non-latest version is a version-coverage violation when not grandfathered.
    expect(versionCoverageViolations(syntheticIndex, keys, new Set())).toEqual([
      "@caisson/fixture-a@9.9.9",
    ]);
  });

  test("CAISSON-86 class: a pin to an unadvertised or rowless target fails the pin gate", () => {
    const keys = new Set([
      "@caisson/fixture-a@9.9.8",
      "@caisson/fixture-a@9.9.9",
      "@caisson/fixture-b@1.0.0",
    ]);
    // fixture-a-gone is not advertised at all → dangling; fixture-a@9.9.9 resolves.
    expect(memberPinViolations(syntheticIndex, keys, new Set())).toEqual([
      "@caisson/fixture-b@1.0.0 -> @caisson/fixture-a-gone@0.1.0",
    ]);
    // Rowless pin target: advertised but no tarball row → dangling too.
    const keysNoLatest = new Set([
      "@caisson/fixture-a@9.9.8",
      "@caisson/fixture-b@1.0.0",
    ]);
    expect(
      memberPinViolations(syntheticIndex, keysNoLatest, new Set()),
    ).toContain("@caisson/fixture-b@1.0.0 -> @caisson/fixture-a@9.9.9");
    // Grandfathering silences exactly the enumerated line and nothing else.
    expect(
      memberPinViolations(
        syntheticIndex,
        keys,
        new Set(["@caisson/fixture-b@1.0.0 -> @caisson/fixture-a-gone@0.1.0"]),
      ),
    ).toEqual([]);
  });
});

describe("pre-publish pin check (the next version cut stays green)", () => {
  test("current workspace manifests' member pins resolve served+tarball-backed", async () => {
    // The next version-PR run ledgers each CURRENT workspace manifest as a NEW advertised version
    // whose members map is snapshotted verbatim — so any dangling pin here becomes a NEW (non-
    // grandfathered) violation on that PR. Catch it now, in this repo, at PR time. A pin to a
    // module's own current workspace version is fine: the same version-PR run advertises + packs
    // the member in the same commit.
    const advertised = advertisedPairs(index);
    // A delisted id never re-enters the index (ci-publish-step skips its workspace manifest), so
    // its on-disk manifest must not count as "resolves at this cut" — and a pin TO one is dangling
    // by definition (the served index will never carry it again).
    const delisted = new Set(
      parseLedgerLines(readFileSync(LEDGER_PATH, "utf8")).delists.map(
        (d) => d.id,
      ),
    );
    const workspaceCurrent = new Set<string>();
    const manifests = [] as {
      id: string;
      version: string;
      members: Record<string, string>;
    }[];
    for (const p of findManifestPaths()) {
      const m = await loadManifest(p);
      if (delisted.has(m.id)) continue;
      workspaceCurrent.add(`${m.id}@${m.version}`);
      manifests.push({
        id: m.id,
        version: m.version,
        members: m.members ?? {},
      });
    }
    const dangling: string[] = [];
    for (const m of manifests) {
      for (const [dep, ver] of Object.entries(m.members)) {
        const pair = `${dep}@${ver}`;
        if (delisted.has(dep)) {
          dangling.push(`${m.id}@${m.version} -> ${pair} (delisted id)`);
          continue;
        }
        const resolvesPublished = advertised.has(pair) && sidecarKeys.has(pair);
        const resolvesThisCut = workspaceCurrent.has(pair);
        if (!resolvesPublished && !resolvesThisCut) {
          dangling.push(`${m.id}@${m.version} -> ${pair}`);
        }
      }
    }
    expect(dangling.sort()).toEqual([]);
  });
});
