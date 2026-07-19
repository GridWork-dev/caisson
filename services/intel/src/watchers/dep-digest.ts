// Dependency/toolchain digest watcher (ADR-0369): the successor to the retired weekly
// toolchain-advisory GitHub Actions lane. Weekly cadence, four failure-tolerant detection legs,
// all read via the GitHub API (contents/trees/pulls) rather than a local checkout — the daemon
// is containerized and does not carry this repo's working tree.
//
//   a. Renovate PRs open > 14 days — a stalled update.
//   b. Toolchain + pinned-dep watch — typescript/tsc-native/next/zod/turbo/react/better-auth
//      against npm registry latest, plus bun against GitHub releases.
//   c. Release-age annotation — a newer version published < 7 days ago reads as "held", not
//      "available" (mirrors a minimumReleaseAge posture without asserting the repo's Renovate
//      config sets one).
//   d. Buyer-impact — which packages/* declare a flagged dep, split direct vs transitive-only
//      (v2). Direct declarations still come from the packages/*/package.json fan-out (below).
//      Transitive reach is resolved from `bun.lock`: every workspace's own dependency block PLUS
//      every resolved npm package's `dependencies`/`optionalDependencies`/`peerDependencies` form
//      one name-keyed graph; a reverse walk from the flagged dep's name collects every workspace
//      package whose closure contains it. apps/* stays out of scope (matching v1 — apps aren't
//      sold modules) beyond the one better-auth manifest fetch below. Failure-tolerant: a
//      `bun.lock` fetch/parse failure degrades this leg to v1's direct-only mapping (noted in the
//      finding body) — it never blocks the toolchain/pinned-dep leg itself.
//
// Each finding is deduped through watch_state per distinct "event" (a specific latest-version +
// held/available state, or a specific stalled PR number) — a stable week emits nothing. Findings
// that DO fire are pushed through the same Linear-draft alert path error-triage.ts uses
// (`buildAlertChannels`), via `deliverImmediate` rather than the full `processAlert` pipeline:
// watch_state dedup already prevents re-alerting the same event, so there is no need for
// error-triage's incident/rate-cap/quiet-hours machinery here.
import { z } from "zod";
import { createInMemoryAuditSink, deliverImmediate } from "@caisson/alerting";
import type { AlertChannel, AlertEvent } from "@caisson/alerting";
import { dedupKey } from "../finding.ts";
import { fetchJson } from "../http.ts";
import { buildAlertChannels } from "../sinks.ts";
import type { Fetcher } from "../http.ts";
import type { Finding } from "../finding.ts";
import type { Watcher, WatcherCtx } from "./types.ts";

const REPO_NAME = "caisson";
const DEFAULT_BRANCH = "main";
const DAY_MS = 24 * 3_600_000;
const STALE_PR_MS = 14 * DAY_MS;
const RELEASE_HOLD_MS = 7 * DAY_MS;

// ============================================================================================
// Pure: version-string helpers
// ============================================================================================

/** Strips an `npm:<pkg>@` alias prefix (tsc-native's form), a `bun@` packageManager prefix, and
 *  any leading non-digit range operator (`^`, `~`, `v`) — leaving a bare `major.minor.patch`. */
export function normalizeVersionSpec(spec: string): string {
  const aliasIdx = spec.lastIndexOf("@");
  const afterPrefix = aliasIdx > 0 ? spec.slice(aliasIdx + 1) : spec;
  return afterPrefix.replace(/^[^\d]*/, "");
}

export function majorOf(version: string): number | null {
  const m = /^(\d+)/.exec(normalizeVersionSpec(version));
  return m?.[1] !== undefined ? Number(m[1]) : null;
}

/** Numeric major.minor.patch compare; stops at the first non-numeric segment (a prerelease/build
 *  tag) rather than misreading it as a version component. Returns -1/0/1 like Array.sort. */
