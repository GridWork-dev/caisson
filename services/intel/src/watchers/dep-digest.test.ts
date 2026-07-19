import { describe, expect, test } from "bun:test";
import {
  TRACKED_DEPS,
  affectedPackagesFor,
  buildDepManifests,
  buildWorkspaceReachability,
  buyerImpactFor,
  compareVersions,
  currentVersionOf,
  depDigestFindingToAlertEvent,
  depDigestWatcher,
  detectBunUpdate,
  detectDepFindings,
  detectStalledRenovatePrs,
  evaluateTrackedDep,
  isDepFlagged,
  majorOf,
  normalizeVersionSpec,
  parseBunLockText,
  parseBunRelease,
  parseNpmRegistryResponse,
  parsePackageJson,
  parseRenovatePrs,
  releaseAgeNote,
  toWorkspacePackageManifest,
  transitiveWorkspaceReach,
} from "./dep-digest.ts";
import type {
  NpmPackageInfo,
  TrackedDep,
  TrackedDepEvaluation,
  WorkspaceReachability,
} from "./dep-digest.ts";
import { logger } from "../logger.ts";
import { InMemoryStore } from "../store.ts";
import type { Config } from "../config.ts";
import type { Fetcher } from "../http.ts";
import type { WatcherCtx } from "./types.ts";

const DAY = 24 * 3_600_000;

/** TRACKED_DEPS.find(...) returns `T | undefined`; a guard-then-throw in the same statement list
 *  doesn't narrow the type across the closures below (test()/describe() callbacks), so pull the
 *  narrowing into a helper with an explicit non-undefined return type instead. */
function mustFindDep(key: string): TrackedDep {
  const dep = TRACKED_DEPS.find((d) => d.key === key);
  if (!dep) throw new Error(`fixture dep "${key}" missing from TRACKED_DEPS`);
  return dep;
}

