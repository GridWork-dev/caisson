// Golden + real-package parity for the trust-page poke's browser mirror (trust-page-logic.ts). Three
// independent anchors: (1) the committed golden fixtures
// packages/trust-page/src/__golden__/trust-page.default.{html,json}.txt, (2) the real package's own
// flattenManifestFacts/DEFAULT_TRUST_PAGE_ALLOWLIST/generateTrustPage, and (3) artifact-render's own
// redactToAllowlist — all imported here by relative path (apps/site does not declare @caisson/
// trust-page, @caisson/artifact-render, or @caisson/compliance-core as workspace dependencies — see
// trust-page-logic.ts's header for why). Bun's test runtime is node-like, so the real packages'
// node:crypto / node:dns imports resolve fine here even though they cannot reach a browser bundle.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { parseEvidencePackManifest } from "../../../../packages/compliance-core/src/evidence/pack-format.ts";
import {
  DEFAULT_TRUST_PAGE_ALLOWLIST as PKG_DEFAULT_ALLOWLIST,
  flattenManifestFacts as pkgFlattenManifestFacts,
} from "../../../../packages/trust-page/src/facts.ts";
import { generateTrustPage as pkgGenerateTrustPage } from "../../../../packages/trust-page/src/render.ts";
import { redactToAllowlist as pkgRedactToAllowlist } from "../../../../packages/artifact-render/src/redact.ts";

import {
  ALL_FACT_KEYS,
  DEFAULT_TRUST_PAGE_ALLOWLIST,
  SAMPLE_MANIFEST,
  flattenManifestFacts,
  redactToAllowlist,
  renderTrustPage,
} from "./trust-page-logic";
import type { FlatFacts } from "./trust-page-logic";

// The real packages type their flat-facts record as Record<string, JsonValue> (kernel's JsonValue
// includes `null`), while this poke's mirror narrows it to the three scalar types the sample manifest
// ever produces. Both hold the exact same shape at runtime for this fixture; the cast below exists
// only to compare them under bun:test's strict `toEqual` overloads.
function asFlatFacts(value: Readonly<Record<string, unknown>>): FlatFacts {
  return value as FlatFacts;
}

// The exact fixture packages/trust-page/src/render.test.ts's `fixtureManifest()` builds, re-parsed
// here through the real schema so REAL_MANIFEST and SAMPLE_MANIFEST carry identical flattened values.
const REAL_MANIFEST = parseEvidencePackManifest({
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
});

const GOLDEN_HTML = readFileSync(
  join(
    import.meta.dir,
    "../../../../packages/trust-page/src/__golden__/trust-page.default.html.txt",
  ),
  "utf8",
);
const GOLDEN_JSON = readFileSync(
  join(
    import.meta.dir,
    "../../../../packages/trust-page/src/__golden__/trust-page.default.json.txt",
  ),
  "utf8",
);

describe("flattenManifestFacts — parity with the real package", () => {
  test("produces the same flat record as the real flattenManifestFacts on matching input", () => {
    expect(flattenManifestFacts(SAMPLE_MANIFEST)).toEqual(
      asFlatFacts(pkgFlattenManifestFacts(REAL_MANIFEST)),
    );
  });

  test("ALL_FACT_KEYS covers exactly the real function's keys", () => {
    expect([...ALL_FACT_KEYS].sort()).toEqual(
      Object.keys(pkgFlattenManifestFacts(REAL_MANIFEST)).sort(),
    );
  });
});

describe("DEFAULT_TRUST_PAGE_ALLOWLIST — parity with the real package", () => {
  test("matches the real package's default allowlist exactly", () => {
    expect(DEFAULT_TRUST_PAGE_ALLOWLIST).toEqual(PKG_DEFAULT_ALLOWLIST);
  });

  test("excludes tenant id, raw hashes, and per-control detail", () => {
    expect(DEFAULT_TRUST_PAGE_ALLOWLIST).not.toContain("tenantId");
    expect(DEFAULT_TRUST_PAGE_ALLOWLIST).not.toContain("chainAnchor.tipHash");
    expect(
      DEFAULT_TRUST_PAGE_ALLOWLIST.some((k) => k.startsWith("controls.")),
    ).toBe(false);
  });
});

describe("redactToAllowlist — parity with the real artifact-render function", () => {
  test("agrees with the real redactToAllowlist on the default allowlist", () => {
    const mine = redactToAllowlist(
      flattenManifestFacts(SAMPLE_MANIFEST),
      DEFAULT_TRUST_PAGE_ALLOWLIST,
    );
    const real = pkgRedactToAllowlist(
      pkgFlattenManifestFacts(REAL_MANIFEST),
      PKG_DEFAULT_ALLOWLIST,
    );
    expect(mine).toEqual(asFlatFacts(real));
  });
});

