// Parity for the compliance-core poke's mirror (ADR-0378 lock 2): every collector mirror in
// compliance-core-logic.ts must produce the same status/summary/facts/reason as the REAL
// @caisson/compliance-core collector for the same fact, and generateEvidencePackMirror must block +
// derive readiness/summary/posture the same way the real generateEvidencePack does. This test runs
// under bun, so node:crypto / node:zlib / @caisson/tenancy-rls all resolve fine here, unlike the
// browser bundle the poke component ships in (see compliance-core-logic.ts's file header).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  anchorChain as realAnchorChain,
  buildChain as realBuildChain,
} from "@caisson/kernel/node";
import { hashChainLinkAsync as realHashChainLinkAsync } from "@caisson/kernel/audit-verify";
import {
  serializeEnvelope as realSerializeEnvelope,
  ALG_AES_256_GCM as REAL_ALG_AES_256_GCM,
  parseEnvelope as realParseEnvelope,
} from "@caisson/field-crypto";
// @caisson/compliance-core and @caisson/risk-register are NOT apps/site dependencies (only
// @caisson/kernel and @caisson/field-crypto are, per apps/site/package.json) - this poke's file
// ownership excludes package.json, so the real packages are reached by a relative path straight to
// their source instead of a bare specifier. bun/node module resolution walks up the FILE SYSTEM from
// the importing file's own location for each module's OWN bare imports, so compliance-core's
// internal "@caisson/kernel" etc. imports still resolve fine from the repo root node_modules - this
// is monorepo-standard resolution, not a hack; only the entry-point specifier is relative.
import { defineRiskEntry } from "../../../../packages/risk-register/src/index.ts";
import {
  aiRiskRegisterCollector as realAiRiskRegisterCollector,
  chainVerifyCollector as realChainVerifyCollector,
  EVIDENCE_PACK_FORMAT_VERSION as REAL_EVIDENCE_PACK_FORMAT_VERSION,
  EvidencePackBlockedError,
  fieldCryptoPolicyCollector as realFieldCryptoPolicyCollector,
  generateEvidencePack,
  impersonationCollector as realImpersonationCollector,
  rlsForceCollector as realRlsForceCollector,
  wormRetentionCollector as realWormRetentionCollector,
  type EvidenceControlPlan,
  type GenerateEvidencePackInput,
} from "../../../../packages/compliance-core/src/index.ts";

import {
  AI_RISK_REGISTER_PRESETS,
  EVIDENCE_PACK_FORMAT_VERSION,
  FIELD_CRYPTO_POLICY_PRESETS,
  IMPERSONATION_PRESETS,
  RLS_FORCE_PRESETS,
  SAMPLE_CHAIN_PAYLOADS,
  SAMPLE_ENCRYPTED_ENVELOPE,
  WORM_RETENTION_PRESETS,
  aiRiskRegisterCollectMirror,
  buildSampleChain,
  chainVerifyCollectMirror,
  chainVerifyPreset,
  collectSync,
  EvidencePackBlockedErrorMirror,
  fieldCryptoPolicyCollectMirror,
  generateEvidencePackMirror,
  impersonationCollectMirror,
  rlsForceCollectMirror,
  wormRetentionCollectMirror,
  type CollectorResultLike,
  type PresetKind,
} from "./compliance-core-logic";

const PRESETS: readonly PresetKind[] = ["unresolved", "flagged", "pass"];

/** Strips shape-only differences (the real item also carries `manualSlots`) for a like-for-like
 *  comparison of the fields this poke actually mirrors and renders. */
function normalize(r: {
  readonly status: string;
  readonly reason?: string;
  readonly item: {
    readonly collectorId: string;
    readonly controlId: string;
    readonly title: string;
    readonly summary: string;
    readonly facts: unknown;
  };
}) {
  return {
    status: r.status,
    reason: r.reason,
    collectorId: r.item.collectorId,
    controlId: r.item.controlId,
    title: r.item.title,
    summary: r.item.summary,
    facts: r.item.facts,
  };
}

describe("EVIDENCE_PACK_FORMAT_VERSION matches the real package", () => {
  test("format version string is identical", () => {
    expect(EVIDENCE_PACK_FORMAT_VERSION).toBe(
      REAL_EVIDENCE_PACK_FORMAT_VERSION,
    );
  });
});