export function compareVersions(a: string, b: string): number {
  const pa = normalizeVersionSpec(a).split(/[.\-+]/);
  const pb = normalizeVersionSpec(b).split(/[.\-+]/);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = Number(pa[i] ?? "0");
    const y = Number(pb[i] ?? "0");
    if (Number.isNaN(x) || Number.isNaN(y)) break;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export interface ReleaseAgeNote {
  held: boolean;
  heldUntilMs?: number;
}

/** A newer version published under the 7-day floor reads as "held", not "available" — the
 *  minimumReleaseAge-style annotation (leg c). `publishedAtMs` absent (registry gave no `time`
 *  entry) is treated as "not held" — we'd rather over-report than silently hide a real bump. */
export function releaseAgeNote(
  nowMs: number,
  publishedAtMs: number | undefined,
): ReleaseAgeNote {
  if (publishedAtMs === undefined) return { held: false };
  const heldUntilMs = publishedAtMs + RELEASE_HOLD_MS;
  return nowMs < heldUntilMs ? { held: true, heldUntilMs } : { held: false };
}

// ============================================================================================
// Pure: tracked-dependency table (data) + evaluation
// ============================================================================================

export type ManifestField = "catalog" | "rootDev" | "tsconfigDeps" | "siteDeps";

export interface TrackedDep {
  /** Stable id — used in watch_state keys and dedupKey. */
  key: string;
  label: string;
  /** The npm registry package name to query (tsc-native's alias target is "typescript", same as
   *  the plain typescript dep — both compare against the same registry data, different pins). */
  npmPackage: string;
  /** The key this dep is declared under in its manifest's dependency block. */
  declaredKey: string;
  manifestField: ManifestField;
  /** "major": flag only on a major-version bump (the catalog deps). "any": flag on ANY newer
   *  version (tsc-native and better-auth — exact-pinned lockstep deps where a patch matters). */
  mode: "major" | "any";
}

// Data, not logic (house style — compliance.ts's SOURCES table) — tuning a tracked dep is a
// one-line edit here, not a code change below.
export const TRACKED_DEPS: readonly TrackedDep[] = [
  {
    key: "typescript",
    label: "typescript (API dep)",
    npmPackage: "typescript",
    declaredKey: "typescript",
    manifestField: "catalog",
    mode: "major",
  },
  {
    key: "tsc-native",
    label: "tsc-native (native compiler alias)",
    npmPackage: "typescript",
    declaredKey: "tsc-native",
    manifestField: "tsconfigDeps",
    mode: "any",
  },
  {
    key: "next",
    label: "next",
    npmPackage: "next",
    declaredKey: "next",
    manifestField: "catalog",
    mode: "major",
  },
  {
    key: "zod",
    label: "zod",
    npmPackage: "zod",
    declaredKey: "zod",
    manifestField: "catalog",
    mode: "major",
  },
  {
    key: "turbo",
    label: "turbo",
    npmPackage: "turbo",
    declaredKey: "turbo",
    manifestField: "rootDev",
    mode: "major",
  },
  {
    key: "react",
    label: "react",
    npmPackage: "react",
    declaredKey: "react",
    manifestField: "catalog",
    mode: "major",
  },
  {
    key: "better-auth",
    label: "better-auth (session-adapter lockstep, exact-pinned)",
    npmPackage: "better-auth",
    declaredKey: "better-auth",
    manifestField: "siteDeps",
    mode: "any",
  },
];

export interface DepManifests {
  /** root package.json workspaces.catalog block */
  catalog: Record<string, string>;
  /** root package.json devDependencies (turbo lives here, not the catalog) */
  rootDev: Record<string, string>;
  /** root package.json "packageManager" field, e.g. "bun@1.3.14" */
  rootPackageManager: string | undefined;
  /** tooling/tsconfig/package.json dependencies (carries the tsc-native alias) */
  tsconfigDeps: Record<string, string>;
  /** apps/site/package.json dependencies (carries the exact-pinned better-auth) — not in the
   *  root catalog, fetched separately since leg (b)'s two-manifest scope doesn't cover it. */
  siteDeps: Record<string, string>;
}

export function currentVersionOf(
  dep: TrackedDep,
  manifests: DepManifests,
): string | undefined {
  return manifests[dep.manifestField][dep.declaredKey];
}

export interface NpmPackageInfo {
  latest: string;
  publishedAtMs: number | undefined;
}

export function isDepFlagged(
  dep: TrackedDep,
  currentSpec: string,
  latest: string,
): boolean {
  if (dep.mode === "any") return compareVersions(latest, currentSpec) > 0;
  const curMajor = majorOf(currentSpec);
  const latMajor = majorOf(latest);
  if (curMajor === null || latMajor === null) return false;
  return latMajor > curMajor;
}

export interface TrackedDepEvaluation {
  dep: TrackedDep;
  currentVersion: string;
  latestVersion: string;
  held: boolean;
  heldUntilMs?: number;
}

/** null = not flagged (current, or the current/latest data was unavailable). */
export function evaluateTrackedDep(
  dep: TrackedDep,
  currentSpec: string | undefined,
  npmInfo: NpmPackageInfo | null,
  nowMs: number,
): TrackedDepEvaluation | null {
  if (currentSpec === undefined || npmInfo === null) return null;
  if (!isDepFlagged(dep, currentSpec, npmInfo.latest)) return null;
  const age = releaseAgeNote(nowMs, npmInfo.publishedAtMs);
  return {
    dep,
    currentVersion: normalizeVersionSpec(currentSpec),
    latestVersion: npmInfo.latest,
    held: age.held,
    ...(age.heldUntilMs !== undefined ? { heldUntilMs: age.heldUntilMs } : {}),
  };
}

/** Buyer-impact for one flagged dep: packages/* that declare it directly, and packages/* that
 *  only carry it transitively (via another workspace package or a resolved npm dependency).
 *  `transitiveOnly: null` means the bun.lock leg failed/degraded this run — the direct list is
 *  still trustworthy (it never depended on bun.lock), only the transitive half is unknown. */
export interface BuyerImpact {
  direct: readonly string[];
  transitiveOnly: readonly string[] | null;
}

const MAX_LISTED_PACKAGES = 12;

/** Caps a package list so a Linear description never becomes a wall of names. */
function formatPackageList(names: readonly string[]): string {
  if (names.length <= MAX_LISTED_PACKAGES) return names.join(", ");
  const shown = names.slice(0, MAX_LISTED_PACKAGES).join(", ");
  return `${shown}, and ${String(names.length - MAX_LISTED_PACKAGES)} more`;
}

function buyerImpactNote(impact: BuyerImpact): string {
  const directPart =
    impact.direct.length > 0 ? formatPackageList(impact.direct) : "none";
  const transitivePart =
    impact.transitiveOnly === null
      ? "unavailable this run (bun.lock fetch/parse failed — degraded to direct-only)"
      : impact.transitiveOnly.length > 0
        ? formatPackageList(impact.transitiveOnly)
        : "none";
  return ` Direct: ${directPart} · Transitive-only: ${transitivePart}.`;
}

function depBumpFinding(
  ev: TrackedDepEvaluation,
  impact: BuyerImpact,
): Finding {
  const verb = ev.held ? "held" : "available";
  const heldNote =
    ev.held && ev.heldUntilMs !== undefined
      ? ` (minimumReleaseAge floor lifts ${new Date(ev.heldUntilMs).toISOString().slice(0, 10)})`
      : "";
  const majorNote = ev.dep.mode === "major" ? "major " : "";
  const title =
    `${ev.dep.label}: ${majorNote}update ${verb} (${ev.currentVersion} -> ${ev.latestVersion})`.slice(
      0,
      300,
    );
  const body =
    `${ev.dep.label} is pinned at ${ev.currentVersion}; ${ev.latestVersion} is ${verb}${heldNote}.${buyerImpactNote(impact)}`.slice(
      0,
      10_000,
    );
  return {
    source: "dep-digest",
    kind:
      ev.dep.mode === "major" ? "dep_major_available" : "dep_update_available",
    severity: ev.dep.mode === "major" ? "warning" : "info",
    title,
    body,
    dedupKey: dedupKey("dep-digest", ev.dep.key, ev.latestVersion, verb),
    payload: {
      dep: ev.dep.key,
      current: ev.currentVersion,
      latest: ev.latestVersion,
      held: ev.held,
      ...(ev.heldUntilMs !== undefined ? { heldUntilMs: ev.heldUntilMs } : {}),
      affectedPackages: [...impact.direct],
      transitiveOnlyPackages:
        impact.transitiveOnly === null ? null : [...impact.transitiveOnly],
    },
  };
}

/** watch_state key holding the last-alerted "event id" (`<version>:<held|available>`) per
 *  tracked dep — a stable week (same event id) emits nothing; a version bump OR a held→available
 *  transition for the SAME version is a new event id and re-fires once. */
function depStateKey(depKey: string): string {
  return `dep-digest:dep:${depKey}:alerted`;
}

function eventIdOf(ev: TrackedDepEvaluation): string {
  return `${ev.latestVersion}:${ev.held ? "held" : "available"}`;
}

const EMPTY_IMPACT: BuyerImpact = { direct: [], transitiveOnly: [] };

export function detectDepFindings(
  evaluations: readonly (TrackedDepEvaluation | null)[],
  prevAlerted: Record<string, string>,
  affectedByDep: Readonly<Record<string, BuyerImpact>>,
): { findings: Finding[]; nextState: Record<string, string> } {
  const findings: Finding[] = [];
  const nextState: Record<string, string> = {};
  for (const ev of evaluations) {
    if (ev === null) continue;
    const key = depStateKey(ev.dep.key);
    const eventId = eventIdOf(ev);
    if (prevAlerted[key] === eventId) continue;
    findings.push(
      depBumpFinding(ev, affectedByDep[ev.dep.key] ?? EMPTY_IMPACT),
    );
    nextState[key] = eventId;
  }
  return { findings, nextState };
}

// ============================================================================================
// Pure: bun (GitHub-releases sourced, not npm — kept parallel to TRACKED_DEPS rather than folded
// into it, since its fetch mechanism and current-version source both differ from every npm dep).
// ============================================================================================

export interface BunReleaseInfo {
  tag: string;
  publishedAtMs: number | undefined;
}

const BUN_STATE_KEY = "dep-digest:dep:bun:alerted";

export function detectBunUpdate(
  rootPackageManager: string | undefined,
  release: BunReleaseInfo | null,
  prevAlerted: Record<string, string>,
  nowMs: number,
): { findings: Finding[]; nextState: Record<string, string> } {
  if (rootPackageManager === undefined || release === null) {
    return { findings: [], nextState: {} };
  }
  const current = normalizeVersionSpec(rootPackageManager);
  const latest = normalizeVersionSpec(release.tag);
  if (compareVersions(latest, current) <= 0)
    return { findings: [], nextState: {} };
  const age = releaseAgeNote(nowMs, release.publishedAtMs);
  const eventId = `${latest}:${age.held ? "held" : "available"}`;
  if (prevAlerted[BUN_STATE_KEY] === eventId)
    return { findings: [], nextState: {} };

  const verb = age.held ? "held" : "available";
  const heldNote =
    age.held && age.heldUntilMs !== undefined
      ? ` (minimumReleaseAge floor lifts ${new Date(age.heldUntilMs).toISOString().slice(0, 10)})`
      : "";
  const finding: Finding = {
    source: "dep-digest",
    kind: "dep_update_available",
    severity: "info",
    title: `bun: update ${verb} (${current} -> ${latest})`.slice(0, 300),
    body: `bun is pinned at ${current} (packageManager); ${latest} is ${verb}${heldNote}.`.slice(
      0,
      10_000,
    ),
    dedupKey: dedupKey("dep-digest", "bun", latest, verb),
    payload: {
      dep: "bun",
      current,
      latest,
      held: age.held,
      ...(age.heldUntilMs !== undefined
        ? { heldUntilMs: age.heldUntilMs }
        : {}),
    },
  };
  return { findings: [finding], nextState: { [BUN_STATE_KEY]: eventId } };
}

// ============================================================================================
// Pure: Renovate stalled-PR detection (leg a)
// ============================================================================================

const RENOVATE_LOGIN = "renovate[bot]";

const GithubPrsResponse = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
    created_at: z.string(),
    user: z.object({ login: z.string() }).nullable(),
  }),
);

