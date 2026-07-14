import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { matchGolden } from "@caisson/testing";
import {
  defineRegimeCrosswalk,
  exportRegimeCrosswalk,
  type RegimeCrosswalk,
  type RegimeCrosswalkInput,
} from "./regime-crosswalk.ts";
import {
  gdprCrosswalk,
  pciDssCrosswalk,
  regimeCrosswalks,
  soc2Crosswalk,
} from "./regimes.ts";

// matchGolden anchors __golden__/ to the URL handed to it. The frameworks-pack keeps ALL goldens in
// ONE package-level dir (src/__golden__ — the manifest's gated `golden` path), so anchor at src/
// (one level up from crosswalks/), matching frameworks/frameworks.test.ts.
const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;

// Repo root, for resolving repo-relative proof paths: crosswalks/ -> src -> frameworks-pack ->
// packages -> ROOT (four levels up from this test file).
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** A minimal valid crosswalk, reused to isolate the schema rules under test. */
function minimal(rows: RegimeCrosswalkInput["rows"]): RegimeCrosswalkInput {
  return {
    regime: "soc2",
    title: "test",
    regimeRevision: "rev",
    crosswalkVersion: "0.0",
    regimeSpecificDisclaimer: "regime-specific note",
    rows,
  };
}

describe("claim posture is encoded in the type + enforced at author time (ADR-0279)", () => {
  test("an `implements` row WITHOUT a proof pointer fails closed", () => {
    // The discriminated union makes this a compile error too; cast through `unknown` to reach the
    // runtime guard (never `any`). This is the core ADR-0279 rule: no assertive claim without a proof.
    const bad = minimal([
      {
        claim: "implements",
        control: "CC1.1",
        summary: "s",
        mechanism: "@caisson/x — mechanism",
        evidence: "e",
        buyerResponsibility: "b",
      },
    ] as unknown as RegimeCrosswalkInput["rows"]);
    expect(() => defineRegimeCrosswalk(bad)).toThrow();
  });

  test("an `implements` row WITH a proof pointer is accepted", () => {
    const good = minimal([
      {
        claim: "implements",
        control: "CC1.1",
        summary: "s",
        mechanism: "@caisson/x — mechanism",
        evidence: "e",
        buyerResponsibility: "b",
        proof: { kind: "test", path: "packages/x/src/x.test.ts" },
      },
    ]);
    expect(() => defineRegimeCrosswalk(good)).not.toThrow();
  });

  test("a `maps-to` row carrying a stray proof key is rejected (strict boundary)", () => {
    const bad = minimal([
      {
        claim: "maps-to",
        control: "CC1.1",
        summary: "s",
        mechanism: "@caisson/x — mechanism",
        evidence: "e",
        buyerResponsibility: "b",
        proof: { kind: "test", path: "packages/x/src/x.test.ts" },
      },
    ] as unknown as RegimeCrosswalkInput["rows"]);
    expect(() => defineRegimeCrosswalk(bad)).toThrow();
  });

  test("a proof path with `..` or an absolute prefix is rejected", () => {
    for (const path of ["../secrets/x.ts", "/etc/passwd"]) {
      const bad = minimal([
        {
          claim: "implements",
          control: "CC1.1",
          summary: "s",
          mechanism: "@caisson/x — mechanism",
          evidence: "e",
          buyerResponsibility: "b",
          proof: { kind: "test", path },
        },
      ]);
      expect(() => defineRegimeCrosswalk(bad)).toThrow();
    }
  });

  test("duplicate regime control ids in one crosswalk fail closed", () => {
    const row = {
      claim: "maps-to" as const,
      control: "CC1.1",
      summary: "s",
      mechanism: "@caisson/x — mechanism",
      evidence: "e",
      buyerResponsibility: "b",
    };
    expect(() => defineRegimeCrosswalk(minimal([row, { ...row }]))).toThrow();
  });
});

describe("ADR-0347 Fork G1/G2 -- optional canonicalControlId + crosswalk-level seedProvenance", () => {
  test("a row may carry an optional canonicalControlId (additive, .strict()-safe)", () => {
    const cw = defineRegimeCrosswalk(
      minimal([
        {
          claim: "maps-to",
          control: "CC1.1",
          summary: "s",
          mechanism: "@caisson/x — mechanism",
          evidence: "e",
          buyerResponsibility: "b",
          canonicalControlId: "ACCESS-CONTROL.LOGICAL",
        },
      ]),
    );
    expect(cw.rows[0]?.canonicalControlId).toBe("ACCESS-CONTROL.LOGICAL");
  });

  test("rejects a non-canonical canonicalControlId", () => {
    expect(() =>
      defineRegimeCrosswalk(
        minimal([
          {
            claim: "maps-to",
            control: "CC1.1",
            summary: "s",
            mechanism: "@caisson/x — mechanism",
            evidence: "e",
            buyerResponsibility: "b",
            canonicalControlId: "access-control.logical",
          },
        ]),
      ),
    ).toThrow();
  });

  test("a crosswalk may carry optional crosswalk-level seedProvenance", () => {
    const cw = defineRegimeCrosswalk({
      ...minimal([
        {
          claim: "maps-to",
          control: "CC1.1",
          summary: "s",
          mechanism: "@caisson/x — mechanism",
          evidence: "e",
          buyerResponsibility: "b",
        },
      ]),
      seedProvenance: {
        sourceId: "nist-sp800-53r5-iso27001-2022-olir",
        sourceVersion: "2022",
        sourceUrl: "https://csrc.nist.gov/olir/example.xlsx",
        sourceDigest: "c".repeat(64),
      },
    });
    expect(cw.seedProvenance?.sourceDigest).toBe("c".repeat(64));
  });

  test("rejects a non-https seedProvenance.sourceUrl", () => {
    expect(() =>
      defineRegimeCrosswalk({
        ...minimal([
          {
            claim: "maps-to",
            control: "CC1.1",
            summary: "s",
            mechanism: "@caisson/x — mechanism",
            evidence: "e",
            buyerResponsibility: "b",
          },
        ]),
        seedProvenance: {
          sourceId: "nist-sp800-53r5-iso27001-2022-olir",
          sourceVersion: "2022",
          sourceUrl: "http://csrc.nist.gov/olir/example.xlsx",
          sourceDigest: "c".repeat(64),
        },
      }),
    ).toThrow();
  });

  test("existing SOC2/PCI/GDPR crosswalks carry neither field (no v1 churn)", () => {
    for (const cw of regimeCrosswalks) {
      expect(cw.seedProvenance).toBeUndefined();
      for (const row of cw.rows) {
        expect(row.canonicalControlId).toBeUndefined();
      }
    }
  });
});