describe("rlsForceCollectMirror parity vs the real rlsForceCollector", () => {
  for (const preset of PRESETS) {
    test(`${preset}: mirror matches the real collector`, () => {
      const fact = RLS_FORCE_PRESETS[preset];
      const mirror = rlsForceCollectMirror(fact);
      const real = realRlsForceCollector().collect(fact);
      expect(normalize(mirror)).toEqual(normalize(real));
    });
  }
});

describe("wormRetentionCollectMirror parity vs the real wormRetentionCollector", () => {
  for (const preset of PRESETS) {
    test(`${preset}: mirror matches the real collector`, () => {
      const fact = WORM_RETENTION_PRESETS[preset];
      const mirror = wormRetentionCollectMirror(fact);
      const real = realWormRetentionCollector().collect(fact);
      expect(normalize(mirror)).toEqual(normalize(real));
    });
  }

  test("the pass preset meets the golden fixture's exact retainUntil/requiredUntil pair", () => {
    const golden = JSON.parse(
      readFileSync(
        join(
          import.meta.dir,
          "..",
          "..",
          "..",
          "..",
          "packages",
          "compliance-core",
          "src",
          "__golden__",
          "evidence-pack.manifest.json",
        ),
        "utf8",
      ),
    ) as {
      controls: Array<{
        evidence: Array<{
          collectorId: string;
          facts: { retainUntil?: string; requiredUntil?: string };
        }>;
      }>;
    };
    const wormItem = golden.controls
      .flatMap((c) => c.evidence)
      .find((e) => e.facts.retainUntil === "2032-06-27T00:00:00.000Z");
    if (wormItem === undefined)
      throw new Error(
        "golden fixture is missing the expected worm-retention item",
      );
    const { retainUntil, requiredUntil } = wormItem.facts;
    if (retainUntil === undefined || requiredUntil === undefined) {
      throw new Error(
        "golden fixture's worm-retention item is missing retainUntil/requiredUntil",
      );
    }
    expect(WORM_RETENTION_PRESETS.pass.retainUntil?.toISOString()).toBe(
      retainUntil,
    );
    expect(WORM_RETENTION_PRESETS.pass.requiredUntil.toISOString()).toBe(
      requiredUntil,
    );
  });
});

describe("field-crypto envelope byte-parity vs the real @caisson/field-crypto", () => {
  test("SAMPLE_ENCRYPTED_ENVELOPE is byte-identical to the real serializeEnvelope() output", () => {
    const real = realSerializeEnvelope({
      algId: REAL_ALG_AES_256_GCM,
      keyVersion: 1,
      nonce: Buffer.alloc(12, 0x11),
      ciphertext: Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]),
      tag: Buffer.alloc(16, 0x22),
    });
    expect(SAMPLE_ENCRYPTED_ENVELOPE).toBe(real);
  });

  test("the real parseEnvelope() accepts the sample envelope as a real AES-256-GCM envelope", () => {
    const parsed = realParseEnvelope(SAMPLE_ENCRYPTED_ENVELOPE);
    expect(parsed.algId).toBe(REAL_ALG_AES_256_GCM);
  });

  test("the real parseEnvelope() rejects the flagged preset's plaintext field", () => {
    expect(() => realParseEnvelope("555-12-3456")).toThrow();
  });
});

describe("fieldCryptoPolicyCollectMirror parity vs the real fieldCryptoPolicyCollector", () => {
  for (const preset of PRESETS) {
    test(`${preset}: mirror matches the real collector`, () => {
      const fact = FIELD_CRYPTO_POLICY_PRESETS[preset];
      const mirror = fieldCryptoPolicyCollectMirror(fact);
      const real = realFieldCryptoPolicyCollector().collect(fact);
      expect(normalize(mirror)).toEqual(normalize(real));
    });
  }
});

/** Wraps a mirror preset's {riskId, treatmentPlan} pair into a fully-scored, real RiskEntry via the
 *  real defineRiskEntry() - the extra fields (subject/likelihood/impact/owner/evidenceDigest) are
 *  filler the aiRiskRegisterCollector.collect() never reads (it only reads riskId/treatmentPlan, per
 *  collector.ts's "validate by type, not Zod" boundary note), but a real RiskEntry is a strictly
 *  wider object than AiRiskEntryFactLike, so it is valid input to BOTH the mirror and the real
 *  collector - the strongest parity fixture available (real-shaped input, not a hand-typed stub). */
function toRealRiskEntry(e: { riskId: string; treatmentPlan: string | null }) {
  return defineRiskEntry({
    riskId: e.riskId,
    subject: "poke sample lane",
    likelihood: "possible",
    impact: "moderate",
    treatmentPlan: e.treatmentPlan,
    owner: "compliance-team",
    evidenceDigest: "a".repeat(64),
  });
}