describe("normalizeVersionSpec / majorOf / compareVersions", () => {
  test("strips ^ / ~ / v prefixes", () => {
    expect(normalizeVersionSpec("^6.0.3")).toBe("6.0.3");
    expect(normalizeVersionSpec("~4.0.0")).toBe("4.0.0");
    expect(normalizeVersionSpec("v1.6.23")).toBe("1.6.23");
    expect(normalizeVersionSpec("1.6.23")).toBe("1.6.23");
  });

  test("resolves the npm: alias form to the aliased version", () => {
    expect(normalizeVersionSpec("npm:typescript@7.0.2")).toBe("7.0.2");
  });

  test("resolves a packageManager-style spec (bun@1.3.14)", () => {
    expect(normalizeVersionSpec("bun@1.3.14")).toBe("1.3.14");
  });

  test("resolves a GitHub release tag prefix (bun-v1.3.20)", () => {
    expect(normalizeVersionSpec("bun-v1.3.20")).toBe("1.3.20");
  });

  test("majorOf reads the leading integer", () => {
    expect(majorOf("^6.0.3")).toBe(6);
    expect(majorOf("npm:typescript@7.0.2")).toBe(7);
  });

  test("compareVersions orders numerically, not lexically (10 > 9)", () => {
    expect(compareVersions("10.0.0", "9.0.0")).toBe(1);
    expect(compareVersions("1.2.0", "1.10.0")).toBe(-1);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  test("stops at a prerelease tag rather than misreading it numerically", () => {
    expect(compareVersions("2.0.0-beta.1", "1.9.9")).toBe(1);
  });
});

describe("releaseAgeNote", () => {
  const now = 1_000_000_000;
  test("a version published within the last 7 days is held", () => {
    const note = releaseAgeNote(now, now - 1 * DAY);
    expect(note.held).toBe(true);
    expect(note.heldUntilMs).toBe(now - 1 * DAY + 7 * DAY);
  });

  test("a version published 7+ days ago is not held", () => {
    expect(releaseAgeNote(now, now - 8 * DAY).held).toBe(false);
  });

  test("no publish timestamp means not held (over-report rather than hide)", () => {
    expect(releaseAgeNote(now, undefined)).toEqual({ held: false });
  });
});

describe("isDepFlagged / evaluateTrackedDep", () => {
  const majorDep = mustFindDep("zod");
  const anyDep = mustFindDep("better-auth");

  test("major mode flags only on a major bump", () => {
    expect(isDepFlagged(majorDep, "^4.0.0", "4.5.0")).toBe(false);
    expect(isDepFlagged(majorDep, "^4.0.0", "5.0.0")).toBe(true);
  });

  test("any mode flags on any newer version, including a patch", () => {
    expect(isDepFlagged(anyDep, "1.6.23", "1.6.24")).toBe(true);
    expect(isDepFlagged(anyDep, "1.6.23", "1.6.23")).toBe(false);
    expect(isDepFlagged(anyDep, "1.6.23", "1.6.22")).toBe(false);
  });

  test("evaluateTrackedDep returns null when nothing is flagged", () => {
    const info: NpmPackageInfo = { latest: "4.0.0", publishedAtMs: undefined };
    expect(evaluateTrackedDep(majorDep, "^4.0.0", info, 0)).toBeNull();
  });

  test("evaluateTrackedDep returns null when current or npm data is missing", () => {
    expect(evaluateTrackedDep(majorDep, undefined, null, 0)).toBeNull();
    expect(evaluateTrackedDep(majorDep, "^4.0.0", null, 0)).toBeNull();
  });

  test("evaluateTrackedDep flags + carries the held annotation through", () => {
    const now = 1_000_000_000;
    const info: NpmPackageInfo = {
      latest: "5.0.0",
      publishedAtMs: now - 1 * DAY,
    };
    const ev = evaluateTrackedDep(majorDep, "^4.0.0", info, now);
    expect(ev?.held).toBe(true);
    expect(ev?.currentVersion).toBe("4.0.0");
    expect(ev?.latestVersion).toBe("5.0.0");
  });
});

describe("detectDepFindings", () => {
  const dep = mustFindDep("zod");

  function evalOf(held: boolean): TrackedDepEvaluation {
    return held
      ? {
          dep,
          currentVersion: "4.0.0",
          latestVersion: "5.0.0",
          held: true,
          heldUntilMs: 999,
        }
      : { dep, currentVersion: "4.0.0", latestVersion: "5.0.0", held: false };
  }

  test("a fresh event emits a finding and records watch_state", () => {
    const { findings, nextState } = detectDepFindings([evalOf(false)], {}, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]?.source).toBe("dep-digest");
    expect(findings[0]?.kind).toBe("dep_major_available");
    expect(nextState["dep-digest:dep:zod:alerted"]).toBe("5.0.0:available");
  });

  test("the same event against stored state emits nothing (no weekly repeat)", () => {
    const { findings, nextState } = detectDepFindings(
      [evalOf(false)],
      { "dep-digest:dep:zod:alerted": "5.0.0:available" },
      {},
    );
    expect(findings).toEqual([]);
    expect(nextState).toEqual({});
  });

  test("a held->available transition for the SAME version re-fires once", () => {
    const { findings } = detectDepFindings(
      [evalOf(false)],
      { "dep-digest:dep:zod:alerted": "5.0.0:held" },
      {},
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("available");
  });

  test("null evaluations (nothing flagged) are skipped", () => {
    expect(detectDepFindings([null], {}, {}).findings).toEqual([]);
  });

  test("direct + transitive-only packages ride the payload when supplied", () => {
    const { findings } = detectDepFindings(
      [evalOf(false)],
      {},
      {
        zod: {
          direct: ["@caisson/kernel", "@caisson/ui"],
          transitiveOnly: ["@caisson/audit-worm"],
        },
      },
    );
    expect(findings[0]?.payload.affectedPackages).toEqual([
      "@caisson/kernel",
      "@caisson/ui",
    ]);
    expect(findings[0]?.payload.transitiveOnlyPackages).toEqual([
      "@caisson/audit-worm",
    ]);
    expect(findings[0]?.body).toContain("@caisson/kernel");
    expect(findings[0]?.body).toContain("@caisson/audit-worm");
  });

  test("a null transitiveOnly (bun.lock leg degraded) notes it as unavailable, not empty", () => {
    const { findings } = detectDepFindings(
      [evalOf(false)],
      {},
      { zod: { direct: ["@caisson/kernel"], transitiveOnly: null } },
    );
    expect(findings[0]?.payload.transitiveOnlyPackages).toBeNull();
    expect(findings[0]?.body).toContain("unavailable this run");
  });
});

describe("detectBunUpdate", () => {
  const now = 1_000_000_000;

  test("no finding when bun is already current", () => {
    const { findings } = detectBunUpdate(
      "bun@1.3.14",
      { tag: "bun-v1.3.14", publishedAtMs: now - 10 * DAY },
      {},
      now,
    );
    expect(findings).toEqual([]);
  });

  test("a newer release emits a finding, held-annotated inside the 7-day floor", () => {
    const { findings, nextState } = detectBunUpdate(
      "bun@1.3.14",
      { tag: "bun-v1.3.20", publishedAtMs: now - 1 * DAY },
      {},
      now,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("held");
    expect(nextState["dep-digest:dep:bun:alerted"]).toBe("1.3.20:held");
  });

  test("missing packageManager or release data yields nothing", () => {
    expect(detectBunUpdate(undefined, null, {}, now).findings).toEqual([]);
  });

  test("the same event dedups against watch_state", () => {
    const { findings } = detectBunUpdate(
      "bun@1.3.14",
      { tag: "bun-v1.3.20", publishedAtMs: now - 10 * DAY },
      { "dep-digest:dep:bun:alerted": "1.3.20:available" },
      now,
    );
    expect(findings).toEqual([]);
  });
});

describe("parseRenovatePrs / detectStalledRenovatePrs", () => {
  const now = 1_000_000_000;

  test("parseRenovatePrs keeps only renovate[bot]-authored PRs", () => {
    const raw = [
      {
        number: 1,
        title: "chore(deps): bump zod",
        html_url: "https://github.com/x/y/pull/1",
        created_at: new Date(now - 20 * DAY).toISOString(),
        user: { login: "renovate[bot]" },
      },
      {
        number: 2,
        title: "a human PR",
        html_url: "https://github.com/x/y/pull/2",
        created_at: new Date(now).toISOString(),
        user: { login: "someone" },
      },
    ];
    const prs = parseRenovatePrs(raw);
    expect(prs).toHaveLength(1);
    expect(prs[0]?.number).toBe(1);
  });

  test("returns [] on an unexpected shape rather than throwing", () => {
    expect(parseRenovatePrs({ not: "an array" })).toEqual([]);
  });

  test("a PR open under 14 days emits nothing", () => {
    const { findings } = detectStalledRenovatePrs(
      [
        {
          number: 1,
          title: "t",
          htmlUrl: "u",
          createdAtMs: now - 5 * DAY,
        },
      ],
      {},
      now,
    );
    expect(findings).toEqual([]);
  });

  test("a PR stalled 14+ days emits a finding once, then dedups", () => {
    const stalePr = {
      number: 7,
      title: "chore(deps): bump next",
      htmlUrl: "https://x/pull/7",
      createdAtMs: now - 20 * DAY,
    };
    const first = detectStalledRenovatePrs([stalePr], {}, now);
    expect(first.findings).toHaveLength(1);
    expect(first.findings[0]?.severity).toBe("warning");
    expect(first.nextState["dep-digest:renovate-pr:7:stalled"]).toBe("true");

    const second = detectStalledRenovatePrs(
      [stalePr],
      { "dep-digest:renovate-pr:7:stalled": "true" },
      now,
    );
    expect(second.findings).toEqual([]);
  });
});

describe("manifest parsing + buyer-impact-lite", () => {
  test("parsePackageJson + buildDepManifests wires the catalog/dev/tsconfig/site fields", () => {
    const root = parsePackageJson({
      packageManager: "bun@1.3.14",
      devDependencies: { turbo: "~2.10.0" },
      workspaces: { catalog: { zod: "^4.0.0" } },
    });
    const tsconfigPkg = parsePackageJson({
      dependencies: { "tsc-native": "npm:typescript@7.0.2" },
    });
    const sitePkg = parsePackageJson({
      dependencies: { "better-auth": "1.6.23" },
    });
    const manifests = buildDepManifests(root, tsconfigPkg, sitePkg);
    expect(manifests.catalog.zod).toBe("^4.0.0");
    expect(manifests.rootDev.turbo).toBe("~2.10.0");
    expect(manifests.rootPackageManager).toBe("bun@1.3.14");
    expect(manifests.tsconfigDeps["tsc-native"]).toBe("npm:typescript@7.0.2");
    expect(manifests.siteDeps["better-auth"]).toBe("1.6.23");

    const zodDep = TRACKED_DEPS.find((d) => d.key === "zod");
    if (!zodDep) throw new Error("zod missing from TRACKED_DEPS");
    expect(currentVersionOf(zodDep, manifests)).toBe("^4.0.0");
  });

  test("a malformed manifest parses to null rather than throwing", () => {
    expect(parsePackageJson({ dependencies: "not an object" })).toBeNull();
  });

  test("toWorkspacePackageManifest unions dependencies/devDependencies/peerDependencies", () => {
    const m = toWorkspacePackageManifest({
      name: "@caisson/kernel",
      dependencies: { zod: "^4.0.0" },
      devDependencies: { turbo: "~2.10.0" },
    });
    expect(m?.name).toBe("@caisson/kernel");
    expect(m?.deps.has("zod")).toBe(true);
    expect(m?.deps.has("turbo")).toBe(true);
  });

  test("affectedPackagesFor lists only packages declaring the key directly, sorted", () => {
    const manifests = [
      toWorkspacePackageManifest({
        name: "@caisson/ui",
        dependencies: { zod: "^4.0.0" },
      }),
      toWorkspacePackageManifest({
        name: "@caisson/kernel",
        dependencies: { zod: "^4.0.0" },
      }),
      toWorkspacePackageManifest({ name: "@caisson/no-zod", dependencies: {} }),
    ].filter((m): m is NonNullable<typeof m> => m !== null);
    expect(affectedPackagesFor("zod", manifests)).toEqual([
      "@caisson/kernel",
      "@caisson/ui",
    ]);
  });
});

describe("bun.lock parsing + transitive workspace-reachability", () => {
  test("parseBunLockText tolerates bun.lock's trailing commas", () => {
    const text = `{
      "lockfileVersion": 1,
      "workspaces": {
        "": { "name": "root", },
      },
      "packages": {},
    }`;
    const parsed = parseBunLockText(text) as {
      workspaces: { "": { name: string } };
    };
    expect(parsed.workspaces[""].name).toBe("root");
  });

  test("parseBunLockText returns null on genuinely broken JSON rather than throwing", () => {
    expect(parseBunLockText("{ not json at all")).toBeNull();
  });

  // Fixture graph: kernel declares zod directly; ui pulls it only via workspace:kernel; wrapper
  // pulls it only via an external npm package's resolved dependency; apps/site declares it
  // directly too but sits outside the packages/* buyer scope entirely.
  const FIXTURE_LOCK = {
    workspaces: {
      "packages/kernel": {
        name: "@caisson/kernel",
        dependencies: { zod: "^4.0.0" },
      },
      "packages/ui": {
        name: "@caisson/ui",
        dependencies: { "@caisson/kernel": "workspace:*" },
      },
      "packages/wrapper": {
        name: "@caisson/wrapper",
        dependencies: { "some-npm-lib": "^1.0.0" },
      },
      "apps/site": {
        name: "@caisson/site",
        dependencies: { zod: "^4.0.0" },
      },
    },
    packages: {
      "@caisson/kernel": ["@caisson/kernel@workspace:packages/kernel"],
      "@caisson/ui": ["@caisson/ui@workspace:packages/ui"],
      "@caisson/wrapper": ["@caisson/wrapper@workspace:packages/wrapper"],
      "@caisson/site": ["@caisson/site@workspace:apps/site"],
      zod: ["zod@4.4.3", "", {}, "sha512-x"],
      "some-npm-lib": [
        "some-npm-lib@1.0.0",
        "",
        { dependencies: { zod: "^4.0.0" } },
        "sha512-y",
      ],
    },
  };

  test("buildWorkspaceReachability scopes to packages/* and reads dependency-name edges", () => {
    const reach = buildWorkspaceReachability(FIXTURE_LOCK);
    expect(reach?.scopedWorkspaceNames.has("@caisson/kernel")).toBe(true);
    expect(reach?.scopedWorkspaceNames.has("@caisson/site")).toBe(false); // apps/* excluded
    expect(reach?.edges.get("@caisson/kernel")?.has("zod")).toBe(true);
    expect(reach?.edges.get("some-npm-lib")?.has("zod")).toBe(true);
  });

  test("buildWorkspaceReachability returns null on an unexpected shape", () => {
    expect(buildWorkspaceReachability({ nope: true })).toBeNull();
  });

  test("transitiveWorkspaceReach crosses both workspace-to-workspace and npm-resolved edges", () => {
    const reach = buildWorkspaceReachability(
      FIXTURE_LOCK,
    ) as WorkspaceReachability;
    expect(transitiveWorkspaceReach(reach, "zod")).toEqual([
      "@caisson/kernel",
      "@caisson/ui",
      "@caisson/wrapper",
    ]);
  });

  test("buyerImpactFor splits direct vs transitive-only", () => {
    const reach = buildWorkspaceReachability(
      FIXTURE_LOCK,
    ) as WorkspaceReachability;
    const impact = buyerImpactFor("zod", ["@caisson/kernel"], reach);
    expect(impact.direct).toEqual(["@caisson/kernel"]);
    expect(impact.transitiveOnly).toEqual(["@caisson/ui", "@caisson/wrapper"]);
  });

  test("buyerImpactFor with reach=null (degraded) reports transitiveOnly as null, not empty", () => {
    const impact = buyerImpactFor("zod", ["@caisson/kernel"], null);
    expect(impact).toEqual({
      direct: ["@caisson/kernel"],
      transitiveOnly: null,
    });
  });
});

describe("registry response parsing", () => {
  test("parseNpmRegistryResponse reads dist-tags.latest + its publish time", () => {
    const info = parseNpmRegistryResponse({
      "dist-tags": { latest: "5.0.0" },
      time: { "5.0.0": "2026-07-01T00:00:00.000Z" },
    });
    expect(info?.latest).toBe("5.0.0");
    expect(info?.publishedAtMs).toBe(Date.parse("2026-07-01T00:00:00.000Z"));
  });

  test("a missing time entry yields publishedAtMs undefined, not a throw", () => {
    const info = parseNpmRegistryResponse({ "dist-tags": { latest: "5.0.0" } });
    expect(info?.publishedAtMs).toBeUndefined();
  });

  test("an unexpected shape returns null", () => {
    expect(parseNpmRegistryResponse({ nope: true })).toBeNull();
  });

  test("parseBunRelease reads tag_name + published_at", () => {
    const info = parseBunRelease({
      tag_name: "bun-v1.3.20",
      published_at: "2026-07-10T00:00:00.000Z",
    });
    expect(info?.tag).toBe("bun-v1.3.20");
    expect(info?.publishedAtMs).toBe(Date.parse("2026-07-10T00:00:00.000Z"));
  });
});

describe("depDigestFindingToAlertEvent", () => {
  test("caps title/body/dedupeKey to the alerting schema's bounds", () => {
    const event = depDigestFindingToAlertEvent(
      {
        source: "dep-digest",
        kind: "dep_major_available",
        severity: "warning",
        title: "t".repeat(300),
        body: "b".repeat(10_000),
        dedupKey: "d".repeat(300),
        payload: {},
      },
      1_000,
    );
    expect(event.title.length).toBeLessThanOrEqual(200);
    expect(event.body.length).toBeLessThanOrEqual(5000);
    expect(event.dedupeKey.length).toBeLessThanOrEqual(200);
    expect(event.type).toBe("intel.dep_digest");
  });
});

// ── run()-level wiring (fixture-injected fetchImpl, house style with compliance.test.ts) ───────

const BASE_CONFIG: Config = {
  databaseUrl: "postgres://x",
  healthzPort: 8791,
  healthzHost: "127.0.0.1",
  schedulerEnabled: false,
  migrateOnBoot: false,
  cadenceComplianceMs: 1,
  cadenceSoc2Ms: 1,
  cadenceCompetitorMs: 1,
  cadenceGithubMs: 1,
  cadenceAnalyticsMs: 1,
  cadenceErrorMs: 1,
  cadenceDepDigestMs: 1,
  competitorUrls: [],
  githubOrg: "caisson-sh",
  posthogApiHost: "https://us.posthog.com",
  posthogProjectId: "493539",
  plausibleApiHost: "https://plausible.io",
  alertRateMaxPerWindow: 3,
  alertTz: "UTC",
  alertQuietStart: 0,
  alertQuietEnd: 0,
  llmEnabled: false,
  llmModel: "anthropic/claude-3.5-haiku",
};

function b64Json(value: unknown): { content: string; encoding: string } {
  return {
    content: Buffer.from(JSON.stringify(value), "utf8").toString("base64"),
    encoding: "base64",
  };
}

const ROOT_PKG = {
  packageManager: "bun@1.3.14",
  devDependencies: { turbo: "~2.10.0" },
  workspaces: {
    catalog: {
      zod: "^4.0.0",
      typescript: "^6.0.3",
      next: "^16.0.0",
      react: "^19.0.0",
    },
  },
};
const TSCONFIG_PKG = { dependencies: { "tsc-native": "npm:typescript@7.0.2" } };
const SITE_PKG = { dependencies: { "better-auth": "1.6.23" } };

// bun.lock fixture (leg d, v2): ui carries zod only transitively, via its workspace dependency
// on kernel — kernel is the only package/*.json that declares zod directly (matches ROOT_PKG /
// the git-trees + per-package fixtures above), so ui should land in transitive-only.
const BUN_LOCK_FIXTURE = {
  workspaces: {
    "packages/kernel": {
      name: "@caisson/kernel",
      dependencies: { zod: "^4.0.0" },
    },
    "packages/ui": {
      name: "@caisson/ui",
      dependencies: { "@caisson/kernel": "workspace:*" },
    },
  },
  packages: {
    "@caisson/kernel": ["@caisson/kernel@workspace:packages/kernel"],
    "@caisson/ui": ["@caisson/ui@workspace:packages/ui"],
    zod: ["zod@4.4.3", "", {}, "sha512-x"],
  },
};

function buildFetch(): Fecher {
  const seen = new Set<string>();
  const impl = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    seen.add(url);
    if (url.includes("/pulls?state=open")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.endsWith("/contents/package.json")) {
      return new Response(JSON.stringify(b64Json(ROOT_PKG)), { status: 200 });
    }
    if (url.endsWith("/contents/tooling/tsconfig/package.json")) {
      return new Response(JSON.stringify(b64Json(TSCONFIG_PKG)), {
        status: 200,
      });
    }
    if (url.endsWith("/contents/apps/site/package.json")) {
      return new Response(JSON.stringify(b64Json(SITE_PKG)), { status: 200 });
    }
    if (url.includes("/git/trees/main")) {
      return new Response(
        JSON.stringify({
          tree: [
            { path: "packages/kernel/package.json", type: "blob" },
            { path: "packages/ui/package.json", type: "blob" },
            { path: "packages/kernel/src/index.ts", type: "blob" },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/contents/packages/kernel/package.json")) {
      return new Response(
        JSON.stringify(
          b64Json({ name: "@caisson/kernel", dependencies: { zod: "^4.0.0" } }),
        ),
        { status: 200 },
      );
    }
    if (url.endsWith("/contents/packages/ui/package.json")) {
      return new Response(
        JSON.stringify(b64Json({ name: "@caisson/ui", dependencies: {} })),
        { status: 200 },
      );
    }
    if (url.endsWith("/contents/bun.lock")) {
      return new Response(JSON.stringify(b64Json(BUN_LOCK_FIXTURE)), {
        status: 200,
      });
    }
    if (url.includes("registry.npmjs.org/zod")) {
      return new Response(
        JSON.stringify({
          "dist-tags": { latest: "5.0.0" },
          time: { "5.0.0": "2026-01-01T00:00:00.000Z" },
        }),
        { status: 200 },
      );
    }
    if (url.includes("registry.npmjs.org/")) {
      // typescript / next / react / better-auth all report "current" so only zod is flagged.
      return new Response(
        JSON.stringify({ "dist-tags": { latest: "0.0.0" } }),
        { status: 200 },
      );
    }
    if (url.includes("oven-sh/bun/releases/latest")) {
      return new Response(
        JSON.stringify({
          tag_name: "bun-v1.3.14",
          published_at: "2026-01-01T00:00:00.000Z",
        }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as unknown as Fecher;
  return impl;
}

// Local alias so the block above type-checks without importing Fetcher twice under a different name.
type Fecher = Fetcher;

describe("depDigestWatcher.run (fixture-injected fetchImpl)", () => {
  test("a flagged major dep emits a finding with buyer-impact packages, then dedups on rerun", async () => {
    const store = new InMemoryStore();
    const ctx: WatcherCtx = {
      config: BASE_CONFIG,
      store,
      fetchImpl: buildFetch(),
      now: () => 2_000_000_000_000,
      logger,
    };

    const first = await depDigestWatcher.run(ctx);
    expect(first).toHaveLength(1);
    expect(first[0]?.payload.dep).toBe("zod");
    expect(first[0]?.payload.affectedPackages).toEqual(["@caisson/kernel"]);
    // ui declares no deps directly (fixture package.json above) but depends on kernel via
    // workspace:*, and kernel carries zod — so ui is transitive-only, per BUN_LOCK_FIXTURE.
    expect(first[0]?.payload.transitiveOnlyPackages).toEqual(["@caisson/ui"]);
    expect(first[0]?.body).toContain("Transitive-only: @caisson/ui");

    const second = await depDigestWatcher.run(ctx);
    expect(second).toEqual([]);
  });

  test("a bun.lock fetch failure degrades to direct-only without dropping the finding", async () => {
    const store = new InMemoryStore();
    const noLockFetch = (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/contents/bun.lock"))
        return new Response("not found", { status: 404 });
      return buildFetch()(input);
    }) as unknown as Fecher;

    const ctx: WatcherCtx = {
      config: BASE_CONFIG,
      store,
      fetchImpl: noLockFetch,
      now: () => 2_000_000_000_000,
      logger,
    };

    const findings = await depDigestWatcher.run(ctx);
    const zodFinding = findings.find((f) => f.payload.dep === "zod");
    expect(zodFinding?.payload.affectedPackages).toEqual(["@caisson/kernel"]);
    expect(zodFinding?.payload.transitiveOnlyPackages).toBeNull();
    expect(zodFinding?.body).toContain("Transitive-only: unavailable this run");
  });

  test("no tracked dep flagged (all current) yields zero findings — a quiet week", async () => {
    const store = new InMemoryStore();
    const quietFetch = (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/pulls?state=open"))
        return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/contents/package.json"))
        return new Response(JSON.stringify(b64Json(ROOT_PKG)), { status: 200 });
      if (url.endsWith("/contents/tooling/tsconfig/package.json"))
        return new Response(JSON.stringify(b64Json(TSCONFIG_PKG)), {
          status: 200,
        });
      if (url.endsWith("/contents/apps/site/package.json"))
        return new Response(JSON.stringify(b64Json(SITE_PKG)), { status: 200 });
      if (url.includes("registry.npmjs.org/"))
        return new Response(
          JSON.stringify({ "dist-tags": { latest: "0.0.0" } }),
          { status: 200 },
        );
      if (url.includes("oven-sh/bun/releases/latest"))
        return new Response(
          JSON.stringify({
            tag_name: "bun-v1.3.14",
            published_at: "2026-01-01T00:00:00.000Z",
          }),
          { status: 200 },
        );
      return new Response("not found", { status: 404 });
    }) as unknown as Fecher;

    const ctx: WatcherCtx = {
      config: BASE_CONFIG,
      store,
      fetchImpl: quietFetch,
      now: () => 2_000_000_000_000,
      logger,
    };
    expect(await depDigestWatcher.run(ctx)).toEqual([]);
  });

  test("a fetch throw on one leg (renovate PRs) never blocks the toolchain/pinned-dep leg", async () => {
    const store = new InMemoryStore();
    const partiallyBroken = (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/pulls?state=open")) throw new Error("network down");
      return buildFetch()(input);
    }) as unknown as Fecher;

    const ctx: WatcherCtx = {
      config: BASE_CONFIG,
      store,
      fetchImpl: partiallyBroken,
      now: () => 2_000_000_000_000,
      logger,
    };
    const findings = await depDigestWatcher.run(ctx);
    expect(findings.some((f) => f.payload.dep === "zod")).toBe(true);
  });
});
