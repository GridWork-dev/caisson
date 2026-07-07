// Tests for registry/scripts/index-parity-probe.ts (CAISSON-37 / F-1 residual). No live network —
// computeParity is pure over injected fixtures.
// NOTE: registry/ is not a workspace member, so @caisson/* bare specifiers do not resolve here —
// these tests use only relative imports + node built-ins.
import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  computeParity,
  indexDigest12,
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
const licenseOk = { ok: true, indexDigest: REPO_DIGEST, indexEntries: 2 };

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
    });
    expect(r.drift).toBe(false);
    expect(r.rows.find((x) => x.leg === "license")?.status).toBe("ok");
    expect(r.rows.find((x) => x.leg === "worker")?.status).toBe("ok");
    // Admin is always unprobeable and never itself sets drift.
    expect(r.rows.find((x) => x.leg === "admin")?.status).toBe("unprobeable");
  });
});

describe("computeParity — drift detection", () => {
  test("license digest mismatch ⇒ drift", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: { ok: true, indexDigest: "deadbeef0000", indexEntries: 2 },
      workerIndex: WORKER_OK,
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "license")?.status).toBe("drift");
  });

  test("license /health missing the digest field (stale pre-parity image) ⇒ drift", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: { ok: true },
      workerIndex: WORKER_OK,
    });
    expect(r.rows.find((x) => x.leg === "license")?.status).toBe("drift");
  });

  test("worker serves a STALE version of a repo entry ⇒ drift", () => {
    const r = computeParity({
      repoBytes: REPO,
      licenseHealth: licenseOk,
      workerIndex: {
        schemaVersion: 1,
        modules: [{ id: "@caisson/kernel", latest: "1.1.0" }],
      },
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
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "license")?.status).toBe("unreachable");
  });

  test("an unparseable repo reference ⇒ drift, everything skipped", () => {
    const r = computeParity({
      repoBytes: "{ not json",
      licenseHealth: licenseOk,
      workerIndex: WORKER_OK,
    });
    expect(r.drift).toBe(true);
    expect(r.rows.find((x) => x.leg === "repo")?.detail).toContain(
      "UNPARSEABLE",
    );
  });
});

describe("renderTable", () => {
  test("prints a row per leg + a verdict line", () => {
    const out = renderTable(
      computeParity({
        repoBytes: REPO,
        licenseHealth: licenseOk,
        workerIndex: WORKER_OK,
      }),
    );
    expect(out).toContain("RESULT: PARITY OK");
    expect(out).toContain("admin");
    expect(out).toContain("UNPROBEABLE");
  });
});
