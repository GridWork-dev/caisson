// Tests for registry/scripts/index-parity-probe.ts (CAISSON-37 / F-1 residual). No live network —
// computeParity is pure over injected fixtures.
// NOTE: registry/ is not a workspace member, so @caisson/* bare specifiers do not resolve here —
// these tests use only relative imports + node built-ins.
import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  computeParity,
  fetchJsonWithRetry,
  indexDigest12,
  parseOnlyFlag,
  renderTable,
} from "./index-parity-probe.ts";

const REPO = JSON.stringify({
  schemaVersion: 1,
  modules: [
    { id: "@caisson/kernel", latest: "1.2.0" },
    { id: "@caisson/compliance", latest: "0.4.0" },
  ],
});
const REPO_DIGEST = indexDigest12(REPO);

/** A worker anon view = the base subset, at repo-matching versions. */
const WORKER_OK = {
  schemaVersion: 1,
  modules: [{ id: "@caisson/kernel", latest: "1.2.0" }],
};
// license and admin report the identical shape via the identical digest formula — one fixture
// serves both legs whenever a test doesn't care about the difference between them.
const healthOk = { ok: true, indexDigest: REPO_DIGEST, indexEntries: 2 };
const licenseOk = healthOk;
const adminOk = healthOk;

describe("indexDigest12", () => {
  test("is sha256 first-12-hex and matches node crypto directly", () => {
    const d = indexDigest12("hello");
    expect(d).toBe(
      createHash("sha256").update("hello").digest("hex").slice(0, 12),
    );
    expect(d).toHaveLength(12);
  });
  test("stable across string vs bytes of the same content", () => {
    expect(indexDigest12(REPO)).toBe(indexDigest12(Buffer.from(REPO, "utf8")));
  });
});

describe("computeParity — parity holds", () => {
  test("all reachable legs match ⇒ no drift", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: licenseOk,
      workerIndex: WORKER_OK,
      adminHealthz: adminOk,
    });
    expect(r.drift).toBe(false);
    expect(r.rows.find((x) => x.leg === "license")?.status).toBe("ok");
    expect(r.rows.find((x) => x.leg === "worker")?.status).toBe("ok");
    expect(r.rows.find((x) => x.leg === "admin")?.status).toBe("ok");
  });
});

describe("computeParity — drift detection", () => {
  test("license digest mismatch ⇒ drift", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: { ok: true, indexDigest: "deadbeef0000", indexEntries: 2 },
      workerIndex: WORKER_OK,
      adminHealthz: adminOk,
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "license")?.status).toBe("drift");
  });

  test("license /health missing the digest field (stale pre-parity image) ⇒ drift", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: { ok: true },
      workerIndex: WORKER_OK,
      adminHealthz: adminOk,
    });
    expect(r.rows.find((x) => x.leg === "license")?.status).toBe("drift");
  });

  test("admin digest mismatch ⇒ drift (the CAISSON-37 admin leg)", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: licenseOk,
      workerIndex: WORKER_OK,
      adminHealthz: { ok: true, indexDigest: "deadbeef0000", indexEntries: 2 },
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "admin")?.status).toBe("drift");
  });

  test("admin /healthz unreachable ⇒ drift (cannot confirm parity)", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: licenseOk,
      workerIndex: WORKER_OK,
      adminHealthz: null,
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "admin")?.status).toBe("unreachable");
  });

  test("worker serves a STALE version of a repo entry ⇒ drift", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: licenseOk,
      workerIndex: {
        schemaVersion: 1,
        modules: [{ id: "@caisson/kernel", latest: "1.1.0" }],
      },
      adminHealthz: adminOk,
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "worker")?.detail).toContain(
      "worker@1.1.0",
    );
  });

  test("worker serves an id absent from the repo ⇒ drift", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: licenseOk,
      workerIndex: {
        schemaVersion: 1,
        modules: [{ id: "@caisson/ghost", latest: "9.9.9" }],
      },
      adminHealthz: adminOk,
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "worker")?.detail).toContain(
      "absent from repo",
    );
  });

  test("a probed leg being unreachable ⇒ drift (cannot confirm parity)", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: null,
      workerIndex: WORKER_OK,
      adminHealthz: adminOk,
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "license")?.status).toBe("unreachable");
  });

  test("an unparseable repo reference ⇒ drift, everything skipped", () => {
    const r = computeParity({
      repoBytes: "{ not json",
      licenseHealth: licenseOk,
      workerIndex: WORKER_OK,
      adminHealthz: adminOk,
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "repo")?.detail).toContain(
      "UNPARSEABLE",
    );
    expect(r.rows.find((x) => x.leg === "admin")?.detail).toContain("skipped");
  });
});

describe("renderTable", () => {
  test("prints a row per leg + a verdict line", () => {
    const out = renderTable(
      computeParity({
        repoBytes: REPO,
        licenseHealth: licenseOk,
        workerIndex: WORKER_OK,
        adminHealthz: adminOk,
      }),
    );
    expect(out).toContain("RESULT: PARITY OK");
    expect(out).toContain("admin");
    expect(out).toContain("OK");
  });
});

