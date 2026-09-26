// src/evidence/binding-table.test.ts — the control<->collector binding table (PLAN Group E task E1).
import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { euAiAct, hipaaSecurity, soc2Tsc } from "@caisson-sh/frameworks-pack";
import {
  buildBindingTable,
  type BindingSourceCollector,
} from "./binding-table.ts";
import { rlsForceCollector } from "./collectors/rls-force.ts";
import { chainVerifyCollector } from "./collectors/chain-verify.ts";
import { wormRetentionCollector } from "./collectors/worm-retention.ts";
import { fieldCryptoPolicyCollector } from "./collectors/field-crypto-policy.ts";
import { aiRiskRegisterCollector } from "./collectors/ai-risk-register.ts";
import { impersonationCollector } from "./collectors/impersonation.ts";

const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;

/** Every shipped collector, at its DEFAULT (constructor-overridable) control-id binding. */
const SHIPPED_COLLECTORS: readonly BindingSourceCollector[] = [
  rlsForceCollector(),
  chainVerifyCollector(),
  wormRetentionCollector(),
  fieldCryptoPolicyCollector(),
  aiRiskRegisterCollector(),
  impersonationCollector(),
];

const PACKS = [soc2Tsc, hipaaSecurity, euAiAct];

describe("buildBindingTable — a derived artifact, not a new config layer", () => {
  test("projects every shipped collector's own declared binding, sorted by collectorId", () => {
    const table = buildBindingTable(SHIPPED_COLLECTORS, PACKS);
    expect(table).toHaveLength(6);
    const ids = table.map((r) => r.collectorId);
    expect(ids).toEqual([...ids].sort());
  });

  test("determinism: input order never changes the output order or content", () => {
    const a = buildBindingTable(SHIPPED_COLLECTORS, PACKS);
    const b = buildBindingTable([...SHIPPED_COLLECTORS].reverse(), PACKS);
    expect(a).toEqual(b);
  });

  test("a collector's controlId resolving to a real canonical control is marked resolved", () => {
    const table = buildBindingTable(SHIPPED_COLLECTORS, PACKS);
    const row = table.find(
      (r) => r.collectorId === "substrate.audit-chain-integrity",
    );
    expect(row?.controlId).toBe("AUDIT.IMMUTABLE-LOG");
    expect(row?.resolved).toBe(true);
  });

  test(
    "known gap: substrate.field-crypto-policy's default controlId has no matching canonical " +
      "control in any shipped pack today (pre-existing, out of this wave's scope) -- the table " +
      "surfaces this honestly rather than hiding or silently patching it",
    () => {
      const table = buildBindingTable(SHIPPED_COLLECTORS, PACKS);
      const unresolved = table
        .filter((r) => !r.resolved)
        .map((r) => r.collectorId);
      expect(unresolved).toEqual(["substrate.field-crypto-policy"]);
    },
  );

  test("every manual slot the collector declares is projected by id", () => {
    const table = buildBindingTable(SHIPPED_COLLECTORS, PACKS);
    const rls = table.find(
      (r) => r.collectorId === "substrate.tenant-isolation-force-rls",
    );
    expect(rls?.manualSlotIds).toEqual(["tenant-isolation-test-report"]);
  });

  test("byte-stable golden", () => {
    matchGolden(
      PKG_SRC_META,
      "binding-table",
      buildBindingTable(SHIPPED_COLLECTORS, PACKS),
    );
  });
});
