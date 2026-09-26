import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { ValidationError } from "@caisson-sh/kernel";
import {
  parseEvidencePackManifest,
  type EvidencePackManifest,
} from "@caisson-sh/compliance-core";
import {
  CROSSWALK_ROLLUP_ROWS_KEY,
  DEFAULT_TRUST_PAGE_ALLOWLIST,
} from "./facts.ts";
import { generateTrustPage } from "./render.ts";

const PKG_SRC_META = new URL("./index.ts", import.meta.url).href;

/** A distinctive-string fixture — every "must never leak" value below is unique enough that a
 *  substring match can't collide with anything an allowlisted field would legitimately render. */
function fixtureManifest(
  overrides?: Record<string, unknown>,
): EvidencePackManifest {
  return parseEvidencePackManifest({
    formatVersion: "2",
    tenantId: "tenant-DO-NOT-LEAK-9f3a2c",
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 — Trust Services Criteria",
      version: "2024.1",
    },
    chainAnchor: {
      length: 3,
      tipHash: "f".repeat(64),
      genesisHash: "e".repeat(64),
    },
    crosswalkRollup: {
      cells: [
        {
          framework: "SOC2-TSC",
          reference: "CC7.2",
          canonicalControlIds: ["AUDIT.IMMUTABLE-LOG"],
          status: "ready",
          claim: "maps-to",
          evidencePointers: ["AUDIT.IMMUTABLE-LOG"],
        },
      ],
    },
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "DO-NOT-LEAK-CONTROL-TITLE-8b21",
        family: "Audit",
        statement: "append-only hash-chained log anchored in WORM",
        crosswalk: [],
        evidence: [
          {
            collectorId: "substrate.chain-verify",
            title: "Audit chain verifies",
            summary: "the chain verifies against its anchor",
            status: "pass",
            facts: { valid: true },
            manualSlots: [],
          },
        ],
        readiness: "ready",
      },
    ],
    summary: {
      totalControls: 1,
      controlsReady: 1,
      controlsWithGaps: 0,
      totalEvidenceItems: 1,
      posture: "1 of 1 controls evidence-ready; no gaps recorded.",
    },
    ...overrides,
  });
}

const SECRET_STRINGS = [
  "tenant-DO-NOT-LEAK-9f3a2c",
  "f".repeat(64), // chainAnchor.tipHash
  "DO-NOT-LEAK-CONTROL-TITLE-8b21",
  "AUDIT.IMMUTABLE-LOG", // control id — also NOT redundant with an allowlisted field's own value
];

describe("generateTrustPage — allowlist redaction leak-check (binding)", () => {
  test("the default allowlist leaks NONE of the excluded fields' bytes, in HTML or JSON", () => {
    const page = generateTrustPage(fixtureManifest());
    const combined = `${page.html}\n${page.json}`;
    for (const secret of SECRET_STRINGS) {
      expect(combined.includes(secret)).toBe(false);
    }
  });

  test("widening the allowlist to include a field makes it — and only it — appear", () => {
    const page = generateTrustPage(fixtureManifest(), {
      allowlist: [...DEFAULT_TRUST_PAGE_ALLOWLIST, "tenantId"],
    });
    const combined = `${page.html}\n${page.json}`;
    expect(combined.includes("tenant-DO-NOT-LEAK-9f3a2c")).toBe(true);
    // Everything else stays excluded.
    expect(combined.includes("f".repeat(64))).toBe(false);
    expect(combined.includes("DO-NOT-LEAK-CONTROL-TITLE-8b21")).toBe(false);
  });

  test("an empty allowlist renders no facts and no crosswalk table", () => {
    const page = generateTrustPage(fixtureManifest(), { allowlist: [] });
    expect(page.html).not.toContain("<dl");
    expect(page.html).not.toContain("<table");
    expect(
      JSON.parse(page.json) as { facts: unknown; crosswalk: unknown[] },
    ).toEqual({ facts: {}, crosswalk: [] });
  });
});

describe("generateTrustPage — crosswalk-rollup section is its own opt-in switch", () => {
  test("absent from the allowlist by default — no crosswalk table, no cell content", () => {
    const page = generateTrustPage(fixtureManifest());
    expect(page.html).not.toContain("<table");
    expect(page.html.includes("SOC2-TSC CC7.2")).toBe(false);
  });

  test("opting in renders every cell as a citation row", () => {
    const page = generateTrustPage(fixtureManifest(), {
      allowlist: [...DEFAULT_TRUST_PAGE_ALLOWLIST, CROSSWALK_ROLLUP_ROWS_KEY],
    });
    expect(page.html).toContain("SOC2-TSC CC7.2");
    expect(page.html).toContain("maps-to");
    const parsed = JSON.parse(page.json) as { crosswalk: unknown[] };
    expect(parsed.crosswalk.length).toBe(1);
  });
});

describe("generateTrustPage — readiness-language gate (defense in depth)", () => {
  test("rejects a banned claim word even in a field pack-format itself doesn't gate (framework.title)", () => {
    const manifest = fixtureManifest({
      framework: {
        id: "soc2-tsc",
        title: "SOC 2 — fully compliant program",
        version: "2024.1",
      },
    });
    expect(() => generateTrustPage(manifest)).toThrow(ValidationError);
  });
});

describe("generateTrustPage — determinism", () => {
  test("identical input yields byte-identical HTML and JSON across calls", () => {
    const a = generateTrustPage(fixtureManifest());
    const b = generateTrustPage(fixtureManifest());
    expect(a).toEqual(b);
  });

  test("no external resource references — self-contained (no <script src, <link, fetch)", () => {
    const page = generateTrustPage(fixtureManifest());
    expect(page.html).not.toMatch(/<script\s+src=/i);
    expect(page.html).not.toMatch(/<link\b/i);
    expect(page.html).not.toMatch(/\bfetch\(/);
  });
});

describe("generateTrustPage — golden", () => {
  test("byte-stable default-allowlist render", () => {
    matchGolden(
      PKG_SRC_META,
      "trust-page.default.html",
      generateTrustPage(fixtureManifest()).html,
    );
    matchGolden(
      PKG_SRC_META,
      "trust-page.default.json",
      generateTrustPage(fixtureManifest()).json,
    );
  });
});
