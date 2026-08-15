// Compliance manual-attestation store (ADR-0181). The automated collectors (chain-verify, rls-force,
// worm-retention, field-crypto-policy, ai-risk-register) each declare `manualSlots[]` — evidence a
// human must attest out-of-band (a policy PDF, an Object-Lock config, a pentest report). This module
// is the tenant-scoped fill path: which slots each framework has, and read/write of the buyer's
// attestations under `withTenant` RLS.
//
// ponytail: the slot catalog is mirrored from the @caisson/compliance collectors' static `manualSlots`
// declarations rather than importing the whole compliance edition into the site app (which would drag
// its audit-worm/field-crypto substrate closure). Ceiling: if a collector adds/renames a slot, update
// this list — a small, stable set. The slot IDs must match the collectors' so a filled attestation
// maps to `filledSlotIds` when the compliance leg assembles the OSCAL pack.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, withTenant } from "./db.ts";

export interface AttestationSlot {
  readonly id: string;
  readonly label: string;
  /** Whether the pack is incomplete without this attachment (collectors currently declare all optional). */
  readonly required: boolean;
}

export interface ComplianceFramework {
  /** Kebab-case framework slug — matches @caisson/compliance framework ids. */
  readonly id: string;
  readonly title: string;
  readonly slots: readonly AttestationSlot[];
}

const SLOT_TENANT_ISOLATION: AttestationSlot = {
  id: "tenant-isolation-test-report",
  label: "Tenant-isolation / penetration test report",
  required: false,
};
const SLOT_OBJECT_LOCK: AttestationSlot = {
  id: "object-lock-configuration",
  label: "S3 Object-Lock / WORM configuration evidence",
  required: false,
};
const SLOT_KEY_MANAGEMENT: AttestationSlot = {
  id: "encryption-key-management-policy",
  label: "Encryption key-management / HSM custody policy",
  required: false,
};
const SLOT_AI_RISK: AttestationSlot = {
  id: "ai-risk-management-policy",
  label: "AI risk-management system policy (EU AI Act Art. 9)",
  required: false,
};

/** The three locked frameworks (ADR-0181) and the manual slots each export collector invites. */
export const COMPLIANCE_FRAMEWORKS: readonly ComplianceFramework[] = [
  {
    id: "soc2-tsc",
    title: "SOC 2 (Trust Services Criteria)",
    slots: [SLOT_OBJECT_LOCK, SLOT_TENANT_ISOLATION],
  },
  {
    id: "hipaa-security",
    title: "HIPAA Security Rule",
    slots: [SLOT_OBJECT_LOCK, SLOT_TENANT_ISOLATION, SLOT_KEY_MANAGEMENT],
  },
  {
    id: "eu-ai-act",
    title: "EU AI Act",
    slots: [SLOT_OBJECT_LOCK, SLOT_TENANT_ISOLATION, SLOT_AI_RISK],
  },
];

const FRAMEWORK_IDS = COMPLIANCE_FRAMEWORKS.map((f) => f.id) as [
  string,
  ...string[],
];
const SLOT_IDS = [
  ...new Set(COMPLIANCE_FRAMEWORKS.flatMap((f) => f.slots.map((s) => s.id))),
] as [string, ...string[]];

/** `.strict()` boundary for an attest/clear action (server-action FormData → validated). */
export const AttestationInput = z
  .object({
    framework: z.enum(FRAMEWORK_IDS),
    slotId: z.enum(SLOT_IDS),
    note: z.string().trim().max(2000).default(""),
  })
  .strict();
export type AttestationInput = z.infer<typeof AttestationInput>;

export interface AttestationRecord {
  readonly slotId: string;
  readonly note: string;
  readonly attestedBy: string;
  readonly attestedAt: string;
}

/** Read the tenant's attestations for a framework (RLS-scoped). Empty = nothing attested yet. */
export async function listAttestations(
  accountId: string,
  framework: string,
): Promise<AttestationRecord[]> {
  const db = await getDb();
  return withTenant(db, accountId, async (tx) => {
    const res = await tx.query<{
      slot_id: string;
      note: string;
      attested_by: string;
      attested_at: string | Date;
    }>(
      `SELECT slot_id, note, attested_by, attested_at
       FROM compliance_attestation WHERE framework = $1 ORDER BY slot_id ASC`,
      [framework],
    );
    return res.rows.map((r) => ({
      slotId: r.slot_id,
      note: r.note,
      attestedBy: r.attested_by,
      attestedAt: new Date(r.attested_at).toISOString(),
    }));
  });
}

/** Attest (fill) a slot — UPSERT, tenant-scoped. `attestedBy` is the verified session user, not input. */
export async function attestSlot(
  accountId: string,
  attestedBy: string,
  input: AttestationInput,
): Promise<void> {
  const db = await getDb();
  await withTenant(db, accountId, async (tx) => {
    await tx.query(
      `INSERT INTO compliance_attestation (id, account_id, framework, slot_id, note, attested_by, attested_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (account_id, framework, slot_id)
       DO UPDATE SET note = EXCLUDED.note, attested_by = EXCLUDED.attested_by, attested_at = now()`,
      [
        randomUUID(),
        accountId,
        input.framework,
        input.slotId,
        input.note,
        attestedBy,
      ],
    );
  });
}

/** Clear (unfill) a slot — DELETE, tenant-scoped. */
export async function clearSlot(
  accountId: string,
  framework: string,
  slotId: string,
): Promise<void> {
  const db = await getDb();
  await withTenant(db, accountId, async (tx) => {
    await tx.query(
      `DELETE FROM compliance_attestation WHERE framework = $1 AND slot_id = $2`,
      [framework, slotId],
    );
  });
}
