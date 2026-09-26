// The trust-page poke's two checkable claims, both of which went unasserted when the hand-ported
// mirror (trust-page-logic.ts) and its parity suite were deleted:
//
//   1. The docstring on SAMPLE_MANIFEST says the rendered output is "byte-identical to the committed
//      golden fixture". Nothing checked that after the mirror went away. It is checked here, against
//      packages/trust-page/src/__golden__/ — and the literal is run through parseEvidencePackManifest
//      rather than cast, so a drift from the real schema fails here instead of at runtime in a browser.
//   2. The tamper verdict must never contradict the panels rendered above it. `generateTrustPage` reads
//      the allowlist through TWO consumers (redactToAllowlist over the flat facts, AND the
//      CROSSWALK_ROLLUP_ROWS_KEY sentinel gating the citation-row table); the verdict used to model
//      only the first, so typing the sentinel rendered the crosswalk table — including a cell's
//      internal canonical control id — under a red "Refused … was never captured" verdict.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { redactToAllowlist } from "@caisson-sh/artifact-render";
import { parseEvidencePackManifest } from "@caisson-sh/compliance-core";
import {
  CROSSWALK_ROLLUP_ROWS_KEY,
  DEFAULT_TRUST_PAGE_ALLOWLIST,
  generateTrustPage,
} from "@caisson-sh/trust-page";

import {
  ALL_FACT_KEYS,
  SAMPLE_FACTS,
  SAMPLE_MANIFEST,
  tamperOutcome,
} from "./trust-page-poke";

/** The poke's own literal, re-parsed through the real boundary schema. */
const PARSED = parseEvidencePackManifest(SAMPLE_MANIFEST);

function golden(name: string): string {
  return readFileSync(
    join(
      import.meta.dir,
      "../../../../packages/trust-page/src/__golden__",
      name,
    ),
    "utf8",
  );
}

/** Render with the default allowlist widened by one tamper key, the way the poke does. */
function renderWith(key: string) {
  const allowlist = [...new Set([...DEFAULT_TRUST_PAGE_ALLOWLIST, key])];
  const page = generateTrustPage(PARSED, { allowlist });
  return {
    page,
    released: redactToAllowlist(SAMPLE_FACTS, allowlist),
    body: JSON.parse(page.json) as {
      facts: Record<string, unknown>;
      crosswalk: readonly unknown[];
    },
  };
}

const BASE = generateTrustPage(PARSED);

describe("SAMPLE_MANIFEST is pinned to the package's own fixture and goldens", () => {
  test("the literal survives the real schema unchanged (not just cast to its type)", () => {
    expect(PARSED).toEqual(SAMPLE_MANIFEST);
  });

  test("default-allowlist HTML is byte-identical to the committed golden", () => {
    expect(BASE.html).toBe(golden("trust-page.default.html.txt"));
  });

  test("default-allowlist JSON is byte-identical to the committed golden", () => {
    expect(BASE.json).toBe(golden("trust-page.default.json.txt"));
  });

  test("the default allowlist still leaks none of the fixture's marked secrets", () => {
    const combined = `${BASE.html}\n${BASE.json}`;
    for (const secret of [
      "tenant-DO-NOT-LEAK-9f3a2c",
      "f".repeat(64),
      "DO-NOT-LEAK-CONTROL-TITLE-8b21",
      "AUDIT.IMMUTABLE-LOG",
    ]) {
      expect(combined.includes(secret)).toBe(false);
    }
  });
});

describe("the tamper verdict agrees with what actually rendered", () => {
  // Every fact key, the section sentinel, and keys that are neither.
  const PROBES = [
    ...ALL_FACT_KEYS,
    CROSSWALK_ROLLUP_ROWS_KEY,
    "internal.debugDump",
    "crosswalkRollup",
    "crosswalkRollup.cells.0.canonicalControlIds",
    "__proto__",
  ];

  test.each(PROBES)('"%s" — the verdict matches the rendered bytes', (key) => {
    const { page, released, body } = renderWith(key);
    const outcome = tamperOutcome(key, released);

    if (outcome === "refused") {
      // The claim the red verdict makes: nothing you typed reached the page.
      expect(page.html).toBe(BASE.html);
      expect(page.json).toBe(BASE.json);
    } else if (outcome === "fact") {
      expect(body.facts[key]).toEqual(SAMPLE_FACTS[key]);
    } else {
      expect(outcome).toBe("section");
      expect(body.crosswalk.length).toBeGreaterThan(0);
    }
  });

  test("an empty tamper box is neutral, never a refusal", () => {
    expect(tamperOutcome("", redactToAllowlist(SAMPLE_FACTS, []))).toBe(
      "empty",
    );
  });

  // The exact contradiction this pairing exists to prevent: the sentinel opens the crosswalk table
  // (and with it a canonical control id) while the verdict called it never-captured.
  test("the crosswalk sentinel is never reported as refused while its table renders", () => {
    const { page, released, body } = renderWith(CROSSWALK_ROLLUP_ROWS_KEY);
    expect(page.html).toContain("<h2>Crosswalk</h2>");
    expect(page.json).toContain("AUDIT.IMMUTABLE-LOG");
    expect(body.crosswalk.length).toBe(1);
    expect(tamperOutcome(CROSSWALK_ROLLUP_ROWS_KEY, released)).toBe("section");
  });

  test("a fabricated key still changes nothing in either output", () => {
    const { page, released } = renderWith("internal.debugDump");
    expect(tamperOutcome("internal.debugDump", released)).toBe("refused");
    expect(page.html).toBe(BASE.html);
    expect(page.json).toBe(BASE.json);
  });
});