export interface RenovatePr {
  number: number;
  title: string;
  htmlUrl: string;
  createdAtMs: number;
}

export function parseRenovatePrs(raw: unknown): RenovatePr[] {
  const parsed = GithubPrsResponse.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data
    .filter((pr) => pr.user?.login === RENOVATE_LOGIN)
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      htmlUrl: pr.html_url,
      createdAtMs: Date.parse(pr.created_at),
    }))
    .filter((pr) => Number.isFinite(pr.createdAtMs));
}

function renovatePrStateKey(prNumber: number): string {
  return `dep-digest:renovate-pr:${String(prNumber)}:stalled`;
}

export function detectStalledRenovatePrs(
  prs: readonly RenovatePr[],
  prevAlerted: Record<string, string>,
  nowMs: number,
): { findings: Finding[]; nextState: Record<string, string> } {
  const findings: Finding[] = [];
  const nextState: Record<string, string> = {};
  for (const pr of prs) {
    const ageMs = nowMs - pr.createdAtMs;
    if (ageMs < STALE_PR_MS) continue;
    const key = renovatePrStateKey(pr.number);
    if (prevAlerted[key] === "true") continue; // already alerted once for this PR
    const days = Math.floor(ageMs / DAY_MS);
    findings.push({
      source: "dep-digest",
      kind: "renovate_pr_stalled",
      severity: "warning",
      title:
        `Renovate PR #${String(pr.number)} stalled ${String(days)}d: ${pr.title}`.slice(
          0,
          300,
        ),
      body: `${pr.htmlUrl} has been open ${String(days)} days without merging.`,
      dedupKey: dedupKey("dep-digest", "renovate-pr", String(pr.number)),
      payload: {
        number: pr.number,
        title: pr.title,
        url: pr.htmlUrl,
        ageDays: days,
      },
    });
    nextState[key] = "true";
  }
  return { findings, nextState };
}