// realAiRiskRegisterCollector's Fact type points at "@caisson/risk-register" resolved via the bare
// specifier (its own package.json "types" -> dist), while toRealRiskEntry() above builds entries
// against the SAME package resolved via our relative-path import (-> src). Both are the identical
// runtime module (bun's "bun" export condition points both at src/index.ts) but tsc's static
// resolution treats the two as separately-declared, so the branded `Residual` type is nominally (not
// structurally) distinct across them - a real cross-module identity quirk, not a real type error.
type RealAiRiskRegisterFact = Parameters<
  ReturnType<typeof realAiRiskRegisterCollector>["collect"]
>[0];

describe("aiRiskRegisterCollectMirror parity vs the real aiRiskRegisterCollector", () => {
  for (const preset of PRESETS) {
    test(`${preset}: mirror matches the real collector over real RiskEntry rows`, () => {
      const entries =
        AI_RISK_REGISTER_PRESETS[preset].entries.map(toRealRiskEntry);
      const mirror = aiRiskRegisterCollectMirror({ entries });
      const real = realAiRiskRegisterCollector().collect({
        entries,
      } as unknown as RealAiRiskRegisterFact);
      expect(normalize(mirror)).toEqual(normalize(real));
    });
  }
});

describe("impersonationCollectMirror parity vs the real impersonationCollector", () => {
  for (const preset of PRESETS) {
    test(`${preset}: mirror matches the real collector`, () => {
      const fact = IMPERSONATION_PRESETS[preset];
      const mirror = impersonationCollectMirror(fact);
      const real = realImpersonationCollector().collect(fact);
      expect(normalize(mirror)).toEqual(normalize(real));
    });
  }
});

describe("chain-verify: the sample chain's real hashes vs kernel's node:crypto buildChain", () => {
  test("buildSampleChain (WebCrypto) matches realBuildChain (node:crypto) hash-for-hash", async () => {
    const mirrorEntries = await buildSampleChain();
    const realEntries = realBuildChain(SAMPLE_CHAIN_PAYLOADS);
    expect(mirrorEntries.length).toBe(realEntries.length);
    for (let i = 0; i < mirrorEntries.length; i++) {
      expect(mirrorEntries[i]?.hash).toBe(realEntries[i]?.hash);
      expect(mirrorEntries[i]?.prevHash).toBe(realEntries[i]?.prevHash);
      expect(mirrorEntries[i]?.seq).toBe(realEntries[i]?.seq);
    }
  });

  test("hashChainLinkAsync is the exact function this file re-exports (same reference, not re-implemented)", async () => {
    const h1 = await realHashChainLinkAsync(null, { a: 1 });
    const h2 = await realHashChainLinkAsync(null, { a: 1 });
    expect(h1).toBe(h2);
    expect(/^[0-9a-f]{64}$/.test(h1)).toBe(true);
  });
});

describe("chainVerifyCollectMirror parity vs the real chainVerifyCollector", () => {
  for (const preset of PRESETS) {
    test(`${preset}: mirror matches the real collector`, async () => {
      const fact = await chainVerifyPreset(preset);
      const mirror = await chainVerifyCollectMirror(fact);
      const real = realChainVerifyCollector().collect(
        fact.anchor === null
          ? { entries: fact.entries, anchor: null }
          : { entries: fact.entries, anchor: fact.anchor },
      );
      expect(normalize(mirror)).toEqual(normalize(real));
    });
  }

  test("anchorChain()-minted anchor over the real chain matches the pass preset's anchor", async () => {
    const entries = realBuildChain(SAMPLE_CHAIN_PAYLOADS);
    const realAnchor = realAnchorChain(entries);
    const mirrorFact = await chainVerifyPreset("pass");
    expect(mirrorFact.anchor?.tipHash).toBe(realAnchor.tipHash);
    expect(mirrorFact.anchor?.genesisHash).toBe(realAnchor.genesisHash);
    expect(mirrorFact.anchor?.length).toBe(realAnchor.length);
  });
});

