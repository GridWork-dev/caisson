import { describe, expect, test } from "bun:test";
import {
  anchorChain,
  buildChain,
  canonicalize,
  ValidationError,
  type AuditChainEntry,
} from "@caisson-sh/kernel/node";
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type EvidenceItem,
} from "./collector.ts";
import { ALG_AES_256_GCM, serializeEnvelope } from "@caisson-sh/field-crypto";
import { chainVerifyCollector } from "./collectors/chain-verify.ts";
import {
  rlsForceCollector,
  type RlsTableFact,
} from "./collectors/rls-force.ts";
import { wormRetentionCollector } from "./collectors/worm-retention.ts";
import { fieldCryptoPolicyCollector } from "./collectors/field-crypto-policy.ts";
import { aiRiskRegisterCollector } from "./collectors/ai-risk-register.ts";
import { defineRiskEntry, type RiskEntry } from "@caisson-sh/risk-register";

/** A valid AES-256-GCM field-crypto envelope (base64) — the shape a PHI field carries at rest. */
function encryptedSample(): string {
  return serializeEnvelope({
    algId: ALG_AES_256_GCM,
    keyVersion: 1,
    nonce: Buffer.alloc(12, 7),
    ciphertext: Buffer.from("phi-ciphertext"),
    tag: Buffer.alloc(16, 9),
  });
}

const RISK_DIGEST = "a".repeat(64);

/** A managed (scored + mitigated) AI risk-register entry. */
function managedRisk(riskId: string, subject: string): RiskEntry {
  return defineRiskEntry({
    riskId,
    subject,
    likelihood: "possible",
    impact: "moderate",
    treatmentPlan: "Mitigation in force for this lane.",
    owner: "ai-safety@example.com",
    evidenceDigest: RISK_DIGEST,
    crosswalk: [],
  });
}

/** A scored but unmitigated AI risk-register entry — no treatment plan on record. */
function unmitigatedRisk(riskId: string, subject: string): RiskEntry {
  return defineRiskEntry({
    riskId,
    subject,
    likelihood: "possible",
    impact: "moderate",
    treatmentPlan: null,
    owner: "ai-safety@example.com",
    evidenceDigest: RISK_DIGEST,
    crosswalk: [],
  });
}

/** A minimal evidence item for exercising the result constructors directly. */
function sampleItem(): EvidenceItem {
  return {
    collectorId: "test.collector",
    controlId: "AUDIT.IMMUTABLE-LOG",
    title: "t",
    summary: "s",
    facts: { ok: true },
    manualSlots: [],
  };
}

/** A fully-isolated tenant table (the passing RLS posture). */
function forcedTable(table: string): RlsTableFact {
  return {
    table,
    rowSecurityEnabled: true,
    rowSecurityForced: true,
    tenantPolicyPresent: true,
  };
}

describe("result constructors (flag-never-guess invariant)", () => {
  test("passResult carries no reason", () => {
    const r = passResult(sampleItem());
    expect(r.status).toBe("pass");
    expect(r.reason).toBeUndefined();
  });

  test("flaggedResult requires a recorded reason", () => {
    const r = flaggedResult(sampleItem(), "a real gap");
    expect(r.status).toBe("flagged");
    expect(r.reason).toBe("a real gap");
    expect(() => flaggedResult(sampleItem(), "   ")).toThrow(ValidationError);
  });

  test("unresolvedResult requires a recorded reason", () => {
    const r = unresolvedResult(sampleItem(), "evidence absent");
    expect(r.status).toBe("unresolved");
    expect(r.reason).toBe("evidence absent");
    expect(() => unresolvedResult(sampleItem(), "")).toThrow(ValidationError);
  });

  test("every collected item's facts are canonicalize-able (determinism readiness)", () => {
    const result = passResult(sampleItem());
    expect(() => canonicalize(result.item.facts)).not.toThrow();
  });
});

