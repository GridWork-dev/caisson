// registry/scripts/r2-historical-backfill.test.ts
// Tests for the historical R2 tarball backfill tool (CAISSON-125).
// Exercises the pure/DI core (backfillOne/runBackfill/parseMissingLine) with injected fake
// resolve/pack/upload fns — never shells out to git/bun/aws. The critical contract under test is
// fail-closed: a byte mismatch must never reach the upload fn.
import { describe, expect, test } from "bun:test";
import { computeTarballDist } from "./ci-publish-step";
import type { Sidecar } from "./ci-publish-step";
import {
  type HistoricalTarget,
  backfillOne,
  parseMissingLine,
  renderRow,
  runBackfill,
} from "./r2-historical-backfill";

const AUTH_BYTES = Buffer.from("real-auth-1.0.0-tarball-bytes");
const AUTH_DIST = computeTarballDist(AUTH_BYTES, "auth", "1.0.0");

function target(slug: string, version: string): HistoricalTarget {
  const id = `@caisson/${slug}`;
  return {
    id,
    slug,
    version,
    sidecarKey: `${id}@${version}`,
    r2Key: `${slug}/${slug}-${version}.tgz`,
  };
}

function sidecarWith(
  slug: string,
  version: string,
  dist: typeof AUTH_DIST,
): Sidecar {
  return { tarballs: { [`@caisson/${slug}@${version}`]: dist } };
}

describe("parseMissingLine", () => {
  test("parses the sidecar-key form (@caisson/<slug>@<version>)", () => {
    expect(parseMissingLine("@caisson/auth@1.0.0")).toEqual({
      id: "@caisson/auth",
      slug: "auth",
      version: "1.0.0",
      sidecarKey: "@caisson/auth@1.0.0",
      r2Key: "auth/auth-1.0.0.tgz",
    });
  });

  test("parses the R2-object-key form (<slug>/<slug>-<version>.tgz)", () => {
    expect(parseMissingLine("agentic-dev/agentic-dev-0.2.1.tgz")).toEqual({
      id: "@caisson/agentic-dev",
      slug: "agentic-dev",
      version: "0.2.1",
      sidecarKey: "@caisson/agentic-dev@0.2.1",
      r2Key: "agentic-dev/agentic-dev-0.2.1.tgz",
    });
  });

  test("handles a prerelease version in the R2-object-key form", () => {
    expect(parseMissingLine("cli/cli-0.6.2-rc.1.tgz")).toEqual({
      id: "@caisson/cli",
      slug: "cli",
      version: "0.6.2-rc.1",
      sidecarKey: "@caisson/cli@0.6.2-rc.1",
      r2Key: "cli/cli-0.6.2-rc.1.tgz",
    });
  });

  test("skips blank lines and comments", () => {
    expect(parseMissingLine("")).toBeNull();
    expect(parseMissingLine("   ")).toBeNull();
    expect(parseMissingLine("# a note")).toBeNull();
  });

  test("skips malformed lines rather than throwing", () => {
    expect(parseMissingLine("not-a-valid-key")).toBeNull();
    expect(parseMissingLine("auth/demo-1.0.0.tgz")).toBeNull(); // slug mismatch across the '/'
  });
});

