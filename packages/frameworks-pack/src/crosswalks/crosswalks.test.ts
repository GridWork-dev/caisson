import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { matchGolden } from "@caisson-sh/testing";
import {
  defineRegimeCrosswalk,
  exportRegimeCrosswalk,
  nist80053Crosswalk,
  type RegimeCrosswalk,
  type RegimeCrosswalkInput,
} from "@caisson-sh/oscal-spine";
import {
  gdprCrosswalk,
  iso27001Crosswalk,
  pciDssCrosswalk,
  regimeCrosswalks,
  soc2Crosswalk,
} from "./regimes.ts";
import { euAiAct } from "../frameworks/eu-ai-act.ts";
import { hipaaSecurity } from "../frameworks/hipaa-security.ts";
import { soc2Tsc } from "../frameworks/soc2-tsc.ts";
import type { Framework } from "../registry/control.ts";

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
        mechanism: "@caisson-sh/x — mechanism",
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
        mechanism: "@caisson-sh/x — mechanism",
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
        mechanism: "@caisson-sh/x — mechanism",
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
          mechanism: "@caisson-sh/x — mechanism",
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
      mechanism: "@caisson-sh/x — mechanism",
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
          mechanism: "@caisson-sh/x — mechanism",
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
            mechanism: "@caisson-sh/x — mechanism",
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
          mechanism: "@caisson-sh/x — mechanism",
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
            mechanism: "@caisson-sh/x — mechanism",
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

  test("the own-authored SOC2/PCI/GDPR crosswalks carry neither field (no v1 churn)", () => {
    // ISO (below) is the sole exception -- it is SEEDED (seedProvenance) and JOINABLE
    // (canonicalControlId), by design (ADR-0347 Fork G1/G2).
    for (const cw of [soc2Crosswalk, pciDssCrosswalk, gdprCrosswalk]) {
      expect(cw.seedProvenance).toBeUndefined();
      for (const row of cw.rows) {
        expect(row.canonicalControlId).toBeUndefined();
      }
    }
  });

  test("iso27001Crosswalk carries seedProvenance and every row a canonicalControlId", () => {
    expect(iso27001Crosswalk.seedProvenance?.sourceId).toBe(
      "nist-sp800-53r5-iso27001-2022-olir",
    );
    expect(iso27001Crosswalk.seedProvenance?.sourceDigest).toMatch(
      /^[0-9a-f]{64}$/,
    );
    for (const row of iso27001Crosswalk.rows) {
      expect(row.canonicalControlId).toBeDefined();
    }
  });
});

