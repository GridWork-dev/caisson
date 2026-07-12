// registry/scripts/coverage-invariants.ts — the CAISSON-85/86 advertise-follows-upload gates.
//
// The registry's failure class (oss-sandbox audit 2026-07-10): index.json can advertise a version
// whose tarball was never packed/recorded, and a served manifest's exact member pins can point at
// versions that are not servable. Three static invariants close the class at PR time:
//
//   1. latest-coverage (HARD, no grandfather): every module's dist-tags target — `latest` — has a
//      tarballs.json row. The install path resolves `latest`; a rowless latest is a broken buyer
//      install by construction.
//   2. version-coverage: every advertised (id, version) pair has a tarballs.json row, except the
//      frozen pre-sidecar backlog in coverage-grandfather.json (tarballs.json postdates the early
//      catalog, ADR-0223). The backlog may HEAL (a future backfill adds rows) but may never grow.
//   3. member-pin resolvability: every `manifest.members` exact pin in every SERVED index version
//      resolves against the served surface (advertised in index.json AND tarball-backed), except
//      the frozen backlog. Complements full-tree-index.test.ts's ledger-history pin check, whose
//      "ever published" definition is weaker than what a real install needs (CAISSON-86).
//
// Pure functions over parsed files — consumed by coverage-invariants.test.ts (the `registry-index`
// CI job) and scripts/release-readiness.ts (the train's static coverage check). Enforcement note:
// like the rest of the registry suite this is detection; the required-check discipline is the gate.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  loadRegistryIndex,
  type RegistryIndex,
} from "../schema/registry-index";

export const GRANDFATHER_PATH = join(
  import.meta.dir,
  "coverage-grandfather.json",
);

const Grandfather = z
  .object({
    $comment: z.string(),
    rowlessVersions: z.array(z.string().min(1)),
    danglingMemberPins: z.array(z.string().min(1)),
  })
  .strict();
export type Grandfather = z.infer<typeof Grandfather>;

/** Parse-or-throw the frozen backlog lists. */
export function loadGrandfather(path: string = GRANDFATHER_PATH): Grandfather {
  return Grandfather.parse(JSON.parse(readFileSync(path, "utf8")));
}

/** The minimal sidecar slice these gates need: the recorded `<id>@<version>` key set. */
const SidecarKeys = z.object({ tarballs: z.record(z.string(), z.unknown()) });

/** Read tarballs.json and return its recorded key set. */
export function loadSidecarKeys(path: string): Set<string> {
  const parsed = SidecarKeys.parse(JSON.parse(readFileSync(path, "utf8")));
  return new Set(Object.keys(parsed.tarballs));
}

/** Every advertised `<id>@<version>` pair in the served index. */
export function advertisedPairs(index: RegistryIndex): Set<string> {
  const pairs = new Set<string>();
  for (const m of index.modules)
    for (const v of m.versions) pairs.add(`${m.id}@${v.version}`);
  return pairs;
}

/**
 * Invariant 1 (HARD): every module's `latest` has a tarball row. Returns violations as
 * `<id>@<latest>` strings; a non-empty result is always a gate failure — never grandfathered,
 * because `latest` is what `bun add @caisson/<module>` resolves.
 */
export function latestCoverageViolations(
  index: RegistryIndex,
  sidecarKeys: Set<string>,
): string[] {
  return index.modules
    .filter((m) => !sidecarKeys.has(`${m.id}@${m.latest}`))
    .map((m) => `${m.id}@${m.latest}`)
    .sort();
}

/**
 * Invariant 2: every advertised version has a tarball row, minus the frozen backlog.
 * Returns violations (new rowless advertisements) as `<id>@<version>` strings.
 */
export function versionCoverageViolations(
  index: RegistryIndex,
  sidecarKeys: Set<string>,
  grandfatheredRowless: ReadonlySet<string>,
): string[] {
  return [...advertisedPairs(index)]
    .filter((pair) => !sidecarKeys.has(pair) && !grandfatheredRowless.has(pair))
    .sort();
}

/**
 * Invariant 3: every served member pin resolves on the served+tarball-backed surface, minus the
 * frozen backlog. Violation format: `<pinner id>@<version> -> <dep id>@<pin>` (matches the
 * grandfather file's entries byte-for-byte so the freeze is exact).
 */
export function memberPinViolations(
  index: RegistryIndex,
  sidecarKeys: Set<string>,
  grandfatheredPins: ReadonlySet<string>,
): string[] {
  const advertised = advertisedPairs(index);
  const violations: string[] = [];
  for (const m of index.modules)
    for (const v of m.versions) {
      const members = v.manifest.members ?? {};
      for (const [dep, ver] of Object.entries(members)) {
        const pair = `${dep}@${ver}`;
        if (advertised.has(pair) && sidecarKeys.has(pair)) continue;
        const line = `${m.id}@${v.version} -> ${pair}`;
        if (!grandfatheredPins.has(line)) violations.push(line);
      }
    }
  return violations.sort();
}

export type CoverageReport = {
  latest: string[];
  versions: string[];
  pins: string[];
  ok: boolean;
};

/** Run all three invariants over on-disk files (the shape release-readiness consumes). */
export function checkRegistryCoverage(paths: {
  indexPath: string;
  sidecarPath: string;
  grandfatherPath?: string | undefined;
}): CoverageReport {
  const index = loadRegistryIndex(
    JSON.parse(readFileSync(paths.indexPath, "utf8")),
  );
  const sidecarKeys = loadSidecarKeys(paths.sidecarPath);
  const grandfather = loadGrandfather(
    paths.grandfatherPath ?? GRANDFATHER_PATH,
  );
  const latest = latestCoverageViolations(index, sidecarKeys);
  const versions = versionCoverageViolations(
    index,
    sidecarKeys,
    new Set(grandfather.rowlessVersions),
  );
  const pins = memberPinViolations(
    index,
    sidecarKeys,
    new Set(grandfather.danglingMemberPins),
  );
  return {
    latest,
    versions,
    pins,
    ok: latest.length === 0 && versions.length === 0 && pins.length === 0,
  };
}