describe("chainVerifyCollector", () => {
  const collector = chainVerifyCollector();

  test("passes a chain that verifies against its anchor", () => {
    const entries = buildChain([{ a: 1 }, { b: 2 }, { c: 3 }]);
    const anchor = anchorChain(entries);
    const r = collector.collect({ entries, anchor });
    expect(r.status).toBe("pass");
    expect(r.item.controlId).toBe("AUDIT.IMMUTABLE-LOG");
    expect(r.item.facts.valid).toBe(true);
    expect(r.item.facts.entryCount).toBe(3);
  });

  test("flags an interior-tampered chain", () => {
    const entries = buildChain([{ a: 1 }, { b: 2 }, { c: 3 }]);
    const anchor = anchorChain(entries);
    // Mutate one payload but keep its (now-stale) hash → verifyChain recomputes and catches it.
    const tampered: AuditChainEntry[] = entries.map((e, i) =>
      i === 1 ? { ...e, payload: { b: 999 } } : e,
    );
    const r = collector.collect({ entries: tampered, anchor });
    expect(r.status).toBe("flagged");
    expect(r.item.facts.valid).toBe(false);
    expect(r.reason).toContain("index 1");
  });

  test("flags a tail-truncated chain (length mismatch vs anchor)", () => {
    const entries = buildChain([{ a: 1 }, { b: 2 }, { c: 3 }]);
    const anchor = anchorChain(entries);
    const r = collector.collect({ entries: entries.slice(0, 2), anchor });
    expect(r.status).toBe("flagged");
    expect(r.item.facts.valid).toBe(false);
  });

  test("is unresolved when no trusted anchor is supplied", () => {
    const entries = buildChain([{ a: 1 }]);
    const r = collector.collect({ entries, anchor: null });
    expect(r.status).toBe("unresolved");
    expect(r.reason).toContain("no trusted anchor");
    expect(r.item.facts.anchorPresent).toBe(false);
  });

  test("honors a control-id override", () => {
    const bound = chainVerifyCollector({ controlId: "AUDIT.CONTROLS" });
    const entries = buildChain([{ a: 1 }]);
    const r = bound.collect({ entries, anchor: anchorChain(entries) });
    expect(r.item.controlId).toBe("AUDIT.CONTROLS");
  });
});

describe("rlsForceCollector", () => {
  const collector = rlsForceCollector();

  test("passes when every tenant table enforces FORCE RLS", () => {
    const r = collector.collect({
      tables: [forcedTable("locked_version"), forcedTable("audit_chain_entry")],
    });
    expect(r.status).toBe("pass");
    expect(r.item.controlId).toBe("ACCESS-CONTROL.LOGICAL");
    expect(r.item.facts.forcedCount).toBe(2);
    expect(r.item.facts.deficientTables).toEqual([]);
  });

  test("flags a table that is enabled but not forced", () => {
    const r = collector.collect({
      tables: [
        forcedTable("audit_chain_entry"),
        {
          table: "field_wrapped_dek",
          rowSecurityEnabled: true,
          rowSecurityForced: false,
          tenantPolicyPresent: true,
        },
      ],
    });
    expect(r.status).toBe("flagged");
    expect(r.item.facts.deficientTables).toEqual(["field_wrapped_dek"]);
    expect(r.reason).toContain("field_wrapped_dek");
  });

  test("flags a table missing its tenant policy", () => {
    const r = collector.collect({
      tables: [
        {
          table: "locked_version",
          rowSecurityEnabled: true,
          rowSecurityForced: true,
          tenantPolicyPresent: false,
        },
      ],
    });
    expect(r.status).toBe("flagged");
    expect(r.item.facts.deficientTables).toEqual(["locked_version"]);
  });

  test("is unresolved when no tables were inspected", () => {
    const r = collector.collect({ tables: [] });
    expect(r.status).toBe("unresolved");
    expect(r.reason).toContain("no RLS posture");
  });

  test("declares a manual-attachment slot for a pentest report", () => {
    expect(collector.manualSlots).toHaveLength(1);
    expect(collector.manualSlots[0]?.id).toBe("tenant-isolation-test-report");
    expect(collector.manualSlots[0]?.required).toBe(false);
  });
});

