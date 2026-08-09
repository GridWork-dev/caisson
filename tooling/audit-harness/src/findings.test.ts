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
  domain: "packages/auth",
  dimension: "D1",
  subject: "packages/auth/src/session.ts",
  title: "Session token compared with ===",
  severity: "high",
  ...over,
});

describe("stableId — identity survives rewording, across domain/dimension (ADR-0233)", () => {
  test("is deterministic", () => {
    expect(stableId("packages/auth", "D1", "hero", "x")).toBe(
      stableId("packages/auth", "D1", "hero", "x"),
    );
  });

  test("ignores case / punctuation / whitespace in the title (rewording never forks)", () => {
    expect(
      stableId("packages/auth", "D1", "hero", "Timing attack in ==="),
    ).toBe(
      stableId("packages/auth", "D1", "hero", "  timing   attack, in ===!  "),
    );
  });

  test("differs across domain, dimension, and subject", () => {
    const a = stableId("packages/auth", "D1", "hero", "x");
    expect(a).not.toBe(stableId("packages/auth", "D1", "pricing", "x"));
    expect(a).not.toBe(stableId("apps/site", "D1", "hero", "x"));
    // the v2 axis: same domain+subject+title, different lens → a DISTINCT finding, not a collision.
    expect(a).not.toBe(stableId("packages/auth", "D3", "hero", "x"));
  });
});

describe("reconcile — run-to-run classification across all domains", () => {
  const SEC = ["packages/auth"] as const;

  test("a finding absent from the ledger is `new` and opens", () => {
    const { ledger, classes } = reconcile([], [raw()], SEC);
    const id = withId(raw()).id;
    expect(classes[id]).toBe("new");
    expect(ledger.find((f) => f.id === id)?.status).toBe("open");
  });

  test("a persisting finding is `unchanged` and PRESERVES an operator `accepted` status", () => {
    const accepted: Finding = { ...withId(raw()), status: "accepted" };
    const { ledger, classes } = reconcile([accepted], [raw()], SEC);
    expect(classes[accepted.id]).toBe("unchanged");
    expect(ledger.find((f) => f.id === accepted.id)?.status).toBe("accepted");
  });

  test("a finding that disappears (in scope) is `closed` → fixed", () => {
    const open: Finding = { ...withId(raw()), status: "open" };
    const { ledger, classes } = reconcile([open], [], SEC);
    expect(classes[open.id]).toBe("closed");
    expect(ledger.find((f) => f.id === open.id)?.status).toBe("fixed");
  });

  test("full round-trip: new → closed (fixed, absent) → regressed (present again)", () => {
    const r1 = reconcile([], [raw()], SEC);
    const id = withId(raw()).id;
    expect(r1.classes[id]).toBe("new");
    expect(r1.ledger.find((f) => f.id === id)?.status).toBe("open");

    const r2 = reconcile(r1.ledger, [], SEC);
    expect(r2.classes[id]).toBe("closed");
    expect(r2.ledger.find((f) => f.id === id)?.status).toBe("fixed");

    const r3 = reconcile(r2.ledger, [raw()], SEC);
    expect(r3.classes[id]).toBe("regressed");
    expect(r3.ledger.find((f) => f.id === id)?.status).toBe("open");
  });

  test("an already-fixed finding still absent carries forward with no class", () => {
    const fixed: Finding = { ...withId(raw()), status: "fixed" };
    const { ledger, classes } = reconcile([fixed], [], SEC);
    expect(classes[fixed.id]).toBeUndefined();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.status).toBe("fixed");
  });

  // ── the must-fix (ADR-0188 / F4): a single-domain run must NOT false-close other domains ──
  test("a finding in an UN-audited domain passes through UNCHANGED (no silent false-close)", () => {
    const otherOpen: Finding = {
      ...withId(
        raw({ domain: "apps/site", subject: "apps/site/hero", title: "x" }),
      ),
      status: "open",
    };
    const secAccepted: Finding = { ...withId(raw()), status: "accepted" };
    const { ledger, classes } = reconcile([otherOpen, secAccepted], [], SEC);
    expect(classes[otherOpen.id]).toBeUndefined();
    expect(ledger.find((f) => f.id === otherOpen.id)?.status).toBe("open");
    expect(classes[secAccepted.id]).toBe("closed");
    expect(ledger.find((f) => f.id === secAccepted.id)?.status).toBe("fixed");
  });

  test("fail-loud: a current finding outside the declared scope throws", () => {
    expect(() => reconcile([], [raw({ domain: "apps/site" })], SEC)).toThrow(
      /not in the audited scope/,
    );
  });

  // ── ADR-0233 fail-loud additions ──
  test("fail-loud: two distinct findings that collapse to one id THROW (no silent drop)", () => {
    // same domain+dimension+subject+title → same id, but they are two emitted findings.
    const a = raw({ severity: "high" });
    const b = raw({ severity: "warn" });
    expect(() => reconcile([], [a, b], SEC)).toThrow(/id collision/);
  });

  test("fail-loud: a domain outside the derived universe THROWS (mislabeled domain)", () => {
    const universe = new Set(["packages/auth", "packages/audit-worm"]);
    // A typo can still be in the requested scope; the universe guard must reject it as unknown.
    expect(() =>
      reconcile(
        [],
        [raw({ domain: "packages/does-not-exist" })],
        ["packages/does-not-exist"],
        universe,
      ),
    ).toThrow(/not a derived domain/);
  });

  test("a valid derived domain passes the universe guard", () => {
    const universe = new Set(["packages/auth"]);
    expect(() =>
      reconcile([], [raw()], ["packages/auth"], universe),
    ).not.toThrow();
  });
});

describe("TOML round-trip — serialize ∘ parse is identity, across domain/dimension/subject", () => {
  test("preserves every field incl. quotes in the title and the domain/dimension/subject fields", () => {
    const ledger: Finding[] = [
      { ...withId(raw({ title: 'uses a "smart" quote' })), status: "open" },
      {
        ...withId(
          raw({
            domain: "packages/tenancy-rls",
            dimension: "D5",
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

  test("fail-loud: an unknown severity in a hand-edited row throws instead of casting through", () => {
    const toml =
      '[[finding]]\nid = "abc123"\ndomain = "packages/kernel"\ndimension = "D1"\n' +
      'subject = "x.ts"\ntitle = "y"\nseverity = "critical"\nstatus = "open"\n';
    expect(() => parseFindings(toml)).toThrow(/unknown severity/);
  });

  test("fail-loud: an unknown status in a hand-edited row throws instead of casting through", () => {
    const toml =
      '[[finding]]\nid = "abc123"\ndomain = "packages/kernel"\ndimension = "D1"\n' +
      'subject = "x.ts"\ntitle = "y"\nseverity = "warn"\nstatus = "triaged"\n';
    expect(() => parseFindings(toml)).toThrow(/unknown status/);
  });
});