describe("every authored crosswalk is honest and well-formed", () => {
  const cases: ReadonlyArray<readonly [string, RegimeCrosswalk]> = [
    ["soc2", soc2Crosswalk],
    ["pci-dss", pciDssCrosswalk],
    ["gdpr", gdprCrosswalk],
  ];

  test("regimeCrosswalks holds exactly the three ADR-0277 regimes (FedRAMP out)", () => {
    expect(regimeCrosswalks.map((c) => c.regime).sort()).toEqual([
      "gdpr",
      "pci-dss",
      "soc2",
    ]);
  });

  for (const [name, cw] of cases) {
    describe(name, () => {
      test("has rows, unique control ids, and a required buyer-responsibility on every row", () => {
        expect(cw.rows.length).toBeGreaterThan(0);
        const ids = cw.rows.map((r) => r.control);
        expect(new Set(ids).size).toBe(ids.length);
        for (const row of cw.rows) {
          // The load-bearing fifth column is never empty (defineRegimeCrosswalk enforces min-1).
          expect(row.buyerResponsibility.trim().length).toBeGreaterThan(0);
        }
      });

      test("carries a mixed posture — at least one `maps-to` (never blanket-assertive)", () => {
        expect(cw.rows.some((r) => r.claim === "maps-to")).toBe(true);
      });

      test("no row uses forbidden certification/compliance vocabulary in its own prose (copy law)", () => {
        // Caisson is never the grammatical subject of "compliant/certified/satisfies" (memo §a/§b,
        // ADR-0080). The neutral "maps to / implements a technical control" register holds in the data.
        // (regimeSpecificDisclaimer is exempt — it legitimately uses these words in NEGATED form, e.g.
        // "does not make you PCI DSS compliant"; that text is checked for the negation instead, below.)
        const forbidden = /\b(certified|compliant|satisfies)\b/i;
        expect(cw.title).not.toMatch(forbidden);
        for (const row of cw.rows) {
          expect(row.summary).not.toMatch(forbidden);
          expect(row.mechanism).not.toMatch(forbidden);
          expect(row.evidence).not.toMatch(forbidden);
          expect(row.buyerResponsibility).not.toMatch(forbidden);
        }
      });
    });
  }
});

describe("every `implements` row links a proof artifact that exists in the repo (ADR-0279)", () => {
  // The binding honesty guard: an assertive claim whose proof was deleted/moved fails here, forcing
  // the row back to `maps-to` in the same change — exactly the ADR-0279 consequence.
  for (const cw of regimeCrosswalks) {
    for (const row of cw.rows) {
      if (row.claim !== "implements") continue;
      test(`${cw.regime} / ${row.control} -> ${row.proof.path}`, () => {
        expect(existsSync(join(REPO_ROOT, row.proof.path))).toBe(true);
      });
    }
  }
});

describe("the export embeds the disclaimer + revision pin INSIDE the artifact (memo §c)", () => {
  for (const cw of regimeCrosswalks) {
    test(`${cw.regime}: disclaimer travels in the export, revision is pinned`, () => {
      const out = exportRegimeCrosswalk(cw);
      // Revision pin present and consistent — never an evergreen "current" claim.
      expect(out.regimeRevision).toBe(cw.regimeRevision);
      expect(out.disclaimer.regimeRevision).toBe(cw.regimeRevision);
      // The scope + no-guarantee + not-a-certification language is embedded, not on a separate page.
      expect(out.disclaimer.noComplianceGuarantee).toContain(
        "do not, ensure your compliance",
      );
      expect(out.disclaimer.notACertification).toContain("not a certification");
      expect(out.disclaimer.scopeBoundary).toContain(
        "not listed here is not covered",
      );
      expect(out.disclaimer.regimeSpecific).toBe(cw.regimeSpecificDisclaimer);
      // Rows carry through unchanged.
      expect(out.rows.length).toBe(cw.rows.length);
    });
  }
});

describe("crosswalk exports are byte-stable (golden)", () => {
  test("soc2 crosswalk export", () => {
    matchGolden(
      PKG_SRC_META,
      "crosswalk-soc2",
      exportRegimeCrosswalk(soc2Crosswalk),
    );
  });
  test("pci-dss crosswalk export", () => {
    matchGolden(
      PKG_SRC_META,
      "crosswalk-pci-dss",
      exportRegimeCrosswalk(pciDssCrosswalk),
    );
  });
  test("gdpr crosswalk export", () => {
    matchGolden(
      PKG_SRC_META,
      "crosswalk-gdpr",
      exportRegimeCrosswalk(gdprCrosswalk),
    );
  });
});
