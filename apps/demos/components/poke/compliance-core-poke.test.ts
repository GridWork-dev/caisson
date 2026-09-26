// The compliance-core poke's checkable claims, now that it drives the REAL package through its
// browser entry (ADR-0396) and the hand-ported mirror (compliance-core-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build. A
//      bundler substitutes a polyfill for a node builtin and exits 0, so only the source walk can
//      prove this; the positive control keeps a walker gone blind from greening vacuously.
//   2. The four real collectors ARE the package's — card identity is read off the collector object
//      (reference identity a copied string table could never claim), and every card evidences a
//      REAL control of the real SOC 2 pack, so a control-id rename upstream fails here.
//   3. "Generate" runs the REAL assembly: the flag-never-guess refusal throws the package's own
//      `EvidencePackBlockedError` with a Zod-validated report, and a clean board yields a manifest
//      the real pack-format schema accepted, with readiness DERIVED per control.
//   4. The two poke-local cards (chain-verify, field-crypto-policy — both excluded from the browser
//      entry for a node dependency) are pinned against the real collectors they stand in for,
//      including card identity and complete evidence output. The lower-level envelope and link-hash
//      pins remain as positive controls for the browser-safe primitives used to build the same facts.
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ALG_AES_256_GCM, parseEnvelope } from "@caisson-sh/field-crypto";
import { hashChainLink } from "@caisson-sh/kernel/node";
import { soc2Tsc } from "@caisson-sh/frameworks-pack/browser";
import {
  chainVerifyCollector,
  fieldCryptoPolicyCollector,
} from "@caisson-sh/compliance-core";
import {
  EvidencePackBlockedError,
  rlsForceCollector,
} from "@caisson-sh/compliance-core/browser";

import {
  CARDS,
  FIELD_CRYPTO_PRESETS,
  PRESET_ORDER,
  SAMPLE_ENCRYPTED_ENVELOPE,
  SAMPLE_TENANT_ID,
  buildControlPlans,
  buildEvidencePack,
  buildSampleChain,
  chainAnchorFor,
  collectChainVerify,
  collectFieldCryptoPolicy,
  collectSync,
  generateFailureOutcome,
  looksEncryptedAtRest,
  manifestChainAnchor,
  type PresetKind,
  type SyncCardKey,
} from "./compliance-core-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "compliance-core-poke.tsx");

const SYNC_KEYS: readonly SyncCardKey[] = [
  "rlsForce",
  "wormRetention",
  "fieldCryptoPolicy",
  "aiRiskRegister",
  "impersonation",
];

/** Every card's result for one uniform board state. */
async function boardResults(preset: PresetKind) {
  const sync = SYNC_KEYS.map((k) => collectSync(k, preset));
  return [...sync, await collectChainVerify(preset)];
}

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the packages the poke drives", () => {
    expect(walk.files).toContain("packages/compliance-core/src/browser.ts");
    expect(walk.files).toContain(
      "packages/compliance-core/src/evidence/assemble.ts",
    );
    expect(walk.files).toContain("packages/frameworks-pack/src/browser.ts");
    expect(walk.files).toContain("packages/kernel/src/audit-verify.ts");
  });

  test("and never the node-only halves it deliberately leaves behind", () => {
    for (const excluded of [
      "packages/compliance-core/src/index.ts",
      "packages/compliance-core/src/evidence/generate.ts",
      "packages/compliance-core/src/evidence/collectors/chain-verify.ts",
      "packages/compliance-core/src/evidence/collectors/field-crypto-policy.ts",
      "packages/kernel/src/node.ts",
      "packages/kernel/src/audit-chain.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
    expect(walk.files.some((f) => f.startsWith("packages/field-crypto/"))).toBe(
      false,
    );
  });

  test("positive control: the compliance-core barrel DOES report node builtins", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/compliance-core/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
    expect(
      tainted.offenders.some((o) => o.file.endsWith("evidence/generate.ts")),
    ).toBe(true);
  });
});

