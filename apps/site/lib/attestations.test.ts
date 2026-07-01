// Compliance attestation persistence round-trip (ADR-0181). Tenant-scoped fill -> read -> clear over
// the in-memory PGlite double. Also pins the slot catalog to the three locked frameworks.
import { beforeAll, expect, test } from "bun:test";
import {
  AttestationInput,
  COMPLIANCE_FRAMEWORKS,
  attestSlot,
  clearSlot,
  listAttestations,
} from "./attestations.ts";

// Force the hermetic in-memory PGlite double (same pattern as auth-account.test.ts).
beforeAll(() => {
  delete process.env.DATABASE_URL;
  const g = globalThis as unknown as {
    caissonTransactor?: unknown;
    caissonPglite?: unknown;
  };
  g.caissonTransactor = undefined;
  g.caissonPglite = undefined;
});

test("catalog covers the three locked frameworks with their manual slots", () => {
  expect(COMPLIANCE_FRAMEWORKS.map((f) => f.id).sort()).toEqual([
    "eu-ai-act",
    "hipaa-security",
    "soc2-tsc",
  ]);
  // HIPAA gets the field-crypto PHI slot; EU AI Act gets the risk-register slot.
  const hipaa = COMPLIANCE_FRAMEWORKS.find((f) => f.id === "hipaa-security");
  expect(
    hipaa?.slots.some((s) => s.id === "encryption-key-management-policy"),
  ).toBe(true);
});

test("AttestationInput is strict and enum-bounded", () => {
  expect(
    AttestationInput.safeParse({
      framework: "soc2-tsc",
      slotId: "object-lock-configuration",
      note: "ticket ABC-1",
    }).success,
  ).toBe(true);
  expect(
    AttestationInput.safeParse({
      framework: "bogus",
      slotId: "object-lock-configuration",
    }).success,
  ).toBe(false);
});

test("attest -> list -> clear round-trip, tenant-scoped", async () => {
  const account = "acct-attest-1";
  await attestSlot(account, "user-1", {
    framework: "soc2-tsc",
    slotId: "object-lock-configuration",
    note: "S3 Object-Lock enabled, see runbook",
  });

  let records = await listAttestations(account, "soc2-tsc");
  expect(records).toHaveLength(1);
  expect(records[0]?.slotId).toBe("object-lock-configuration");
  expect(records[0]?.attestedBy).toBe("user-1");

  // A different account sees nothing (RLS isolation).
  expect(await listAttestations("acct-other", "soc2-tsc")).toHaveLength(0);

  await clearSlot(account, "soc2-tsc", "object-lock-configuration");
  records = await listAttestations(account, "soc2-tsc");
  expect(records).toHaveLength(0);
});
