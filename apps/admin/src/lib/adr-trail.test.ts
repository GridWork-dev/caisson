import { describe, expect, test } from "bun:test";

import {
  ADR_CEILING,
  ADR_TRAIL,
  extractOpenTableRows,
  FORKS_BOARD,
  parseAdrContent,
  parseForksBoard,
  parsePipeTableRows,
} from "./adr-trail";

describe("parseAdrContent", () => {
  test("extracts number, title, status word, and date from a plain Status: header", () => {
    const entry = parseAdrContent(
      "# ADR-0140 — admin.caisson.sh auth: CF-Access alone\n\nStatus: accepted · 2026-06-30 (Stage-2 Stream A initiative SPEC, operator picker)\n\n## Context\n",
      "ADR-0140-admin-auth-cf-access.md",
    );
    expect(entry).not.toBeNull();
    expect(entry?.number).toBe(140);
    expect(entry?.title).toBe("admin.caisson.sh auth: CF-Access alone");
    expect(entry?.status).toBe("accepted");
    expect(entry?.date).toBe("2026-06-30");
  });

  test("handles the bold **Status:** **locked** variant and a hyphen-y title", () => {
    const entry = parseAdrContent(
      "# ADR-0042 — Design-system foundation: palette + type lock\n\n**Status:** **locked** · 2026-06-27\n",
      "ADR-0042-design-system-foundation.md",
    );
    expect(entry?.number).toBe(42);
    expect(entry?.title).toBe("Design-system foundation: palette + type lock");
    expect(entry?.status).toBe("locked");
    expect(entry?.date).toBe("2026-06-27");
  });

  test("returns null when the content has no ADR title line", () => {
    expect(
      parseAdrContent("# Not an ADR\n\nStatus: accepted\n", "x.md"),
    ).toBeNull();
  });
});

describe("parsePipeTableRows", () => {
  test("strips the header + separator rows and inline markdown noise per cell", () => {
    const lines = [
      "intro paragraph, not a table line",
      "| Item | State |",
      "| --- | --- |",
      "| **Railway PITR** | Declined at the picker |",
      "| ~~**old fork**~~ LOCKED → **ADR-0104** | See `notes.md` and [the memo](https://x/y) |",
    ];
    const rows = parsePipeTableRows(lines);
    expect(rows).toEqual([
      ["Railway PITR", "Declined at the picker"],
      ["old fork LOCKED → ADR-0104", "See notes.md and the memo"],
    ]);
  });

  test("returns empty for a non-table body", () => {
    expect(parsePipeTableRows(["just some prose", "more prose"])).toEqual([]);
  });
});

describe("extractOpenTableRows", () => {
  test("filters closed (struck-through first cell) rows and keeps tables from every ### subsection", () => {
    const body = [
      "Some intro prose above the first table.",
      "",
      "| Item | State |",
      "| --- | --- |",
      "| **Railway PITR** | Declined at the picker |",
      "| ~~**Old fork**~~ LOCKED → **ADR-0104** | See `notes.md` |",
      "",
      "### Provider-optimization forks, round 2 (a subsection with its own table)",
      "",
      "Subsection prose that isn't itself a table row.",
      "",
      "| Fork | Options | Rec + confidence |",
      "| --- | --- | --- |",
      "| **PF2-6 Still open** | keep vs add | **Keep for now.** `medium` |",
      "| ~~**PF2-1 Locked**~~ **LOCKED 2026-07-13 → option (a)** | Operator accepted. | Resolved. |",
    ];
    expect(extractOpenTableRows(body)).toEqual([
      ["Railway PITR", "Declined at the picker"],
      ["PF2-6 Still open", "keep vs add", "Keep for now. medium"],
    ]);
  });

  test("returns empty for a body with no tables", () => {
    expect(extractOpenTableRows(["just some prose", "more prose"])).toEqual([]);
  });
});

describe("parseForksBoard", () => {
  test("stops the Open section at the next H2, keeping ### subsection tables (F7 fix)", () => {
    const text = [
      "# Decisions and forks board",
      "",
      "Intro paragraph.",
      "",
      "## Open (waiting on operator — DO NOT auto-decide)",
      "",
      "| Item | State |",
      "| --- | --- |",
      "| **Railway PITR** | Declined at the picker |",
      "| ~~**Old fork**~~ LOCKED → **ADR-0104** | See notes |",
      "",
      "### A genuinely-open subsection (must NOT be dropped)",
      "",
      "| Fork | Options |",
      "| --- | --- |",
      "| **Still open** | pick one |",
      "",
      "## History — closed rounds",
      "",
      "| Item | State |",
      "| --- | --- |",
      "| ~~**Ancient**~~ | closed long ago |",
    ].join("\n");

    const board = parseForksBoard(text);
    expect(board.openRows).toEqual([
      ["Railway PITR", "Declined at the picker"],
      ["Still open", "pick one"],
    ]);
    // The next H2 ("## History") bounds the Open section — its table must not leak in.
    for (const row of board.openRows) {
      expect(row.join(" ")).not.toContain("Ancient");
    }
  });
});

describe("FORKS_BOARD.openRows (baked from the real repo at build time)", () => {
  test("every row has at least 2 cells (Item, State) and no leftover pipe-table syntax", () => {
    // >=2, not exactly 2 (F7 fix): the Open section's genuinely-open ### subsection tables (e.g.
    // "Provider-optimization forks") are 3-column (Fork, Options, Rec + confidence), and those
    // rows are no longer dropped alongside the top-level 2-column (Item, State) table.
    for (const row of FORKS_BOARD.openRows) {
      expect(row.length).toBeGreaterThanOrEqual(2);
      for (const cell of row) {
        expect(cell).not.toMatch(/\*\*|~~|`|\|/);
      }
    }
  });
});

describe("ADR_TRAIL (baked from the real repo at build time)", () => {
  test("is non-empty, sorted ascending, and carries the known ADR-0140 lock", () => {
    expect(ADR_TRAIL.length).toBeGreaterThan(0);
    for (let i = 1; i < ADR_TRAIL.length; i++) {
      // Non-null assertions: i is bounded by length, but noUncheckedIndexedAccess can't see it.
      expect(ADR_TRAIL[i]!.number).toBeGreaterThan(ADR_TRAIL[i - 1]!.number);
    }
    const adr140 = ADR_TRAIL.find((e) => e.number === 140);
    expect(adr140?.title).toBe("admin.caisson.sh auth: CF-Access alone");
    expect(adr140?.status).toBe("accepted");
    expect(ADR_CEILING).toBeGreaterThanOrEqual(140);
  });
});
