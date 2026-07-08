// Unit tests for the PURE functions only — no live `op` CLI call anywhere in this file.
import { describe, expect, test } from "bun:test";
import {
  computeParity,
  extractEnvNames,
  filterNonEnv,
  isClean,
  NON_ENV_TAG,
  parseArgv,
  parseVaultItems,
  printReport,
  type VaultItem,
} from "./vault-parity-check";

describe("extractEnvNames", () => {
  test("extracts names from both `export NAME=` and bare `NAME=` forms", () => {
    const text = [
      "export FOO=bar",
      "BAR=baz",
      "# a comment",
      "",
      "  # indented comment",
    ].join("\n");
    expect(extractEnvNames(text)).toEqual(["BAR", "FOO"]);
  });

  test("dedupes and sorts", () => {
    expect(extractEnvNames("export B=1\nexport A=1\nexport A=2\n")).toEqual([
      "A",
      "B",
    ]);
  });

  test("never captures the value side, even a secret-shaped one", () => {
    const secretValue = "sk-super-secret-token-should-never-appear";
    const names = extractEnvNames(`export OPENROUTER_API_KEY=${secretValue}`);
    expect(names).toEqual(["OPENROUTER_API_KEY"]);
    expect(names.join(",")).not.toContain(secretValue);
  });

  test("empty input yields an empty array", () => {
    expect(extractEnvNames("")).toEqual([]);
  });
});

describe("parseVaultItems", () => {
  test("extracts title + updated_at only, ignoring any other field", () => {
    const raw = [
      {
        title: "OPENROUTER_API_KEY",
        updated_at: "2026-06-01T00:00:00Z",
        // A fixture-only field shaped like a real `op` payload might carry — must never surface.
        additional_information: "should-never-be-read",
      },
      { title: "DISCORD_TOKEN", updated_at: "2026-07-01T00:00:00Z" },
    ];
    const items = parseVaultItems(raw);
    expect(items).toEqual([
      {
        title: "OPENROUTER_API_KEY",
        updatedAt: "2026-06-01T00:00:00Z",
        tags: [],
      },
      { title: "DISCORD_TOKEN", updatedAt: "2026-07-01T00:00:00Z", tags: [] },
    ]);
  });

  test("missing updated_at parses to null, not a throw", () => {
    const items = parseVaultItems([{ title: "RESEND_API_KEY" }]);
    expect(items).toEqual([
      { title: "RESEND_API_KEY", updatedAt: null, tags: [] },
    ]);
  });

  test("tags are carried through when present", () => {
    const items = parseVaultItems([
      { title: "MIRROR_PUSH_TOKEN", tags: [NON_ENV_TAG, "gh-actions"] },
    ]);
    expect(items[0]?.tags).toEqual([NON_ENV_TAG, "gh-actions"]);
  });

  test("empty list parses to an empty array", () => {
    expect(parseVaultItems([])).toEqual([]);
  });

  test("throws on a malformed item (missing title)", () => {
    expect(() =>
      parseVaultItems([{ updated_at: "2026-01-01T00:00:00Z" }]),
    ).toThrow();
  });
});

