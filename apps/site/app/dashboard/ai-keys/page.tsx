// AI keys (BYOK, ADR-0183/0182): bring your own provider key. The dashboard reads the write-only
// metadata (masked last-4 + version + timestamps — never the key) and renders the submit/rotate form.
import type { Metadata } from "next";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Icon,
  StatusChip,
} from "@caisson/ui/components";
import { ByokForm } from "@/components/byok-form";
import { accountHoldsAiProduction } from "@/lib/ai-production-gate";
import { type ByokKeyStatus, readKeyStatuses } from "@/lib/byok";
import { isOwner, requireDashboardSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "AI keys" };

/**
 * Fail-closed ai-production entitlement gate (CAISSON-64 P1): BYOK feeds the metered AI-feature
 * surface the ai-production bundle sells, previously reachable by ANY signed-in account with zero
 * purchases (no entitlement check anywhere). Deny on ANY read error — never a silent allow
 * (mirrors `compliance/page.tsx`'s `isComplianceEntitled`).
 */
async function isAiProductionEntitled(accountId: string): Promise<boolean> {
  try {
    return await accountHoldsAiProduction(await getDb(), accountId);
  } catch {
    return false;
  }
}

export default async function DashboardAiKeysPage() {
  const session = await requireDashboardSession("/dashboard/ai-keys");

  // Fail-closed entitlement gate: no ai-production/everything grant → the upsell, never the BYOK
  // surface (mirrors /dashboard/compliance's gate shape).
  if (!(await isAiProductionEntitled(session.accountId))) {
    return (
      <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
        <div>
          <h1
            className="cs-card-title"
            style={{ fontSize: "var(--cs-text-2xl)" }}
          >
            AI keys
          </h1>
          <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
            Bring-your-own-provider-key is part of AI-Production.
          </p>
        </div>
        <Card style={{ display: "grid", gap: "var(--cs-space-4)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--cs-space-3)",
            }}
          >
            <Icon name="lock" size="md" />
            <h2
              className="cs-card-title"
              style={{ fontSize: "var(--cs-text-lg)", margin: 0 }}
            >
              AI-Production required
            </h2>
          </div>
          <p className="cs-muted" style={{ margin: 0 }}>
            Bring your own provider key for metered AI features with the
            AI-Production bundle. Your account isn&apos;t entitled yet.
          </p>
          <div>
            <a href="/dashboard/plan">
              <Button variant="primary">View plans</Button>
            </a>
          </div>
        </Card>
      </div>
    );
  }

  const keys = await readKeyStatuses(session.accountId);

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          AI keys
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Bring your own provider key. Caisson stores it encrypted and never
          reads it back — usage is billed directly by your provider.
        </p>
      </div>

      <DataTable<ByokKeyStatus>
        columns={[
          {
            key: "provider",
            header: "Provider",
            render: (k) => (
              <span style={{ fontFamily: "var(--cs-font-mono)" }}>
                {k.provider}
              </span>
            ),
          },
          {
            key: "maskedLast4",
            header: "Key",
            render: (k) => (
              <span style={{ fontFamily: "var(--cs-font-mono)" }}>
                {k.maskedLast4}
              </span>
            ),
          },
          {
            key: "keyVersion",
            header: "Status",
            render: () => <StatusChip label="connected" tone="accent" dot />,
          },
          {
            key: "updatedAt",
            header: "Updated",
            render: (k) => (
              <span className="cs-muted">
                {new Date(k.updatedAt).toLocaleDateString()}
              </span>
            ),
          },
        ]}
        rows={keys}
        rowKey={(k) => k.provider}
        empty={
          <EmptyState
            icon="lock"
            title="No provider keys stored yet"
            description="Add your first key below to bring your own provider billing."
          />
        }
      />

      {/* Key writes are owner-only (ADR-0208 #1) — POST /api/byok enforces the 403;
          this just mirrors the members-page seat view. The masked table above stays seat-visible. */}
      {isOwner(session) ? (
        <div>
          <h2
            className="cs-card-title"
            style={{
              fontSize: "var(--cs-text-lg)",
              marginBottom: "var(--cs-space-4)",
            }}
          >
            Add or rotate a key
          </h2>
          <ByokForm />
        </div>
      ) : (
        <EmptyState
          icon="lock"
          title="Owner-only"
          description="Only the account owner can add or rotate provider keys."
        />
      )}
    </div>
  );
}