describe("fetchJsonWithRetry", () => {
  const noSleep = async (): Promise<void> => {};

  test("a leg that blips once is still measured, not reported unreachable", async () => {
    // The 2026-07-27 failure: admin answered /healthz 200 with a valid digest, but one transient
    // fetch failure rendered the leg UNREACHABLE — indistinguishable from a real outage in a
    // report that feeds launch acceptance.
    let calls = 0;
    const flaky = async (): Promise<unknown | null> => {
      calls++;
      return calls === 1 ? null : { ok: true, indexDigest: "abc123abc123" };
    };
    expect(
      await fetchJsonWithRetry("https://example.test", flaky, noSleep),
    ).toEqual({
      ok: true,
      indexDigest: "abc123abc123",
    });
    expect(calls).toBe(2);
  });

  test("a genuinely dead leg still reports unreachable, after exhausting attempts", async () => {
    let calls = 0;
    const dead = async (): Promise<unknown | null> => {
      calls++;
      return null;
    };
    expect(
      await fetchJsonWithRetry("https://example.test", dead, noSleep),
    ).toBeNull();
    expect(calls).toBe(3);
  });

  test("a healthy leg costs exactly one call", async () => {
    let calls = 0;
    const healthy = async (): Promise<unknown | null> => {
      calls++;
      return { ok: true };
    };
    await fetchJsonWithRetry("https://example.test", healthy, noSleep);
    expect(calls).toBe(1);
  });
});

describe("parseOnlyFlag", () => {
  test("is undefined when the flag is absent (probe every leg)", () => {
    expect(parseOnlyFlag(["bun", "probe.ts"])).toBeUndefined();
  });

  test("parses one leg and a comma list, trimming whitespace", () => {
    expect(parseOnlyFlag(["--only", "worker"])).toEqual(["worker"]);
    expect(parseOnlyFlag(["--only", "license, admin"])).toEqual([
      "license",
      "admin",
    ]);
  });

  // Fail-closed: this probe gates a deploy, so a typo must NOT narrow to "probe nothing" and exit 0.
  test("throws on an unknown leg rather than narrowing to nothing", () => {
    expect(() => parseOnlyFlag(["--only", "wroker"])).toThrow(
      /unknown: wroker/,
    );
    expect(() => parseOnlyFlag(["--only", "repo"])).toThrow(/unknown: repo/);
  });

  test("throws on an empty or missing value", () => {
    expect(() => parseOnlyFlag(["--only", ""])).toThrow(/got none/);
    expect(() => parseOnlyFlag(["--only", " , "])).toThrow(/got none/);
    expect(() => parseOnlyFlag(["--only"])).toThrow(/got none/);
  });
});

describe("computeParity leg scoping", () => {
  const legsOf = (report: ReturnType<typeof computeParity>): string[] =>
    report.rows.map((r) => r.leg);

  test("--only worker reports repo + worker and nothing else", () => {
    const report = computeParity({
      repoBytes: REPO,
      licenseHealth: null,
      workerIndex: WORKER_OK,
      adminHealthz: null,
      legs: ["worker"],
    });
    expect(legsOf(report)).toEqual(["repo", "worker"]);
    expect(report.drift).toBe(false);
  });

  // The release train redeploys the Worker BEFORE admin/site, so at that moment the other surfaces
  // legitimately still bake the previous index. A scoped run must not red on them.
  test("an unreached admin/license does not red a worker-scoped run", () => {
    const staleAdmin = {
      ok: true,
      indexDigest: "ffffffffffff",
      indexEntries: 2,
    };
    const scoped = computeParity({
      repoBytes: REPO,
      licenseHealth: staleAdmin,
      workerIndex: WORKER_OK,
      adminHealthz: staleAdmin,
      legs: ["worker"],
    });
    expect(scoped.drift).toBe(false);
    // ...while the unscoped run over the identical inputs still catches them.
    const full = computeParity({
      repoBytes: REPO,
      licenseHealth: staleAdmin,
      workerIndex: WORKER_OK,
      adminHealthz: staleAdmin,
    });
    expect(full.drift).toBe(true);
  });

  test("a stale worker still reds its own scoped run", () => {
    const report = computeParity({
      repoBytes: REPO,
      licenseHealth: null,
      workerIndex: {
        schemaVersion: 1,
        modules: [{ id: "@caisson/kernel", latest: "1.1.0" }],
      },
      adminHealthz: null,
      legs: ["worker"],
    });
    expect(report.drift).toBe(true);
    expect(renderTable(report)).toContain("worker@1.1.0 != repo@1.2.0");
  });

  test("an unparseable repo index still reports only the scoped legs", () => {
    const report = computeParity({
      repoBytes: "{ not json",
      licenseHealth: null,
      workerIndex: null,
      adminHealthz: null,
      legs: ["worker"],
    });
    expect(legsOf(report)).toEqual(["repo", "worker"]);
    expect(report.drift).toBe(true);
  });
});
