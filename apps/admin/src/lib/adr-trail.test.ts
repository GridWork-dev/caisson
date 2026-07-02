import { describe, expect, test } from "bun:test";

import { ADR_CEILING, ADR_TRAIL, parseAdrContent } from "./adr-trail";

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