describe("renderTrustPage — golden", () => {
  test("byte-stable default-allowlist HTML matches the committed golden fixture", () => {
    const page = renderTrustPage(SAMPLE_MANIFEST, DEFAULT_TRUST_PAGE_ALLOWLIST);
    expect(page.html).toBe(GOLDEN_HTML);
  });

  test("byte-stable default-allowlist JSON matches the committed golden fixture", () => {
    const page = renderTrustPage(SAMPLE_MANIFEST, DEFAULT_TRUST_PAGE_ALLOWLIST);
    expect(page.json).toBe(GOLDEN_JSON);
  });
});

describe("renderTrustPage — parity with the real generateTrustPage", () => {
  test("matches the real generateTrustPage's html/json byte-for-byte on the default allowlist", () => {
    const mine = renderTrustPage(SAMPLE_MANIFEST, DEFAULT_TRUST_PAGE_ALLOWLIST);
    const real = pkgGenerateTrustPage(REAL_MANIFEST);
    expect(mine.html).toBe(real.html);
    expect(mine.json).toBe(real.json);
  });
});

describe("the redaction gate — nothing off the allowlist reaches either output by default", () => {
  test("secret fields are absent from both outputs before any toggle", () => {
    const page = renderTrustPage(SAMPLE_MANIFEST, DEFAULT_TRUST_PAGE_ALLOWLIST);
    for (const secret of [
      "tenant-DO-NOT-LEAK-9f3a2c",
      "f".repeat(64),
      "DO-NOT-LEAK-CONTROL-TITLE-8b21",
      "AUDIT.IMMUTABLE-LOG",
    ]) {
      expect(page.html.includes(secret)).toBe(false);
      expect(page.json.includes(secret)).toBe(false);
    }
  });

  test("widening the allowlist to a real field makes it, and only it, appear (mine and real agree)", () => {
    const widened = [...DEFAULT_TRUST_PAGE_ALLOWLIST, "tenantId"];
    const mine = renderTrustPage(SAMPLE_MANIFEST, widened);
    expect(mine.json.includes("tenant-DO-NOT-LEAK-9f3a2c")).toBe(true);
    expect(mine.json.includes("f".repeat(64))).toBe(false);

    const real = pkgGenerateTrustPage(REAL_MANIFEST, { allowlist: widened });
    expect(real.json.includes("tenant-DO-NOT-LEAK-9f3a2c")).toBe(true);
    expect(mine.json).toBe(real.json);
  });
});

describe("the tamper control — a fabricated field can never leak, no matter the allowlist", () => {
  test("a key that was never part of the fact universe is silently absent, not an error", () => {
    const bogusAllowlist = [
      ...DEFAULT_TRUST_PAGE_ALLOWLIST,
      "internal.debugDump",
    ];
    const page = renderTrustPage(SAMPLE_MANIFEST, bogusAllowlist);
    expect(Object.hasOwn(page.facts, "internal.debugDump")).toBe(false);
    expect(page.json.includes("internal.debugDump")).toBe(false);
    expect(page.html.includes("internal.debugDump")).toBe(false);
  });

  test("the real redactToAllowlist agrees: a fabricated key added to the allowlist stays absent", () => {
    const bogusAllowlist = [...PKG_DEFAULT_ALLOWLIST, "internal.debugDump"];
    const real = pkgRedactToAllowlist(
      pkgFlattenManifestFacts(REAL_MANIFEST),
      bogusAllowlist,
    );
    expect(Object.hasOwn(real, "internal.debugDump")).toBe(false);
  });

  test("an empty allowlist renders no facts in either output", () => {
    const page = renderTrustPage(SAMPLE_MANIFEST, []);
    expect(page.facts).toEqual({});
    expect(page.html).not.toContain("<dl");
    expect(JSON.parse(page.json)).toEqual({ facts: {}, crosswalk: [] });
  });
});

describe("determinism", () => {
  test("identical input yields byte-identical output across calls", () => {
    const a = renderTrustPage(SAMPLE_MANIFEST, DEFAULT_TRUST_PAGE_ALLOWLIST);
    const b = renderTrustPage(SAMPLE_MANIFEST, DEFAULT_TRUST_PAGE_ALLOWLIST);
    expect(a).toEqual(b);
  });
});
