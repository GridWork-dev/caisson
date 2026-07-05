// AI keys (BYOK, ADR-0183/0182): bring your own provider key. The dashboard reads the write-only
// metadata (masked last-4 + version + timestamps — never the key) and renders the submit/rotate form.
import type { Metadata } from "next";
import { DataTable, EmptyState, StatusChip } from "@caisson/ui/components";
import { ByokForm } from "@/components/byok-form";
import { type ByokKeyStatus, readKeyStatuses } from "@/lib/byok";
import { isOwner, requireDashboardSession } from "@/lib/auth";

export const metadata: Metadata = { title: "AI keys" };

export default async function DashboardAiKeysPage() {
  const session = await requireDashboardSession("/dashboard/ai-keys");
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

      {/* Key writes are owner-only (vuln-0006, ADR-0208 #1) — POST /api/byok enforces the 403;
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
