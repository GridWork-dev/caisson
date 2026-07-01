import { describe, expect, test } from "bun:test";

import {
  parseFindings,
  reconcile,
  serializeFindings,
  stableId,
  withId,
  type Finding,
  type RawFinding,
} from "./findings.ts";

const raw = (over: Partial<RawFinding> = {}): RawFinding => ({
  domain: "security",
  subject: "packages/auth/src/session.ts",
  title: "Session token compared with ===",
  severity: "high",
  ...over,
});

describe("stableId — identity survives rewording, across domains (ADR-0134 §2)", () => {
  test("is deterministic", () => {
    expect(stableId("security", "hero", "x")).toBe(
      stableId("security", "hero", "x"),
    );
  });

  test("ignores case / punctuation / whitespace in the title (rewording never forks)", () => {
    expect(stableId("security", "hero", "Timing attack in ===")).toBe(
      stableId("security", "hero", "  timing   attack, in ===!  "),
    );
  });

  test("differs across domain and subject", () => {
    const a = stableId("security", "hero", "x");
    expect(a).not.toBe(stableId("security", "pricing", "x"));
    expect(a).not.toBe(stableId("design-ui", "hero", "x"));
  });
});

describe("reconcile — run-to-run classification across all domains", () => {
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

  test("full round-trip: new → closed (fixed, absent) → regressed (present again)", () => {
    // 1. new
    const r1 = reconcile([], [raw()]);
    const id = withId(raw()).id;
    expect(r1.classes[id]).toBe("new");
    expect(r1.ledger.find((f) => f.id === id)?.status).toBe("open");

    // 2. absent this run → closed/fixed
    const r2 = reconcile(r1.ledger, []);
    expect(r2.classes[id]).toBe("closed");
    expect(r2.ledger.find((f) => f.id === id)?.status).toBe("fixed");

    // 3. present again → regressed, reopened
    const r3 = reconcile(r2.ledger, [raw()]);
    expect(r3.classes[id]).toBe("regressed");
    expect(r3.ledger.find((f) => f.id === id)?.status).toBe("open");
  });

  test("an already-fixed finding still absent carries forward with no class", () => {
    const fixed: Finding = { ...withId(raw()), status: "fixed" };
    const { ledger, classes } = reconcile([fixed], []);
    expect(classes[fixed.id]).toBeUndefined();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.status).toBe("fixed");
  });
});

describe("TOML round-trip — serialize ∘ parse is identity, across domain/subject", () => {
  test("preserves every field incl. quotes in the title and the new domain/subject fields", () => {
    const ledger: Finding[] = [
      { ...withId(raw({ title: 'uses a "smart" quote' })), status: "open" },
      {
        ...withId(
          raw({
            domain: "rls-tenancy",
            subject: "packages/tenancy-rls/src/context.ts",
            title: "no withTenant guard",
          }),
        ),
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
