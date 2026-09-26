import { describe, expect, test } from "bun:test";
import {
  anchorChain,
  chainEntry,
  verifyChain,
  type AuditChainEntry,
  type JsonValue,
} from "@caisson-sh/kernel/node";
import type { AppendResult, AuditChainStore } from "@caisson-sh/audit-worm";
import { computeResidual } from "./model.ts";
import { recordResidualOverride } from "./override.ts";

/**
 * A real, verifiable in-memory chain — built from the SAME pure kernel primitives
 * `@caisson-sh/audit-worm`'s `AuditChainStore` composes over a database, minus the DB/WORM I/O. This
 * proves an override genuinely chains and verifies without standing up a live Postgres.
 */
function fakeChain(): Pick<AuditChainStore, "append"> & {
  entries: AuditChainEntry[];
} {
  const entries: AuditChainEntry[] = [];
  return {
    entries,
    async append(
      _accountId: string,
      payload: JsonValue,
    ): Promise<AppendResult> {
      const prev = entries.length === 0 ? null : (entries.at(-1) ?? null);
      const entry = chainEntry(prev, payload);
      entries.push(entry);
      return { entry, anchor: anchorChain(entries) };
    },
  };
}

describe("recordResidualOverride", () => {
  test("chains and verifies, and keeps the computed value recoverable", async () => {
    const chain = fakeChain();
    const computed = computeResidual("possible", "major");
    const now = new Date("2026-07-19T00:00:00.000Z");

    const result = await recordResidualOverride({
      chain,
      accountId: "tenant-acme",
      riskId: "R-1",
      computed,
      overrideLikelihood: "unlikely",
      overrideImpact: "minor",
      who: "compliance-lead@example.com",
      why: "Mitigating control already covers this lane; downgraded per quarterly review.",
      now,
    });

    // The exception record recovers the computed value, not just the override.
    expect(result.record.computed).toBe(computed);
    expect(result.record.override).toBe(computeResidual("unlikely", "minor"));
    expect(result.record.who).toBe("compliance-lead@example.com");
    expect(result.record.at).toBe(now.toISOString());

    // The append genuinely landed on a chain that verifies end to end.
    expect(chain.entries).toHaveLength(1);
    const verification = verifyChain(chain.entries, result.evidence.anchor);
    expect(verification.valid).toBe(true);
    expect(verification.brokenAt).toBeNull();

    // The computed value is recoverable straight off the chained payload itself, not only from
    // the function's return value.
    const stored = chain.entries[0]?.payload as {
      computed?: unknown;
      kind?: unknown;
    };
    expect(stored.computed).toBe(computed);
    expect(stored.kind).toBe("risk.residual-overridden");
  });

  test("a tampered chain fails verification (the override is genuinely tamper-evident)", async () => {
    const chain = fakeChain();
    const result = await recordResidualOverride({
      chain,
      accountId: "tenant-acme",
      riskId: "R-1",
      computed: computeResidual("possible", "major"),
      overrideLikelihood: "unlikely",
      overrideImpact: "minor",
      who: "compliance-lead@example.com",
      why: "reason on record",
      now: new Date("2026-07-19T00:00:00.000Z"),
    });
    const original = chain.entries[0];
    if (original === undefined) throw new Error("expected one chained entry");
    const tampered: AuditChainEntry = {
      ...original,
      payload: { ...(original.payload as object), who: "someone-else" },
    };
    const verification = verifyChain([tampered], result.evidence.anchor);
    expect(verification.valid).toBe(false);
  });

  test("rejects an empty who", async () => {
    const chain = fakeChain();
    await expect(
      recordResidualOverride({
        chain,
        accountId: "tenant-acme",
        riskId: "R-1",
        computed: computeResidual("possible", "major"),
        overrideLikelihood: "unlikely",
        overrideImpact: "minor",
        who: "  ",
        why: "reason",
        now: new Date(),
      }),
    ).rejects.toThrow();
  });

  test("rejects an empty why", async () => {
    const chain = fakeChain();
    await expect(
      recordResidualOverride({
        chain,
        accountId: "tenant-acme",
        riskId: "R-1",
        computed: computeResidual("possible", "major"),
        overrideLikelihood: "unlikely",
        overrideImpact: "minor",
        who: "compliance-lead@example.com",
        why: "   ",
        now: new Date(),
      }),
    ).rejects.toThrow();
  });

  test("rejects an over-long why before it ever reaches the chain", async () => {
    const chain = fakeChain();
    await expect(
      recordResidualOverride({
        chain,
        accountId: "tenant-acme",
        riskId: "R-1",
        computed: computeResidual("possible", "major"),
        overrideLikelihood: "unlikely",
        overrideImpact: "minor",
        who: "compliance-lead@example.com",
        why: "x".repeat(2001),
        now: new Date(),
      }),
    ).rejects.toThrow();
    // The bound is checked BEFORE the append — an over-long why must never land on the
    // append-only chain, where it could never be remediated.
    expect(chain.entries).toHaveLength(0);
  });

  test("evidence-gap: a chain append failure fails the whole call loudly", async () => {
    const failing: Pick<AuditChainStore, "append"> = {
      append: () => {
        throw new Error("worm store unreachable");
      },
    };
    await expect(
      recordResidualOverride({
        chain: failing,
        accountId: "tenant-acme",
        riskId: "R-1",
        computed: computeResidual("possible", "major"),
        overrideLikelihood: "unlikely",
        overrideImpact: "minor",
        who: "compliance-lead@example.com",
        why: "reason",
        now: new Date(),
      }),
    ).rejects.toThrow(/evidence gap/);
  });
});
