// scripts/vendor-nist-catalog.test.ts — pure-function coverage only. No real network call: the
// live fetch path is exercised by an operator running the script directly (binding requirement 2
// is a documented PROCEDURE, not a CI-gated network test — mirrors oscal-export-xml.test.ts's own
// external-tool skip-if-absent posture for a different external dependency).
import { describe, expect, test } from "bun:test";
import {
  diffControlIds,
  parseArgv,
  readCatalogMetadata,
  sha256Hex,
  staleRows,
} from "./vendor-nist-catalog.ts";

describe("sha256Hex", () => {
  test("hashes bytes to the expected lowercase hex digest", () => {
    expect(sha256Hex(new TextEncoder().encode("hello"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("readCatalogMetadata", () => {
  test("reads version + oscal-version from a minimal catalog document", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        catalog: { metadata: { version: "5.2.0", "oscal-version": "1.2.2" } },
      }),
    );
    expect(readCatalogMetadata(bytes)).toEqual({
      version: "5.2.0",
      oscalVersion: "1.2.2",
    });
  });

  test("missing fields resolve to undefined, never throw", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({}));
    expect(readCatalogMetadata(bytes)).toEqual({
      version: undefined,
      oscalVersion: undefined,
    });
  });
});

describe("diffControlIds", () => {
  test("reports additions and removals; unchanged ids appear in neither", () => {
    const oldIds = new Set(["AC-2", "AC-3", "AU-2"]);
    const newIds = new Set(["AC-2", "AC-3", "AU-2.1", "SC-13"]);
    expect(diffControlIds(oldIds, newIds)).toEqual({
      added: ["AU-2.1", "SC-13"],
      removed: ["AU-2"],
    });
  });

  test("identical sets diff to empty on both sides", () => {
    const ids = new Set(["AC-2"]);
    expect(diffControlIds(ids, ids)).toEqual({ added: [], removed: [] });
  });
});

describe("staleRows", () => {
  test("flags real nist80053Crosswalk rows whose control id was removed", () => {
    // AC-3 is a row this crosswalk actually authors (crosswalks/nist-800-53.ts) — a live check
    // against the real data, not a fabricated fixture.
    const flagged = staleRows(["AC-3", "ZZ-999"]);
    expect(flagged.some((r) => r.control === "AC-3")).toBe(true);
    // ZZ-999 is not cited by any row — must not appear.
    expect(flagged.some((r) => r.control === "ZZ-999")).toBe(false);
  });

  test("an empty removed list flags nothing", () => {
    expect(staleRows([])).toEqual([]);
  });
});

describe("parseArgv", () => {
  test("defaults: no --refetch, no --sha", () => {
    expect(parseArgv([])).toEqual({ refetch: false, sha: null });
  });

  test("--refetch sets the flag", () => {
    expect(parseArgv(["--refetch"])).toEqual({ refetch: true, sha: null });
  });

  test("--sha <value> captures the next token", () => {
    expect(parseArgv(["--sha", "abc123"])).toEqual({
      refetch: false,
      sha: "abc123",
    });
  });

  test("--refetch --sha <value> combine", () => {
    expect(parseArgv(["--refetch", "--sha", "deadbeef"])).toEqual({
      refetch: true,
      sha: "deadbeef",
    });
  });
});
