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
    // Every grandfathered entry must be a CURRENT violation: the moment a backfill heals one (or a
    // delist retires it), its entry goes stale and this test forces it OUT of the file in the same
    // PR — the file monotonically shrinks, and a healed slot can never sit as slack to be swapped
    // for a fresh violation later. Additions are separately capped at the enumeration counts;
    // growing a frozen data file past review is the loud diff the required check exists for.
    // Re-enumerated once 2026-07-17 when the ADR-0359 prune delisted 93 rows: rowlessVersions held
    // steady at 88 (untouched); danglingMemberPins retired the stale everything@0.2.0/0.2.1/0.2.2
    // pinner rows (those pinning versions were themselves version-delisted, so the served index no
    // longer carries them to check) and grew to enumerate the latest bundle manifests' member pins
    // the prune exposed as dead edges (those manifests' pinned old versions were among the pruned
    // rows) — the caps below re-freeze at the new counts.
    const currentRowless = new Set(
      versionCoverageViolations(index, sidecarKeys, new Set()),
    );
    for (const pair of grandfather.rowlessVersions) {
      expect(currentRowless.has(pair)).toBe(true);
    }
    const currentDangling = new Set(
      memberPinViolations(index, sidecarKeys, new Set()),
    );
    for (const line of grandfather.danglingMemberPins) {
      expect(currentDangling.has(line)).toBe(true);
    }
    // Re-frozen 2026-07-24: the expired agent-trajectory@0.3.0 carve-out prune exposed 2 more
    // dead pinner edges (agentic-dev@0.2.3, everything@0.2.5) — 114 -> 116, same class as above.
    expect(grandfather.rowlessVersions.length).toBeLessThanOrEqual(88);
    expect(grandfather.danglingMemberPins.length).toBeLessThanOrEqual(116);
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
    // A MODULE-delisted id never re-enters the index (ci-publish-step skips its workspace
    // manifest), so its on-disk manifest must not count as "resolves at this cut" — and a pin TO
    // one is dangling by definition (the served index will never carry it again). Filtered to
    // `d.version === undefined` (ADR-0359): a version-delisted module is still live and re-enters
    // the index under its surviving versions, so it must not be folded into this set.
    const delisted = new Set(
      parseLedgerLines(readFileSync(LEDGER_PATH, "utf8"))
        .delists.filter((d) => d.version === undefined)
        .map((d) => d.id),
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