// ============================================================================================
// Pure: manifest + buyer-impact-lite parsing (leg d)
// ============================================================================================

const PackageJsonManifest = z.object({
  name: z.string().optional(),
  packageManager: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  workspaces: z
    .object({ catalog: z.record(z.string(), z.string()).optional() })
    .optional(),
});
type PackageJsonManifest = z.infer<typeof PackageJsonManifest>;

export function parsePackageJson(raw: unknown): PackageJsonManifest | null {
  const parsed = PackageJsonManifest.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function buildDepManifests(
  root: PackageJsonManifest | null,
  tsconfigPkg: PackageJsonManifest | null,
  sitePkg: PackageJsonManifest | null,
): DepManifests {
  return {
    catalog: root?.workspaces?.catalog ?? {},
    rootDev: root?.devDependencies ?? {},
    rootPackageManager: root?.packageManager,
    tsconfigDeps: tsconfigPkg?.dependencies ?? {},
    siteDeps: sitePkg?.dependencies ?? {},
  };
}

export interface WorkspacePackageManifest {
  name: string;
  deps: Set<string>;
}

export function toWorkspacePackageManifest(
  raw: unknown,
): WorkspacePackageManifest | null {
  const parsed = PackageJsonManifest.safeParse(raw);
  if (!parsed.success || parsed.data.name === undefined) return null;
  const deps = new Set<string>([
    ...Object.keys(parsed.data.dependencies ?? {}),
    ...Object.keys(parsed.data.devDependencies ?? {}),
    ...Object.keys(parsed.data.peerDependencies ?? {}),
  ]);
  return { name: parsed.data.name, deps };
}

/** Which workspace packages DIRECTLY declare `declaredKey` — v1 scope is direct-only (documented
 *  in every finding's body); a transitive resolver is real work with little weekly-digest value. */
export function affectedPackagesFor(
  declaredKey: string,
  manifests: readonly WorkspacePackageManifest[],
): string[] {
  return manifests
    .filter((m) => m.deps.has(declaredKey))
    .map((m) => m.name)
    .sort();
}

// ============================================================================================
// Pure: bun.lock parsing + transitive workspace-reachability (leg d, v2)
// ============================================================================================

/** bun.lock is plain JSON plus trailing commas before `}`/`]` (no comments observed in this
 *  repo's lockfile) — stripping exactly that is enough to hand it to `JSON.parse`. A real JSONC
 *  parser is more than this needs; if bun ever starts emitting comments, this degrades to the
 *  null return below (caught by the failure-tolerant leg, never a throw). */
export function parseBunLockText(raw: string): unknown | null {
  try {
    return JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
}

const LockWorkspaceEntry = z
  .object({
    name: z.string().optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const LockPackageMeta = z
  .object({
    dependencies: z.record(z.string(), z.string()).optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const LockFileSchema = z
  .object({
    workspaces: z.record(z.string(), LockWorkspaceEntry),
    packages: z.record(z.string(), z.array(z.unknown()).min(1)),
  })
  .passthrough();

/** Same buyer-impact scope as v1's direct leg — `packages/<name>` only, never `apps/*` or
 *  `tooling/*`. */
const PACKAGES_WORKSPACE_RE = /^packages\/[^/]+$/;

export interface WorkspaceReachability {
  /** Every graph node's direct dependency names, keyed by the name other nodes reference it by
   *  (a workspace's own package name, or an npm package's — possibly aliased, e.g. "tsc-native" —
   *  bun.lock key). One shared keyspace: workspace-to-workspace and npm-resolved edges both land
   *  here, so a single reverse walk crosses both without special-casing. */
  edges: ReadonlyMap<string, ReadonlySet<string>>;
  /** The subset of node names that are packages/* workspace packages (the buyer-facing set). */
  scopedWorkspaceNames: ReadonlySet<string>;
}

function depNamesOf(rec: Record<string, string> | undefined): string[] {
  return rec === undefined ? [] : Object.keys(rec);
}

/** Parses a decoded bun.lock JSON value into the name-keyed dependency graph. Returns null on any
 *  shape mismatch (a lockfile format change) rather than throwing — the caller degrades to
 *  direct-only. */
export function buildWorkspaceReachability(
  raw: unknown,
): WorkspaceReachability | null {
  const parsed = LockFileSchema.safeParse(raw);
  if (!parsed.success) return null;

  const edges = new Map<string, Set<string>>();
  const scopedWorkspaceNames = new Set<string>();

  for (const [path, entry] of Object.entries(parsed.data.workspaces)) {
    if (entry.name === undefined) continue;
    edges.set(
      entry.name,
      new Set([
        ...depNamesOf(entry.dependencies),
        ...depNamesOf(entry.devDependencies),
        ...depNamesOf(entry.peerDependencies),
      ]),
    );
    if (PACKAGES_WORKSPACE_RE.test(path)) scopedWorkspaceNames.add(entry.name);
  }

  for (const [key, tuple] of Object.entries(parsed.data.packages)) {
    if (edges.has(key)) continue; // a workspace already supplied this name's edges above.
    const meta = LockPackageMeta.safeParse(tuple[2]);
    if (!meta.success) continue; // a bare `["name@workspace:path"]` entry (no meta) — skip.
    edges.set(
      key,
      new Set([
        ...depNamesOf(meta.data.dependencies),
        ...depNamesOf(meta.data.optionalDependencies),
        ...depNamesOf(meta.data.peerDependencies),
      ]),
    );
  }

  return { edges, scopedWorkspaceNames };
}

/** Which packages/* workspace packages have `declaredKey` anywhere in their dependency closure —
 *  a reverse BFS from the flagged dep's name over the inverted edge graph. Includes packages that
 *  declare it directly too; the caller subtracts the direct set to get "transitive-only". */
export function transitiveWorkspaceReach(
  reach: WorkspaceReachability,
  declaredKey: string,
): string[] {
  const reverse = new Map<string, Set<string>>();
  for (const [parent, children] of reach.edges) {
    for (const child of children) {
      let parents = reverse.get(child);
      if (parents === undefined) {
        parents = new Set();
        reverse.set(child, parents);
      }
      parents.add(parent);
    }
  }

  const visited = new Set<string>([declaredKey]);
  const queue: string[] = [declaredKey];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) break;
    for (const parent of reverse.get(cur) ?? []) {
      if (visited.has(parent)) continue;
      visited.add(parent);
      queue.push(parent);
    }
  }
  visited.delete(declaredKey);

  return [...visited]
    .filter((name) => reach.scopedWorkspaceNames.has(name))
    .sort();
}

/** Builds the direct + transitive-only `BuyerImpact` for one flagged dep. `reach === null` means
 *  the bun.lock leg is degraded — transitive-only is reported unavailable, never guessed. */
export function buyerImpactFor(
  declaredKey: string,
  direct: readonly string[],
  reach: WorkspaceReachability | null,
): BuyerImpact {
  if (reach === null) return { direct, transitiveOnly: null };
  const directSet = new Set(direct);
  const transitiveOnly = transitiveWorkspaceReach(reach, declaredKey).filter(
    (name) => !directSet.has(name),
  );
  return { direct, transitiveOnly };
}

// ============================================================================================
// Pure: registry-response parsing
// ============================================================================================

const NpmRegistryResponse = z.object({
  "dist-tags": z.object({ latest: z.string() }),
  time: z.record(z.string(), z.string()).optional(),
});

export function parseNpmRegistryResponse(raw: unknown): NpmPackageInfo | null {
  const parsed = NpmRegistryResponse.safeParse(raw);
  if (!parsed.success) return null;
  const latest = parsed.data["dist-tags"].latest;
  const publishedRaw = parsed.data.time?.[latest];
  const publishedAtMs =
    publishedRaw !== undefined ? Date.parse(publishedRaw) : NaN;
  return {
    latest,
    publishedAtMs: Number.isFinite(publishedAtMs) ? publishedAtMs : undefined,
  };
}

const BunReleaseResponse = z.object({
  tag_name: z.string(),
  published_at: z.string(),
});

export function parseBunRelease(raw: unknown): BunReleaseInfo | null {
  const parsed = BunReleaseResponse.safeParse(raw);
  if (!parsed.success) return null;
  const publishedAtMs = Date.parse(parsed.data.published_at);
  return {
    tag: parsed.data.tag_name,
    publishedAtMs: Number.isFinite(publishedAtMs) ? publishedAtMs : undefined,
  };
}

// ============================================================================================
// Impure: fetch helpers
// ============================================================================================

function githubHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "caisson-intel",
    "x-github-api-version": "2022-11-28",
  };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return headers;
}

const GithubContentsFile = z.object({
  content: z.string(),
  encoding: z.string(),
});

/** Fetch one file's decoded text body via the GitHub contents API — never a local path, the
 *  daemon is containerized and does not carry this repo's working tree. */
async function fetchGithubTextFile(
  fetchImpl: Fetcher,
  org: string,
  repo: string,
  path: string,
  token: string | undefined,
): Promise<string> {
  const raw = await fetchJson<unknown>(
    fetchImpl,
    `https://api.github.com/repos/${org}/${repo}/contents/${path}`,
    { headers: githubHeaders(token) },
  );
  const parsed = GithubContentsFile.safeParse(raw);
  if (!parsed.success || parsed.data.encoding !== "base64") {
    throw new Error(`unexpected contents-API response shape for ${path}`);
  }
  return Buffer.from(parsed.data.content, "base64").toString("utf8");
}

async function fetchGithubJsonFile(
  fetchImpl: Fetcher,
  org: string,
  repo: string,
  path: string,
  token: string | undefined,
): Promise<unknown> {
  return JSON.parse(
    await fetchGithubTextFile(fetchImpl, org, repo, path, token),
  );
}

/** Fetches + parses `bun.lock` into the transitive-reachability graph (leg d, v2). Failure-
 *  tolerant by design: any fetch error, an unparseable lockfile, or an unexpected shape all
 *  collapse to `null` — the caller degrades to v1 direct-only rather than losing the whole leg. */
async function fetchWorkspaceReachability(
  fetchImpl: Fetcher,
  org: string,
  repo: string,
  token: string | undefined,
): Promise<WorkspaceReachability | null> {
  try {
    const text = await fetchGithubTextFile(
      fetchImpl,
      org,
      repo,
      "bun.lock",
      token,
    );
    const json = parseBunLockText(text);
    return json === null ? null : buildWorkspaceReachability(json);
  } catch {
    return null;
  }
}

async function fetchOpenPrsRaw(
  fetchImpl: Fetcher,
  org: string,
  repo: string,
  token: string | undefined,
): Promise<unknown> {
  return fetchJson<unknown>(
    fetchImpl,
    `https://api.github.com/repos/${org}/${repo}/pulls?state=open&per_page=100`,
    { headers: githubHeaders(token) },
  );
}

const GitTreeResponse = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});