describe("the cards are the real collectors, on real controls", () => {
  test("card identity is read off the collector object, not a copied string table", () => {
    // Reference identity against a freshly-built collector: a hand-copied id table would pass a
    // string comparison but could not track an upstream rename, which this does.
    const real = rlsForceCollector();
    expect(CARDS.rlsForce.id).toBe(real.id);
    expect(CARDS.rlsForce.controlId).toBe(real.controlId);
    expect(CARDS.rlsForce.title).toBe(real.title);
  });

  test("the two poke-local card identities track their real node collectors", () => {
    const chain = chainVerifyCollector({
      controlId: CARDS.chainVerify.controlId,
    });
    expect(CARDS.chainVerify.id).toBe(chain.id);
    expect(CARDS.chainVerify.controlId).toBe(chain.controlId);
    expect(CARDS.chainVerify.title).toBe(chain.title);

    const fieldCrypto = fieldCryptoPolicyCollector({
      controlId: CARDS.fieldCryptoPolicy.controlId,
    });
    expect(CARDS.fieldCryptoPolicy.id).toBe(fieldCrypto.id);
    expect(CARDS.fieldCryptoPolicy.controlId).toBe(fieldCrypto.controlId);
    expect(CARDS.fieldCryptoPolicy.title).toBe(fieldCrypto.title);
  });

  test("every card evidences a control that really exists in the SOC 2 pack", () => {
    const packIds = new Set(soc2Tsc.controls.map((c) => c.id));
    for (const card of Object.values(CARDS)) {
      expect(packIds.has(card.controlId)).toBe(true);
    }
  });

  test("the collectors compute their verdict, they do not assert it", async () => {
    for (const preset of PRESET_ORDER) {
      for (const result of await boardResults(preset)) {
        expect(result.status).toBe(preset);
        if (preset !== "pass") {
          expect(result.reason?.length ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  test("control plans carry the real pack's metadata, never a fabricated triple", async () => {
    const plans = buildControlPlans(await boardResults("pass"));
    // ACCESS-CONTROL.LOGICAL is evidenced twice (rls-force + impersonation) — one control, two items.
    const logical = plans.find((p) => p.controlId === "ACCESS-CONTROL.LOGICAL");
    expect(logical?.evidence).toHaveLength(2);
    for (const plan of plans) {
      const control = soc2Tsc.controls.find((c) => c.id === plan.controlId);
      if (control === undefined) {
        throw new Error(`no such control: ${plan.controlId}`);
      }
      expect(plan.title).toBe(control.title);
      expect(plan.statement).toBe(control.statement);
      expect(plan.crosswalk).toBe(control.crosswalk);
    }
  });
});

describe("generate runs the package's real assembly", () => {
  test("an unresolved board is REFUSED with the package's own blocked error", async () => {
    const err = await buildEvidencePack(await boardResults("unresolved")).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(EvidencePackBlockedError);
    const blocked = err as EvidencePackBlockedError;
    expect(blocked.code).toBe("evidence_pack_blocked");
    expect(blocked.httpStatus).toBe(422);
    // Every one of the six collectors is listed, sorted by (controlId, collectorId).
    expect(blocked.report.unresolved).toHaveLength(6);
    const keys = blocked.report.unresolved.map(
      (u) => `${u.controlId}/${u.collectorId}`,
    );
    expect([...keys].sort()).toEqual(keys);
    for (const u of blocked.report.unresolved) {
      expect(u.reason.length).toBeGreaterThan(0);
    }
    expect(generateFailureOutcome(blocked)).toEqual({
      state: "fail",
      pack: null,
      blocked,
    });
  });

  test("an unexpected assembly error becomes a generic visible failure outcome", () => {
    expect(
      generateFailureOutcome(new Error("internal control-map detail")),
    ).toEqual({
      state: "fail",
      pack: null,
      blocked: null,
    });
  });

  test("one unresolved collector blocks the WHOLE pack, not just its control", async () => {
    const results = [
      ...SYNC_KEYS.map((k) =>
        collectSync(k, k === "aiRiskRegister" ? "unresolved" : "pass"),
      ),
      await collectChainVerify("pass"),
    ];
    const err = await buildEvidencePack(results).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(EvidencePackBlockedError);
    expect((err as EvidencePackBlockedError).report.unresolved).toHaveLength(1);
  });

  test("a clean board yields a schema-validated manifest with DERIVED readiness", async () => {
    const pack = await buildEvidencePack(await boardResults("pass"));
    expect(pack.formatVersion).toBe("2");
    expect(pack.tenantId).toBe(SAMPLE_TENANT_ID);
    expect(pack.framework.id).toBe(soc2Tsc.id);
    expect(pack.chainAnchor).toEqual(await manifestChainAnchor());
    expect(pack.controls.every((c) => c.readiness === "ready")).toBe(true);
    expect(pack.summary.totalControls).toBe(pack.controls.length);
    expect(pack.summary.controlsWithGaps).toBe(0);
    expect(pack.summary.totalEvidenceItems).toBe(6);
    expect(pack.summary.posture).toContain("no gaps recorded");
    // Derived, never asserted: a flagged item anywhere turns its control into a gap.
    const mixed = [
      ...SYNC_KEYS.map((k) =>
        collectSync(k, k === "wormRetention" ? "flagged" : "pass"),
      ),
      await collectChainVerify("pass"),
    ];
    const gapped = await buildEvidencePack(mixed);
    expect(gapped.summary.controlsWithGaps).toBe(1);
    expect(
      gapped.controls.find((c) => c.controlId === "DATA-PROTECTION.DISPOSAL")
        ?.readiness,
    ).toBe("gap");
    expect(gapped.summary.posture).toContain("1 gap recorded");
  });

  test("the crosswalk rollup is computed over the real pack, not stubbed empty", async () => {
    const pack = await buildEvidencePack(await boardResults("pass"));
    expect(pack.crosswalkRollup.cells.length).toBeGreaterThan(0);
    for (const cell of pack.crosswalkRollup.cells) {
      expect(cell.canonicalControlIds.length).toBeGreaterThan(0);
      expect(cell.status).toBe("ready");
    }
  });
});

describe("the two poke-local cards are pinned to the real primitives", () => {
  test("field-crypto output is identical to the real collector for every preset", () => {
    const real = fieldCryptoPolicyCollector({
      controlId: CARDS.fieldCryptoPolicy.controlId,
    });
    for (const preset of PRESET_ORDER) {
      expect(collectFieldCryptoPolicy(preset)).toEqual(
        real.collect({ fields: FIELD_CRYPTO_PRESETS[preset] }),
      );
    }
  });

  test("chain-verify output is identical to the real collector for every preset", async () => {
    const real = chainVerifyCollector({
      controlId: CARDS.chainVerify.controlId,
    });
    const entries = await buildSampleChain();
    for (const preset of PRESET_ORDER) {
      expect(await collectChainVerify(preset)).toEqual(
        real.collect({ entries, anchor: await chainAnchorFor(preset) }),
      );
    }
  });

  test("the sample envelope is a real AES-256-GCM field-crypto envelope", () => {
    const parsed = parseEnvelope(SAMPLE_ENCRYPTED_ENVELOPE);
    expect(parsed.algId).toBe(ALG_AES_256_GCM);
    expect(parsed.keyVersion).toBe(1);
    // …and the poke's own header read agrees with the real parser on both samples.
    expect(looksEncryptedAtRest(SAMPLE_ENCRYPTED_ENVELOPE)).toBe(true);
    expect(looksEncryptedAtRest("555-12-3456")).toBe(false);
    expect(() => parseEnvelope("555-12-3456")).toThrow();
  });

  test("the sample chain's hashes are the real link hashes, and the anchor binds its tip", async () => {
    const entries = await buildSampleChain();
    expect(entries).toHaveLength(3);
    for (const entry of entries) {
      expect(entry.hash).toBe(hashChainLink(entry.prevHash, entry.payload));
    }
    const anchor = await manifestChainAnchor();
    const tip = entries.at(-1);
    const genesis = entries[0];
    if (tip === undefined || genesis === undefined) {
      throw new Error("empty sample chain");
    }
    expect(anchor.length).toBe(entries.length);
    expect(anchor.tipHash).toBe(tip.hash);
    expect(anchor.genesisHash).toBe(genesis.hash);
  });

  test("a forged anchor tip is caught by the recompute, not waved through", async () => {
    const flagged = await collectChainVerify("flagged");
    expect(flagged.status).toBe("flagged");
    expect(flagged.item.facts).toMatchObject({ valid: false, brokenAt: 2 });
  });
});