describe("wormRetentionCollector", () => {
  const collector = wormRetentionCollector();
  const key = "11111111-1111-4111-8111-111111111111/audit-chain/anchors/x.json";
  const requiredUntil = new Date("2031-01-01T00:00:00.000Z");

  test("passes when retention meets the floor", () => {
    const r = collector.collect({
      key,
      retainUntil: new Date("2031-06-01T00:00:00.000Z"),
      requiredUntil,
    });
    expect(r.status).toBe("pass");
    expect(r.item.controlId).toBe("DATA-PROTECTION.DISPOSAL");
    expect(r.item.facts.requiredUntil).toBe("2031-01-01T00:00:00.000Z");
  });

  test("passes when retention exactly equals the floor", () => {
    const r = collector.collect({
      key,
      retainUntil: new Date("2031-01-01T00:00:00.000Z"),
      requiredUntil,
    });
    expect(r.status).toBe("pass");
  });

  test("flags retention short of the floor", () => {
    const r = collector.collect({
      key,
      retainUntil: new Date("2028-01-01T00:00:00.000Z"),
      requiredUntil,
    });
    expect(r.status).toBe("flagged");
    expect(r.reason).toContain("earlier than the required floor");
  });

  test("is unresolved when no retain_until is present", () => {
    const r = collector.collect({ key, retainUntil: null, requiredUntil });
    expect(r.status).toBe("unresolved");
    expect(r.item.facts.retainUntil).toBeNull();
    expect(r.reason).toContain("no retain_until");
  });
});

describe("fieldCryptoPolicyCollector (HIPAA PHI encryption-at-rest)", () => {
  const collector = fieldCryptoPolicyCollector();

  test("passes when every PHI field is a valid AES-256-GCM envelope", () => {
    const r = collector.collect({
      fields: [
        { field: "patient.ssn", storedValue: encryptedSample() },
        { field: "patient.dob", storedValue: encryptedSample() },
      ],
    });
    expect(r.status).toBe("pass");
    expect(r.item.controlId).toBe("DATA-PROTECTION.PHI-ENCRYPTION");
    expect(r.item.facts.encryptedCount).toBe(2);
    expect(r.item.facts.plaintextFields).toEqual([]);
  });

  test("flags a PHI field stored in plaintext", () => {
    const r = collector.collect({
      fields: [
        { field: "patient.ssn", storedValue: encryptedSample() },
        { field: "patient.mrn", storedValue: "123-45-6789" },
      ],
    });
    expect(r.status).toBe("flagged");
    expect(r.item.facts.plaintextFields).toEqual(["patient.mrn"]);
    expect(r.reason).toContain("patient.mrn");
  });

  test("is unresolved when a PHI field had no stored value to sample", () => {
    const r = collector.collect({
      fields: [
        { field: "patient.ssn", storedValue: encryptedSample() },
        { field: "patient.dob", storedValue: null },
      ],
    });
    expect(r.status).toBe("unresolved");
    expect(r.item.facts.unsampledFields).toEqual(["patient.dob"]);
    expect(r.reason).toContain("patient.dob");
  });

  test("is unresolved when no PHI fields were inspected", () => {
    const r = collector.collect({ fields: [] });
    expect(r.status).toBe("unresolved");
    expect(r.reason).toContain("no PHI encryption posture");
  });

  test("prefers flagging plaintext over an unsampled sibling", () => {
    const r = collector.collect({
      fields: [
        { field: "patient.mrn", storedValue: "plaintext" },
        { field: "patient.dob", storedValue: null },
      ],
    });
    expect(r.status).toBe("flagged");
    expect(r.item.facts.plaintextFields).toEqual(["patient.mrn"]);
  });
});

describe("aiRiskRegisterCollector (EU AI Act Art. 9)", () => {
  const collector = aiRiskRegisterCollector();

  test("passes when every risk is assessed with a treatment plan on record", () => {
    const r = collector.collect({
      entries: [
        managedRisk("R-1", "openai/gpt-4o lane"),
        managedRisk("R-2", "anthropic/claude lane"),
      ],
    });
    expect(r.status).toBe("pass");
    expect(r.item.controlId).toBe("RISK-MANAGEMENT.AI-LIFECYCLE");
    expect(r.item.facts.managedCount).toBe(2);
    expect(r.item.facts.deficientRisks).toEqual([]);
  });

  test("flags an unmitigated risk (deficient ids sorted)", () => {
    const r = collector.collect({
      entries: [
        managedRisk("R-2", "lane-a"),
        unmitigatedRisk("R-3", "lane-b"),
        unmitigatedRisk("R-1", "lane-c"),
      ],
    });
    expect(r.status).toBe("flagged");
    expect(r.item.facts.deficientRisks).toEqual(["R-1", "R-3"]);
    expect(r.reason).toContain("R-1");
  });

  test("is unresolved when the register is empty", () => {
    const r = collector.collect({ entries: [] });
    expect(r.status).toBe("unresolved");
    expect(r.reason).toContain("no AI risk-register entries");
  });
});