describe("collectSync dispatch", () => {
  test("routes every sync collector key to its own mirror", () => {
    expect(normalize(collectSync("rlsForce", "pass"))).toEqual(
      normalize(rlsForceCollectMirror(RLS_FORCE_PRESETS.pass)),
    );
    expect(normalize(collectSync("wormRetention", "flagged"))).toEqual(
      normalize(wormRetentionCollectMirror(WORM_RETENTION_PRESETS.flagged)),
    );
    expect(normalize(collectSync("fieldCryptoPolicy", "unresolved"))).toEqual(
      normalize(
        fieldCryptoPolicyCollectMirror(FIELD_CRYPTO_POLICY_PRESETS.unresolved),
      ),
    );
    expect(normalize(collectSync("aiRiskRegister", "pass"))).toEqual(
      normalize(aiRiskRegisterCollectMirror(AI_RISK_REGISTER_PRESETS.pass)),
    );
    expect(normalize(collectSync("impersonation", "flagged"))).toEqual(
      normalize(impersonationCollectMirror(IMPERSONATION_PRESETS.flagged)),
    );
  });
});

// --- generateEvidencePackMirror parity vs the real generateEvidencePack -------------------------

const DUMMY_CHAIN_ANCHOR = { length: 1, tipHash: "0".repeat(64) };

function wrapAsControlPlan(result: CollectorResultLike): EvidenceControlPlan {
  // The mirror's CollectorResultLike does not model manualSlots (a simplification noted in
  // compliance-core-logic.ts's header); the real generator's buildItem() reads item.manualSlots
  // unconditionally, so this fixture-only wrapper adds the empty array the real shape requires.
  const withManualSlots = {
    ...result,
    item: { ...result.item, manualSlots: [] },
  };
  return {
    controlId: result.item.controlId,
    title: result.item.title,
    family: "Sample family",
    statement:
      "Sample statement for a real generateEvidencePack() parity fixture, never rendered by the poke.",
    crosswalk: [],
    evidence: [withManualSlots],
  };
}

describe("generateEvidencePackMirror, phase 1 (BLOCKED) parity", () => {
  test("throws EvidencePackBlockedErrorMirror with the same code/httpStatus/message as the real error", async () => {
    const chainUnresolved = await chainVerifyCollectMirror(
      await chainVerifyPreset("unresolved"),
    );
    const rlsPass = rlsForceCollectMirror(RLS_FORCE_PRESETS.pass);

    let mirrorCaught: unknown;
    try {
      generateEvidencePackMirror(
        [chainUnresolved, rlsPass],
        "tenant-parity-test",
        { id: "soc2-tsc", version: "2024.1" },
      );
      throw new Error("expected generateEvidencePackMirror to throw");
    } catch (err) {
      mirrorCaught = err;
    }
    expect(mirrorCaught).toBeInstanceOf(EvidencePackBlockedErrorMirror);
    const mirrorErr = mirrorCaught as EvidencePackBlockedErrorMirror;

    const realInput: GenerateEvidencePackInput = {
      tenantId: "tenant-parity-test",
      framework: { id: "soc2-tsc", title: "SOC 2 sample", version: "2024.1" },
      chainAnchor: DUMMY_CHAIN_ANCHOR,
      controls: [
        wrapAsControlPlan(chainUnresolved),
        wrapAsControlPlan(rlsPass),
      ],
      now: new Date("2026-07-21T00:00:00.000Z"),
      crosswalkRollup: { cells: [] },
    };
    let realCaught: unknown;
    try {
      generateEvidencePack(realInput);
      throw new Error("expected generateEvidencePack to throw");
    } catch (err) {
      realCaught = err;
    }
    expect(realCaught).toBeInstanceOf(EvidencePackBlockedError);
    const realErr = realCaught as EvidencePackBlockedError;

    expect(mirrorErr.code).toBe(realErr.code);
    expect(mirrorErr.httpStatus).toBe(realErr.httpStatus);
    expect(mirrorErr.message).toBe(realErr.message);
    expect(mirrorErr.report.blocked).toBe(realErr.report.blocked);
    expect(mirrorErr.report.unresolved).toEqual(realErr.report.unresolved);
  });
});

