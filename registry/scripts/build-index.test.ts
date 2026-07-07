// NOTE: registry/ is not a workspace member, so @caisson/* bare specifiers do not resolve here —
// these tests use only relative imports + node built-ins. The committed registry/index.json IS the
// golden fixture for the built index: the byte-identical rebuild test below is its regression.
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRegistryIndexFromFile } from "../schema/registry-index";
import {
  INDEX_PATH,
  buildIndex,
  buildIndexFromLedgerFile,
  compareSemver,
  parseLedger,
  parseLedgerLines,
} from "./build-index";

/** A minimal valid publish line for delist-mechanics tests. */
const pub = (id: string, version: string) => ({
  id,
  version,
  publishedAt: "2026-06-27T00:00:00.000Z",
  gateAttestation: "ci-x@abc",
  manifest: {
    id,
    version,
    kind: "primitive",
    editions: [],
    tier: "paid",
    priceCents: 100,
    license: "LicenseRef-Caisson-Commercial",
    dependencies: [],
    members: {},
    entry: "src/index.ts",
    agents: "AGENTS.md",
    golden: null,
    stability: "alpha",
    description: "x",
  },
});
const delist = (id: string) => ({
  op: "delist",
  id,
  delistedAt: "2026-07-07T16:00:00.000Z",
  reason: "test delist",
});
const jsonl = (...lines: object[]) =>
  `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;

describe("registry index builder (ADR-0021/0047)", () => {
  test("the committed index.json is byte-identical to a fresh rebuild (proves CI-built)", () => {
    const rebuilt = buildIndexFromLedgerFile();
    const committed = readFileSync(INDEX_PATH, "utf8");
    expect(rebuilt).toBe(committed);
  });

  test("loadRegistryIndexFromFile parses the built file (parse-or-throw)", () => {
    const index = loadRegistryIndexFromFile(INDEX_PATH);
    expect(index.schemaVersion).toBe(1);
    expect(index.modules.map((m) => m.id)).toContain("@caisson/field-crypto");
  });

  test("loadRegistryIndexFromFile throws on a malformed file (never a cast)", () => {
    const bad = join(tmpdir(), `caisson-bad-index-${process.pid}.json`);
    writeFileSync(bad, `{"schemaVersion": 2, "modules": "nope"}`);
    try {
      expect(() => loadRegistryIndexFromFile(bad)).toThrow();
    } finally {
      rmSync(bad, { force: true });
    }
  });

  test("parseLedger rejects a malformed line with its line number", () => {
    expect(() => parseLedger(`{"id":"@caisson/x"}`)).toThrow(/line 1/);
    expect(() => parseLedger(`\n\nnot json`)).toThrow(/line 3/);
  });

  test("a delist line drops the module from the index but keeps its publishes parseable (ADR-0271)", () => {
    const text = jsonl(
      pub("@caisson/keep", "0.1.0"),
      pub("@caisson/gone", "0.1.0"),
      pub("@caisson/gone", "0.2.0"),
      delist("@caisson/gone"),
    );
    const { publishes, delists } = parseLedgerLines(text);
    expect(publishes).toHaveLength(3); // history preserved
    expect(delists).toHaveLength(1);
    const index = buildIndex(publishes, delists);
    expect(index.modules.map((m) => m.id)).toEqual(["@caisson/keep"]);
  });

  test("a publish after a delist is a ledger error (delisting is terminal)", () => {
    const text = jsonl(
      pub("@caisson/gone", "0.1.0"),
      delist("@caisson/gone"),
      pub("@caisson/gone", "0.2.0"),
    );
    expect(() => parseLedgerLines(text)).toThrow(/after its delist/);
  });

  test("a delist without a prior publish and a duplicate delist are ledger errors", () => {
    expect(() => parseLedgerLines(jsonl(delist("@caisson/never")))).toThrow(
      /no prior publish/,
    );
    expect(() =>
      parseLedgerLines(
        jsonl(
          pub("@caisson/gone", "0.1.0"),
          delist("@caisson/gone"),
          delist("@caisson/gone"),
        ),
      ),
    ).toThrow(/duplicate delist/);
  });

  test("a malformed delist line reports its line number", () => {
    expect(() =>
      parseLedgerLines(
        jsonl(pub("@caisson/gone", "0.1.0"), {
          op: "delist",
          id: "@caisson/gone",
        }),
      ),
    ).toThrow(/line 2/);
  });

  test("a delist reason over 500 chars is rejected (bound, not free-text)", () => {
    expect(() =>
      parseLedgerLines(
        jsonl(pub("@caisson/gone", "0.1.0"), {
          ...delist("@caisson/gone"),
          reason: "x".repeat(501),
        }),
      ),
    ).toThrow(/line 2/);
    // Exactly at the bound is still valid.
    expect(() =>
      parseLedgerLines(
        jsonl(pub("@caisson/gone", "0.1.0"), {
          ...delist("@caisson/gone"),
          reason: "x".repeat(500),
        }),
      ),
    ).not.toThrow();
  });

  test("buildIndex picks the highest semver as latest and sorts modules by id", () => {
    const mk = (id: string, version: string) => ({
      id,
      version,
      publishedAt: "2026-06-27T00:00:00.000Z",
      gateAttestation: "ci-x@abc",
      manifest: {
        id,
        version,
        kind: "primitive" as const,
        editions: [] as never[],
        tier: "paid" as const,
        priceCents: 100,
        license: "LicenseRef-Caisson-Commercial" as const,
        dependencies: [] as never[],
        members: {} as Record<string, string>,
        entry: "src/index.ts",
        agents: "AGENTS.md",
        golden: null,
        stability: "alpha" as const,
        description: "x",
      },
    });
    const index = buildIndex([
      mk("@caisson/zeta", "0.1.0"),
      mk("@caisson/alpha", "0.1.0"),
      mk("@caisson/alpha", "0.2.0"),
      mk("@caisson/alpha", "0.1.5"),
    ]);
    expect(index.modules.map((m) => m.id)).toEqual([
      "@caisson/alpha",
      "@caisson/zeta",
    ]);
    expect(index.modules[0]!.latest).toBe("0.2.0");
    expect(index.modules[0]!.versions.map((v) => v.version)).toEqual([
      "0.1.0",
      "0.1.5",
      "0.2.0",
    ]);
  });

  test("a duplicate version for one module is rejected", () => {
    const e = {
      id: "@caisson/x",
      version: "0.1.0",
      publishedAt: "2026-06-27T00:00:00.000Z",
      gateAttestation: "ci-x@abc",
      manifest: {
        id: "@caisson/x",
        version: "0.1.0",
        kind: "primitive" as const,
        editions: [] as never[],
        tier: "paid" as const,
        priceCents: 100,
        license: "LicenseRef-Caisson-Commercial" as const,
        dependencies: [] as never[],
        members: {} as Record<string, string>,
        entry: "src/index.ts",
        agents: "AGENTS.md",
        golden: null,
        stability: "alpha" as const,
        description: "x",
      },
    };
    expect(() => buildIndex([e, e])).toThrow(/duplicate version/);
  });

  test("compareSemver orders core versions and ranks release above prerelease", () => {
    expect(compareSemver("0.1.0", "0.2.0")).toBe(-1);
    expect(compareSemver("1.0.0", "0.9.9")).toBe(1);
    expect(compareSemver("0.1.0", "0.1.0")).toBe(0);
    expect(compareSemver("1.0.0-alpha", "1.0.0")).toBe(-1);
  });

  test("compareSemver keeps multi-segment prereleases distinct and ignores build metadata", () => {
    // FIRST-hyphen split: the prerelease may contain hyphens — must not collapse to equal.
    expect(compareSemver("1.0.0-alpha-1", "1.0.0-alpha-2")).toBe(-1);
    expect(compareSemver("1.0.0-alpha-2", "1.0.0-alpha-1")).toBe(1);
    // Build metadata (SemVer §10) does not affect precedence.
    expect(compareSemver("1.0.0-rc.1+build1", "1.0.0-rc.1+build2")).toBe(0);
    expect(compareSemver("1.0.0+a", "1.0.0+b")).toBe(0);
  });

  test("the ledger rebuilds into the committed index (golden = the file itself)", () => {
    const { publishes, delists } = parseLedgerLines(
      readFileSync(join(import.meta.dir, "..", "ledger.jsonl"), "utf8"),
    );
    const fromLedger = buildIndex(publishes, delists);
    expect(fromLedger).toEqual(loadRegistryIndexFromFile(INDEX_PATH));
  });
});