const PACKAGES_MANIFEST_RE = /^packages\/[^/]+\/package\.json$/;

async function fetchPackagesManifestPaths(
  fetchImpl: Fetcher,
  org: string,
  repo: string,
  branch: string,
  token: string | undefined,
): Promise<string[]> {
  const raw = await fetchJson<unknown>(
    fetchImpl,
    `https://api.github.com/repos/${org}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: githubHeaders(token) },
  );
  const parsed = GitTreeResponse.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.tree
    .filter((e) => e.type === "blob" && PACKAGES_MANIFEST_RE.test(e.path))
    .map((e) => e.path);
}

async function fetchNpmInfo(
  fetchImpl: Fetcher,
  pkgName: string,
): Promise<NpmPackageInfo | null> {
  try {
    const raw = await fetchJson<unknown>(
      fetchImpl,
      `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`,
    );
    return parseNpmRegistryResponse(raw);
  } catch {
    return null;
  }
}

async function fetchBunRelease(
  fetchImpl: Fetcher,
): Promise<BunReleaseInfo | null> {
  try {
    const raw = await fetchJson<unknown>(
      fetchImpl,
      "https://api.github.com/repos/oven-sh/bun/releases/latest",
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "caisson-intel",
        },
      },
    );
    return parseBunRelease(raw);
  } catch {
    return null;
  }
}

// ============================================================================================
// The Linear-draft alert path (mirrors error-triage.ts's use of buildAlertChannels, minus the
// incident/rate-cap/quiet-hours machinery — watch_state dedup above already guarantees each
// event alerts once).
// ============================================================================================

export function depDigestFindingToAlertEvent(
  finding: Finding,
  nowMs: number,
): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: "intel.dep_digest",
    severity: finding.severity,
    tenantId: "operator",
    recipient: "operator",
    dedupeKey: finding.dedupKey.slice(0, 200),
    title: finding.title.slice(0, 200),
    body: finding.body.slice(0, 5000),
    createdAt: nowMs,
  };
}

async function alertOnFindings(
  findings: readonly Finding[],
  channels: readonly AlertChannel[],
  nowMs: number,
  logger: WatcherCtx["logger"],
): Promise<void> {
  if (findings.length === 0 || channels.length === 0) return;
  const auditSink = createInMemoryAuditSink();
  for (const finding of findings) {
    try {
      await deliverImmediate(
        depDigestFindingToAlertEvent(finding, nowMs),
        channels,
        auditSink,
        new Date(nowMs),
      );
    } catch (err) {
      logger.warn("dep-digest: alert delivery failed for one finding", {
        dedupKey: finding.dedupKey,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ============================================================================================
// The watcher
// ============================================================================================

export const depDigestWatcher: Watcher = {
  name: "dep-digest",
  cadenceMs: (config) => config.cadenceDepDigestMs,
  async run(ctx: WatcherCtx): Promise<Finding[]> {
    const { config, fetchImpl, store, now, logger } = ctx;
    const org = config.githubOrg;
    const token = config.githubToken;
    const nowMs = now();
    const findings: Finding[] = [];

    // Leg (a): Renovate PRs stalled > 14 days.
    try {
      const prs = parseRenovatePrs(
        await fetchOpenPrsRaw(fetchImpl, org, REPO_NAME, token),
      );
      const prevPrState = await store.getWatchState(
        prs.map((pr) => renovatePrStateKey(pr.number)),
      );
      const { findings: prFindings, nextState } = detectStalledRenovatePrs(
        prs,
        prevPrState,
        nowMs,
      );
      findings.push(...prFindings);
      if (Object.keys(nextState).length > 0)
        await store.setWatchState(nextState);
    } catch (err) {
      logger.warn("dep-digest: renovate PR leg failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // Legs (b)+(c)+(d)+bun: toolchain/pinned-dep watch, release-age annotation, buyer-impact.
    try {
      const [rootRaw, tsconfigRaw, siteRaw] = await Promise.all([
        fetchGithubJsonFile(fetchImpl, org, REPO_NAME, "package.json", token),
        fetchGithubJsonFile(
          fetchImpl,
          org,
          REPO_NAME,
          "tooling/tsconfig/package.json",
          token,
        ),
        fetchGithubJsonFile(
          fetchImpl,
          org,
          REPO_NAME,
          "apps/site/package.json",
          token,
        ),
      ]);
      const manifests = buildDepManifests(
        parsePackageJson(rootRaw),
        parsePackageJson(tsconfigRaw),
        parsePackageJson(siteRaw),
      );

      const uniqueNpmPackages = [
        ...new Set(TRACKED_DEPS.map((d) => d.npmPackage)),
      ];
      const npmInfoByPackage = new Map(
        await Promise.all(
          uniqueNpmPackages.map(
            async (pkg) => [pkg, await fetchNpmInfo(fetchImpl, pkg)] as const,
          ),
        ),
      );
      const evaluations = TRACKED_DEPS.map((dep) =>
        evaluateTrackedDep(
          dep,
          currentVersionOf(dep, manifests),
          npmInfoByPackage.get(dep.npmPackage) ?? null,
          nowMs,
        ),
      );
      const flagged = evaluations.filter(
        (e): e is TrackedDepEvaluation => e !== null,
      );

      // buyer-impact only fires the git-trees fan-out + bun.lock fetch when something is
      // actually flagged — a quiet week makes zero extra GitHub calls beyond the two manifests.
      let affectedByDep: Record<string, BuyerImpact> = {};
      if (flagged.length > 0) {
        let directByDep: Record<string, readonly string[]> = {};
        try {
          const paths = await fetchPackagesManifestPaths(
            fetchImpl,
            org,
            REPO_NAME,
            DEFAULT_BRANCH,
            token,
          );
          const workspaceManifests: WorkspacePackageManifest[] = [];
          for (const path of paths) {
            try {
              const parsed = toWorkspacePackageManifest(
                await fetchGithubJsonFile(
                  fetchImpl,
                  org,
                  REPO_NAME,
                  path,
                  token,
                ),
              );
              if (parsed !== null) workspaceManifests.push(parsed);
            } catch {
              // one package's manifest fetch failing must not drop the rest of the fan-out.
            }
          }
          directByDep = Object.fromEntries(
            flagged.map((e) => [
              e.dep.key,
              affectedPackagesFor(e.dep.declaredKey, workspaceManifests),
            ]),
          );
        } catch (err) {
          logger.warn(
            "dep-digest: direct buyer-impact leg failed — findings will omit direct packages",
            { err: err instanceof Error ? err.message : String(err) },
          );
        }

        // The transitive half is a separate try: a bun.lock hiccup degrades findings to
        // direct-only (per depBumpFinding's `transitiveOnly: null` note) rather than dropping
        // the direct list this leg just computed above.
        let reach: WorkspaceReachability | null = null;
        try {
          reach = await fetchWorkspaceReachability(
            fetchImpl,
            org,
            REPO_NAME,
            token,
          );
        } catch (err) {
          logger.warn(
            "dep-digest: transitive buyer-impact leg failed — degrading to direct-only",
            { err: err instanceof Error ? err.message : String(err) },
          );
        }

        affectedByDep = Object.fromEntries(
          flagged.map((e) => [
            e.dep.key,
            buyerImpactFor(
              e.dep.declaredKey,
              directByDep[e.dep.key] ?? [],
              reach,
            ),
          ]),
        );
      }

      const prevDepState = await store.getWatchState(
        TRACKED_DEPS.map((d) => depStateKey(d.key)),
      );
      const { findings: depFindings, nextState: depNextState } =
        detectDepFindings(evaluations, prevDepState, affectedByDep);
      findings.push(...depFindings);
      if (Object.keys(depNextState).length > 0) {
        await store.setWatchState(depNextState);
      }

      // bun — same manifest fetch above supplies its current version; its release lookup is its
      // own try so a GitHub-releases hiccup alone doesn't take down the catalog-dep evaluation.
      try {
        const release = await fetchBunRelease(fetchImpl);
        const prevBunState = await store.getWatchState([BUN_STATE_KEY]);
        const { findings: bunFindings, nextState: bunNextState } =
          detectBunUpdate(
            manifests.rootPackageManager,
            release,
            prevBunState,
            nowMs,
          );
        findings.push(...bunFindings);
        if (Object.keys(bunNextState).length > 0) {
          await store.setWatchState(bunNextState);
        }
      } catch (err) {
        logger.warn("dep-digest: bun release leg failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    } catch (err) {
      logger.warn("dep-digest: toolchain/pinned-dep leg failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    await alertOnFindings(
      findings,
      buildAlertChannels(config, fetchImpl),
      nowMs,
      logger,
    );
    return findings;
  },
};
