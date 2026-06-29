import { describe, expect, test } from "bun:test";

import {
  parseFindings,
  reconcile,
  serializeFindings,
  stableId,
  withId,
  type Finding,
  type RawFinding,
} from "./findings";

const raw = (over: Partial<RawFinding> = {}): RawFinding => ({
  workflow: "ui-review",
  surface: "hero",
  title: "Eyebrow contrast below AA",
  severity: "warn",
  ...over,
});

describe("stableId — identity survives rewording (ADR-0101 Layer 3)", () => {
  test("is deterministic", () => {
    expect(stableId("ui-review", "hero", "Eyebrow contrast below AA")).toBe(
      stableId("ui-review", "hero", "Eyebrow contrast below AA"),
    );
  });

  test("ignores case / punctuation / whitespace in the title (rewording never forks)", () => {
    expect(stableId("ui-review", "hero", "Eyebrow contrast below AA")).toBe(
      stableId("ui-review", "hero", "  eyebrow   contrast, below aa!  "),
    );
  });

  test("differs across surface and workflow", () => {
    const a = stableId("ui-review", "hero", "x");
    expect(a).not.toBe(stableId("ui-review", "pricing", "x"));
    expect(a).not.toBe(stableId("a11y-audit", "hero", "x"));
  });
});

describe("reconcile — run-to-run classification", () => {
  test("a finding absent from the ledger is `new` and opens", () => {
    const { ledger, classes } = reconcile([], [raw()]);
    const id = withId(raw()).id;
    expect(classes[id]).toBe("new");
    expect(ledger.find((f) => f.id === id)?.status).toBe("open");
  });

  test("a persisting finding is `unchanged` and PRESERVES an operator `accepted` status", () => {
    const accepted: Finding = { ...withId(raw()), status: "accepted" };
    const { ledger, classes } = reconcile([accepted], [raw()]);
    expect(classes[accepted.id]).toBe("unchanged");
    expect(ledger.find((f) => f.id === accepted.id)?.status).toBe("accepted");
  });

  test("a finding that disappears is `closed` → fixed", () => {
    const open: Finding = { ...withId(raw()), status: "open" };
    const { ledger, classes } = reconcile([open], []);
    expect(classes[open.id]).toBe("closed");
    expect(ledger.find((f) => f.id === open.id)?.status).toBe("fixed");
  });

  test("a fixed finding that reappears flips to `regressed` and reopens", () => {
    const fixed: Finding = { ...withId(raw()), status: "fixed" };
    const { ledger, classes } = reconcile([fixed], [raw()]);
    expect(classes[fixed.id]).toBe("regressed");
    expect(ledger.find((f) => f.id === fixed.id)?.status).toBe("open");
  });

  test("an already-fixed finding still absent carries forward with no class", () => {
    const fixed: Finding = { ...withId(raw()), status: "fixed" };
    const { ledger, classes } = reconcile([fixed], []);
    expect(classes[fixed.id]).toBeUndefined();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.status).toBe("fixed");
  });
});

describe("TOML round-trip — serialize ∘ parse is identity", () => {
  test("preserves every field incl. quotes in the title", () => {
    const ledger: Finding[] = [
      { ...withId(raw({ title: 'uses a "smart" quote' })), status: "open" },
      {
        ...withId(raw({ surface: "pricing", title: "no anchor link" })),
        status: "accepted",
      },
    ];
    expect(parseFindings(serializeFindings(ledger))).toEqual(
      [...ledger].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  test("an empty ledger serializes to just the header and parses back to []", () => {
    expect(parseFindings(serializeFindings([]))).toEqual([]);
  });
});
