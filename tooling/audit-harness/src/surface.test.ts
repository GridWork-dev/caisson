import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { withId, type Finding } from "./findings.ts";
import {
  enumerateSurface,
  selectValidateCandidates,
  summarize,
} from "./surface.ts";

// Scan THIS package (deterministic, no dependency on the wider repo layout).
const PKG_ROOT = join(import.meta.dir, "..");
const selfDomain = (globs: string[]): { globs: string[] } => ({ globs });

describe("enumerateSurface", () => {
  test("resolves a domain's globs to real files, sorted + deduped", () => {
    const files = enumerateSurface(selfDomain(["src/*.ts"]), PKG_ROOT);
    expect(files).toContain("src/findings.ts");
    expect(files).toContain("src/surface.ts");
    expect(files).toEqual([...new Set(files)].sort());
  });

  test("overlapping globs dedupe to one entry per file", () => {
    const files = enumerateSurface(
      selfDomain(["src/*.ts", "src/**"]),
      PKG_ROOT,
    );
    expect(files.filter((f) => f === "src/findings.ts")).toHaveLength(1);
  });

  test("excludes vendor/build dirs", () => {
    const files = enumerateSurface(selfDomain(["**/*.ts"]), PKG_ROOT);
    expect(files.every((f) => !/node_modules|dist/.test(f))).toBe(true);
  });
});

describe("selectValidateCandidates", () => {
  test("keeps only high-severity open findings", () => {
    const led: Finding[] = [
      {
        ...withId({
          domain: "packages/auth",
          dimension: "D1",
          subject: "a",
          title: "x",
          severity: "high",
        }),
        status: "open",
      },
      {
        ...withId({
          domain: "packages/auth",
          dimension: "D1",
          subject: "b",
          title: "y",
          severity: "high",
        }),
        status: "accepted",
      },
      {
        ...withId({
          domain: "packages/auth",
          dimension: "D1",
          subject: "c",
          title: "z",
          severity: "warn",
        }),
        status: "open",
      },
    ];
    const got = selectValidateCandidates(led);
    expect(got).toHaveLength(1);
    expect(got[0]?.subject).toBe("a");
  });
});

describe("summarize", () => {
  test("counts by domain/severity/status + lists open-high", () => {
    const led: Finding[] = [
      {
        ...withId({
          domain: "packages/auth",
          dimension: "D1",
          subject: "a",
          title: "x",
          severity: "high",
        }),
        status: "open",
      },
      {
        ...withId({
          domain: "apps/site",
          dimension: "D6",
          subject: "b",
          title: "y",
          severity: "warn",
        }),
        status: "fixed",
      },
    ];
    const s = summarize(led);
    expect(s.total).toBe(2);
    expect(s.byDomain["packages/auth"]).toBe(1);
    expect(s.byDomain["apps/site"]).toBe(1);
    expect(s.bySeverity.high).toBe(1);
    expect(s.bySeverity.warn).toBe(1);
    expect(s.byStatus.open).toBe(1);
    expect(s.byStatus.fixed).toBe(1);
    expect(s.openHigh).toHaveLength(1);
    expect(s.openHigh[0]?.subject).toBe("a");
  });
});