describe("backfillOne — the fail-closed byte-verify gate", () => {
  test("byte MISMATCH: no upload call, status=mismatch", () => {
    let uploadCalled = false;
    const result = backfillOne(target("auth", "1.0.0"), AUTH_DIST, {
      resolveCommit: () => "deadbee0",
      packAtCommit: () =>
        Buffer.from("WRONG bytes — commit resolution picked the wrong tree"),
      upload: () => {
        uploadCalled = true;
      },
      doUpload: true,
    });
    expect(uploadCalled).toBe(false);
    expect(result.status).toBe("mismatch");
    expect(result.detail).toContain("refusing to upload");
  });

  test("byte match + --upload: uploads with the exact r2Key + the packed bytes", () => {
    let uploadedKey: string | undefined;
    let uploadedBytes: Uint8Array | undefined;
    const result = backfillOne(target("auth", "1.0.0"), AUTH_DIST, {
      resolveCommit: () => "cafebabe",
      packAtCommit: () => AUTH_BYTES,
      upload: (r2Key, bytes) => {
        uploadedKey = r2Key;
        uploadedBytes = bytes;
      },
      doUpload: true,
    });
    expect(result.status).toBe("uploaded");
    expect(result.commit).toBe("cafebabe");
    expect(uploadedKey).toBe("auth/auth-1.0.0.tgz");
    expect(uploadedBytes).toBe(AUTH_BYTES);
  });

  test("byte match, dry-run (no --upload): never calls upload", () => {
    let uploadCalled = false;
    const result = backfillOne(target("auth", "1.0.0"), AUTH_DIST, {
      resolveCommit: () => "cafebabe",
      packAtCommit: () => AUTH_BYTES,
      upload: () => {
        uploadCalled = true;
      },
      doUpload: false,
    });
    expect(uploadCalled).toBe(false);
    expect(result.status).toBe("dry-run-match");
  });

  test("commit resolution failure surfaces as an error row, never calls pack or upload", () => {
    let packCalled = false;
    let uploadCalled = false;
    const result = backfillOne(target("auth", "9.9.9"), AUTH_DIST, {
      resolveCommit: () => {
        throw new Error("no commit carries version 9.9.9");
      },
      packAtCommit: () => {
        packCalled = true;
        return AUTH_BYTES;
      },
      upload: () => {
        uploadCalled = true;
      },
      doUpload: true,
    });
    expect(result.status).toBe("error");
    expect(result.detail).toContain("commit resolution failed");
    expect(packCalled).toBe(false);
    expect(uploadCalled).toBe(false);
  });

  test("pack failure surfaces as an error row, never calls upload", () => {
    let uploadCalled = false;
    const result = backfillOne(target("auth", "1.0.0"), AUTH_DIST, {
      resolveCommit: () => "cafebabe",
      packAtCommit: () => {
        throw new Error("bun install --frozen-lockfile failed");
      },
      upload: () => {
        uploadCalled = true;
      },
      doUpload: true,
    });
    expect(result.status).toBe("error");
    expect(result.detail).toContain("pack at cafebab");
    expect(uploadCalled).toBe(false);
  });
});

describe("runBackfill — batch behavior", () => {
  test("a target with no sidecar row is reported as error, not silently skipped", () => {
    const result = runBackfill({
      targets: [target("ghost", "1.0.0")],
      sidecar: sidecarWith("auth", "1.0.0", AUTH_DIST),
      resolveCommit: () => "cafebabe",
      packAtCommit: () => AUTH_BYTES,
      upload: () => {
        throw new Error("upload should never be called");
      },
      doUpload: true,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.status).toBe("error");
    expect(result.rows[0]?.detail).toContain("no sidecar row");
    expect(result.failed).toBe(1);
    expect(result.uploaded).toBe(0);
  });

  test("one mismatched sibling never blocks a matching target in the same batch", () => {
    const demoBytes = Buffer.from("demo-2.0.0-bytes");
    const demoDist = computeTarballDist(demoBytes, "demo", "2.0.0");
    const uploadedKeys: string[] = [];
    const result = runBackfill({
      targets: [target("auth", "1.0.0"), target("demo", "2.0.0")],
      sidecar: {
        tarballs: {
          "@caisson/auth@1.0.0": AUTH_DIST,
          "@caisson/demo@2.0.0": demoDist,
        },
      },
      resolveCommit: (slug) => `${slug}-commit`,
      packAtCommit: (slug) =>
        slug === "auth" ? Buffer.from("churned-bytes") : demoBytes,
      upload: (r2Key) => {
        uploadedKeys.push(r2Key);
      },
      doUpload: true,
    });
    expect(result.rows.map((r) => r.status)).toEqual(["mismatch", "uploaded"]);
    expect(uploadedKeys).toEqual(["demo/demo-2.0.0.tgz"]);
    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(1);
  });
});

test("renderRow renders a one-line, human-readable summary", () => {
  const line = renderRow({
    sidecarKey: "@caisson/auth@1.0.0",
    r2Key: "auth/auth-1.0.0.tgz",
    commit: "cafebabedeadbeef",
    status: "uploaded",
    detail: "uploaded 42B",
  });
  expect(line).toContain("UPLOADED");
  expect(line).toContain("@caisson/auth@1.0.0");
  expect(line).toContain("cafebab"); // short sha
  expect(line).toContain("uploaded 42B");
});