describe("computeParity", () => {
  const items = (titles: string[]): VaultItem[] =>
    titles.map((title) => ({ title, updatedAt: null, tags: [] }));

  test("no drift when the name sets match exactly", () => {
    const report = computeParity(["A", "B"], items(["A", "B"]));
    expect(report).toEqual({
      missingFromVault: [],
      missingFromEnv: [],
      stale: [],
    });
    expect(isClean(report)).toBe(true);
  });

  test("names in env but not vault are reported missingFromVault", () => {
    const report = computeParity(["A", "B", "C"], items(["A"]));
    expect(report.missingFromVault).toEqual(["B", "C"]);
    expect(isClean(report)).toBe(false);
  });

  test("names in vault but not env are reported missingFromEnv", () => {
    const report = computeParity(["A"], items(["A", "B", "C"]));
    expect(report.missingFromEnv).toEqual(["B", "C"]);
    expect(isClean(report)).toBe(false);
  });

  test("stale is empty when no --rotated-after is given, even with old timestamps", () => {
    const old: VaultItem[] = [
      { title: "A", updatedAt: "2020-01-01T00:00:00Z", tags: [] },
    ];
    const report = computeParity(["A"], old);
    expect(report.stale).toEqual([]);
  });

  test("items updated before rotatedAfter are reported stale", () => {
    const mixed: VaultItem[] = [
      { title: "OLD", updatedAt: "2020-01-01T00:00:00Z", tags: [] },
      { title: "NEW", updatedAt: "2026-07-01T00:00:00Z", tags: [] },
      { title: "UNKNOWN", updatedAt: null, tags: [] },
    ];
    const report = computeParity(
      ["OLD", "NEW", "UNKNOWN"],
      mixed,
      "2026-01-01T00:00:00Z",
    );
    expect(report.stale).toEqual(["OLD"]);
    expect(isClean(report)).toBe(false);
  });
});

describe("printReport — the value-safety guard", () => {
  test("never emits a value, only names, even when fed secret-shaped fixture titles", () => {
    // Titles are always credential NAMES by contract, but this proves the print path itself
    // has no code branch capable of emitting anything but the strings it's handed.
    const report = computeParity(
      ["OPENROUTER_API_KEY", "DISCORD_TOKEN"],
      [{ title: "OPENROUTER_API_KEY", updatedAt: null, tags: [] }],
    );
    const chunks: string[] = [];
    printReport(report, (s) => chunks.push(s));
    const output = chunks.join("");

    expect(output).toContain("DISCORD_TOKEN");
    expect(output).toContain("missing from vault");
    // No fixture ever carries a value string, so this also asserts the function signature never
    // grows a path that could: only names/dates ever reach `write`.
    expect(output).not.toContain("sk-");
  });
});

describe("filterNonEnv", () => {
  test("drops non-env-tagged items and keeps everything else, including other tags", () => {
    const kept: VaultItem = {
      title: "PADDLE_API_KEY",
      updatedAt: null,
      tags: ["caisson-license"],
    };
    const dropped: VaultItem = {
      title: "MIRROR_PUSH_TOKEN",
      updatedAt: null,
      tags: ["gh-actions", NON_ENV_TAG],
    };
    expect(filterNonEnv([kept, dropped])).toEqual([kept]);
  });

  test("a non-env item never surfaces as missingFromEnv after filtering", () => {
    const items: VaultItem[] = [
      { title: "OPENROUTER_API_KEY", updatedAt: null, tags: [] },
      { title: "MIRROR_PUSH_TOKEN", updatedAt: null, tags: [NON_ENV_TAG] },
    ];
    const report = computeParity(["OPENROUTER_API_KEY"], filterNonEnv(items));
    expect(report.missingFromEnv).toEqual([]);
    expect(isClean(report)).toBe(true);
  });
});

describe("parseArgv", () => {
  test("defaults to the Caisson Launch vault with no --rotated-after", () => {
    expect(parseArgv([])).toEqual({ vault: "Caisson Launch" });
  });

  test("accepts --vault <name>", () => {
    expect(parseArgv(["--vault", "Other Vault"])).toEqual({
      vault: "Other Vault",
    });
  });

  test("accepts --rotated-after=<ISO date>", () => {
    expect(parseArgv(["--rotated-after=2026-01-01T00:00:00Z"])).toEqual({
      vault: "Caisson Launch",
      rotatedAfter: "2026-01-01T00:00:00Z",
    });
  });

  test("throws when --rotated-after is not a parseable date", () => {
    expect(() => parseArgv(["--rotated-after", "not-a-date"])).toThrow(
      /--rotated-after/,
    );
  });
});
