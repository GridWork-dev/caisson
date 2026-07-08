// GET /api/compliance/attestations — download the tenant's OSCAL manual-attestation record (JSON),
// tenant-scoped. This is the human-filled half of the OSCAL export (ADR-0181): the Compliance edition
// evidence leg folds these `filled` slot ids into the SAR + POA&M bundle it generates. Metadata only,
// no secret.
import { NextResponse } from "next/server";
import { COMPLIANCE_FRAMEWORKS, listAttestations } from "@/lib/attestations";
import { getSession } from "@/lib/auth";
import { accountHoldsComplianceCore } from "@/lib/compliance-gate";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (session === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  // Entitlement gate (G25): mirrors the dashboard page — no compliance-core/bundle/everything
  // grant → 403, never the evidence-pack record. Fail-closed on a read error.
  let entitled: boolean;
  try {
    entitled = await accountHoldsComplianceCore(
      await getDb(),
      session.accountId,
    );
  } catch {
    entitled = false;
  }
  if (!entitled) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const frameworks = await Promise.all(
    COMPLIANCE_FRAMEWORKS.map(async (fw) => {
      const records = await listAttestations(session.accountId, fw.id);
      const filled = new Set(records.map((r) => r.slotId));
      return {
        id: fw.id,
        title: fw.title,
        slots: fw.slots.map((s) => ({
          id: s.id,
          label: s.label,
          required: s.required,
          // The `filledSlotIds` the OSCAL export consumes (ADR-0181 / generate.ts `EvidenceControlPlan`).
          filled: filled.has(s.id),
        })),
        attestations: records,
      };
    }),
  );

  const body = {
    accountId: session.accountId,
    generatedAt: new Date().toISOString(),
    frameworks,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="caisson-attestations.json"',
      // Tenant data — never shared-cached.
      "cache-control": "private, no-store",
    },
  });
}
