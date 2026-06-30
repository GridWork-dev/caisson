// License (ADR-0114 scope item 6c). Reads `license_grant` (raw SQL — the flagged services/license
// coupling, lib/dashboard-reads.ts) and renders a copy-token affordance + a verify hint per issued
// major. `EmptyState` when the buyer holds no issued license yet (issuance itself is a separate,
// bearer-gated `POST /issue` server-to-server call this dashboard does not make).
import type { Metadata } from "next";
import { EmptyState } from "@caisson/ui/components";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import { readLicenseGrantRows } from "@/lib/dashboard-reads";
import { LicenseTokenCard } from "@/components/license-token-card";

export const metadata: Metadata = { title: "License" };

export default async function DashboardLicensePage() {
  const session = await requireDashboardSession("/dashboard/license");
  const grants = await readScoped(session.accountId, (tx) =>
    readLicenseGrantRows(tx, session.accountId),
  );

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          License
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Your offline-verifiable Ed25519 license tokens, one per major version.
        </p>
      </div>

      {grants.length === 0 ? (
        <EmptyState
          icon="key"
          title="No license issued yet"
          description="A license is issued automatically the first time you complete a purchase. Check back here once your purchase has gone through, or contact support if it's been a while."
        />
      ) : (
        <div style={{ display: "grid", gap: "var(--cs-space-4)" }}>
          {grants.map((grant) => (
            <LicenseTokenCard key={grant.major} grant={grant} />
          ))}
        </div>
      )}
    </div>
  );
}