describe("generateEvidencePackMirror, phase 2 (pack generates) parity", () => {
  test("derives the same readiness/summary/posture as the real generator over the same evidence", async () => {
    const chainPass = await chainVerifyCollectMirror(
      await chainVerifyPreset("pass"),
    );
    const rlsFlagged = rlsForceCollectMirror(RLS_FORCE_PRESETS.flagged);

    const mirrorPack = generateEvidencePackMirror(
      [chainPass, rlsFlagged],
      "tenant-parity-test",
      {
        id: "soc2-tsc",
        version: "2024.1",
      },
    );

    const realInput: GenerateEvidencePackInput = {
      tenantId: "tenant-parity-test",
      framework: { id: "soc2-tsc", title: "SOC 2 sample", version: "2024.1" },
      chainAnchor: DUMMY_CHAIN_ANCHOR,
      controls: [wrapAsControlPlan(chainPass), wrapAsControlPlan(rlsFlagged)],
      now: new Date("2026-07-21T00:00:00.000Z"),
      crosswalkRollup: { cells: [] },
    };
    const realPack = generateEvidencePack(realInput);

    expect(mirrorPack.summary).toEqual(realPack.manifest.summary);
    const byId = (id: string) =>
      mirrorPack.controls.find((c) => c.controlId === id);
    for (const c of realPack.manifest.controls) {
      expect(byId(c.controlId)?.readiness).toBe(c.readiness);
    }
  });

  test("all six collectors passing yields five ready controls and the honest all-clear posture", async () => {
    const results: CollectorResultLike[] = [
      collectSync("rlsForce", "pass"),
      await chainVerifyCollectMirror(await chainVerifyPreset("pass")),
      collectSync("wormRetention", "pass"),
      collectSync("fieldCryptoPolicy", "pass"),
      collectSync("aiRiskRegister", "pass"),
      collectSync("impersonation", "pass"),
    ];
    const pack = generateEvidencePackMirror(results, "tenant-poke-demo", {
      id: "soc2-tsc",
      version: "2024.1",
    });

    // ACCESS-CONTROL.LOGICAL carries two evidence items (rlsForce + impersonation) - five controls total.
    expect(pack.controls.length).toBe(5);
    expect(pack.summary.totalControls).toBe(5);
    expect(pack.summary.controlsReady).toBe(5);
    expect(pack.summary.controlsWithGaps).toBe(0);
    expect(pack.summary.totalEvidenceItems).toBe(6);
    expect(pack.summary.posture).toBe(
      "5 of 5 controls evidence-ready; no gaps recorded.",
    );
    expect(pack.summary.posture).not.toMatch(/compliant|certified/i);

    const accessControl = pack.controls.find(
      (c) => c.controlId === "ACCESS-CONTROL.LOGICAL",
    );
    expect(accessControl?.evidence.length).toBe(2);
  });
});

describe("golden-fixture anchors (packages/compliance-core/src/__golden__)", () => {
  test("posturePhraseMirror's 1-ready/1-gap sentence matches the golden manifest's exact posture string", () => {
    const chainUnresolved = null as never; // unused placeholder to keep block shape uniform
    void chainUnresolved;
    const golden = JSON.parse(
      readFileSync(
        join(
          import.meta.dir,
          "..",
          "..",
          "..",
          "..",
          "packages",
          "compliance-core",
          "src",
          "__golden__",
          "evidence-pack.manifest.json",
        ),
        "utf8",
      ),
    ) as { summary: { posture: string } };

    const chainPass = {
      item: {
        collectorId: "z",
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "t",
        summary: "s",
        facts: {},
      },
      status: "pass" as const,
    };
    const rlsFlagged = {
      item: {
        collectorId: "z2",
        controlId: "DATA-PROTECTION.TENANT-ISOLATION",
        title: "t2",
        summary: "s2",
        facts: {},
      },
      status: "flagged" as const,
      reason: "r",
    };
    const pack = generateEvidencePackMirror(
      [chainPass, rlsFlagged],
      "tenant-acme-prod",
      { id: "soc2-tsc", version: "2024.1" },
    );
    expect(pack.summary.posture).toBe(golden.summary.posture);
  });

  test("the blocked-report shape matches evidence-pack.blocked.json's keys", () => {
    const golden = JSON.parse(
      readFileSync(
        join(
          import.meta.dir,
          "..",
          "..",
          "..",
          "..",
          "packages",
          "compliance-core",
          "src",
          "__golden__",
          "evidence-pack.blocked.json",
        ),
        "utf8",
      ),
    ) as {
      formatVersion: string;
      blocked: boolean;
      unresolved: Array<{
        controlId: string;
        collectorId: string;
        reason: string;
      }>;
    };
    expect(golden.formatVersion).toBe(EVIDENCE_PACK_FORMAT_VERSION);
    expect(golden.blocked).toBe(true);
    expect(Object.keys(golden.unresolved[0] ?? {}).sort()).toEqual([
      "collectorId",
      "controlId",
      "reason",
    ]);
  });
});