describe("every authored crosswalk is honest and well-formed", () => {
  const cases: ReadonlyArray<readonly [string, RegimeCrosswalk]> = [
    ["soc2", soc2Crosswalk],
    ["pci-dss", pciDssCrosswalk],
    ["gdpr", gdprCrosswalk],
    ["iso-27001", iso27001Crosswalk],
    ["nist-800-53", nist80053Crosswalk],
  ];

  test("regimeCrosswalks holds the three ADR-0277 regimes plus iso-27001 and nist-800-53 (ADR-0333/ADR-0347/ADR-0363-0364; FedRAMP itself still out)", () => {
    expect(regimeCrosswalks.map((c) => c.regime).sort()).toEqual([
      "gdpr",
      "iso-27001",
      "nist-800-53",
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
        // Caisson is never the grammatical subject of "compliant/certified/satisfies/fedramp"
        // (memo §a/§b, ADR-0080; "fedramp" added by the oscal-spine SPEC binding requirement 3 —
        // no "FedRAMP nearly free" claim anywhere). The neutral "maps to / implements a technical
        // control" register holds in the data. (regimeSpecificDisclaimer is exempt — it
        // legitimately uses these words in NEGATED form, e.g. "does not make you PCI DSS
        // compliant" / "not FedRAMP authorized"; that text is checked for the dangerous PHRASES
        // instead, below — never the bare word.)
        const forbidden = /\b(certified|compliant|satisfies|fedramp)\b/i;
        expect(cw.title).not.toMatch(forbidden);
        for (const row of cw.rows) {
          expect(row.summary).not.toMatch(forbidden);
          expect(row.mechanism).not.toMatch(forbidden);
          expect(row.evidence).not.toMatch(forbidden);
          expect(row.buyerResponsibility).not.toMatch(forbidden);
        }
      });

      test("regimeSpecificDisclaimer never claims FedRAMP-nearly-free / nearly-FedRAMP (binding requirement 3)", () => {
        // The bare word "fedramp" IS allowed here in honest negated form (nist-800-53.ts's own
        // disclaimer says "not FedRAMP authorized" / "no claim of FedRAMP readiness or
        // proximity" — mirrors how SOC2/PCI/GDPR/ISO already negate "compliant"/"certified" in
        // their own disclaimers). What binding requirement 3 forbids is the SPECIFIC marketing
        // phrase ADR-0363/SPEC name verbatim: "FedRAMP nearly free" / "nearly FedRAMP".
        const dangerousPhrase =
          /fedramp[\s-]*nearly[\s-]*free|nearly[\s-]*fedramp/i;
        expect(cw.regimeSpecificDisclaimer).not.toMatch(dangerousPhrase);
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
  test("iso-27001 crosswalk export", () => {
    matchGolden(
      PKG_SRC_META,
      "crosswalk-iso-27001",
      exportRegimeCrosswalk(iso27001Crosswalk),
    );
  });
});

describe("Legal-gate guards (ADR-0333/ADR-0347 Group G) -- the ISO crosswalk never overclaims", () => {
  test("every iso27001Crosswalk row is maps-to -- none is implements", () => {
    for (const row of iso27001Crosswalk.rows) {
      expect(row.claim).toBe("maps-to");
    }
  });

  test("no shipped pack's crosswalk reference to the ISO-27001 framework label carries an expert-reviewed verification", () => {
    // Forward-looking structural guard: none of the three shipped packs crosswalks a control
    // DIRECTLY at the "ISO-27001" framework label today (the join instead runs the other way, via
    // iso27001Crosswalk's own canonicalControlId -- see crosswalk-rollup.ts). If one ever does, the
    // Legal gate (ADR-0333) still forbids an expert-reviewed claim on it pending the ADR-0319 answer.
    const catalogs: readonly Framework[] = [soc2Tsc, hipaaSecurity, euAiAct];
    for (const catalog of catalogs) {
      for (const control of catalog.controls) {
        for (const ref of control.crosswalk) {
          if (ref.framework !== "ISO-27001") continue;
          expect(ref.verification?.status).not.toBe("expert-reviewed");
        }
      }
    }
  });
});

describe("ADR-0364 F2 -- OLIR relationship vocabulary is scoped to nist80053Crosswalk only", () => {
  test("the four existing crosswalks never populate relationship/rationale/strength", () => {
    for (const cw of [
      soc2Crosswalk,
      pciDssCrosswalk,
      gdprCrosswalk,
      iso27001Crosswalk,
    ]) {
      for (const row of cw.rows) {
        expect(row.relationship).toBeUndefined();
        expect(row.rationale).toBeUndefined();
        expect(row.strength).toBeUndefined();
      }
    }
  });

  test("every nist80053Crosswalk row carries NIST IR 8278A relationship + rationale", () => {
    const validRelationships = new Set([
      "subset-of",
      "intersects-with",
      "equal",
      "superset-of",
      "not-related-to",
    ]);
    const validRationales = new Set(["syntactic", "semantic", "functional"]);
    for (const row of nist80053Crosswalk.rows) {
      expect(row.relationship).toBeDefined();
      expect(validRelationships.has(row.relationship as string)).toBe(true);
      expect(row.rationale).toBeDefined();
      expect(validRationales.has(row.rationale as string)).toBe(true);
      if (row.strength !== undefined) {
        expect(row.strength).toBeGreaterThanOrEqual(0);
        expect(row.strength).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("nist80053Crosswalk -- claim cap + required canonicalControlId (ADR-0364)", () => {
  test("every row is maps-to -- none is implements (no verification field exists to promote it)", () => {
    for (const row of nist80053Crosswalk.rows) {
      expect(row.claim).toBe("maps-to");
    }
  });

  test("every row's canonicalControlId is set and resolves to a real control across the shipped packs", () => {
    const allCanonicalIds = new Set(
      [soc2Tsc, hipaaSecurity, euAiAct].flatMap((fw) =>
        fw.controls.map((c) => c.id),
      ),
    );
    for (const row of nist80053Crosswalk.rows) {
      expect(row.canonicalControlId).toBeDefined();
      expect(allCanonicalIds.has(row.canonicalControlId as string)).toBe(true);
    }
  });

  test("carries seedProvenance pinning the vendored catalog (binding requirement 1)", () => {
    expect(nist80053Crosswalk.seedProvenance?.sourceDigest).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(nist80053Crosswalk.seedProvenance?.sourceUrl).toMatch(/^https:\/\//);
  });
});
