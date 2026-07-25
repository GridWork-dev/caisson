import type { ChainVerification, AuditChainEntry } from "@caisson/kernel";
import { wormAnchorAccount } from "@caisson/service-license";
import { Button } from "@caisson/ui/components";
import { adminDbConfigured } from "@/lib/admin-db";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";
import { buildAdminAuditWindow } from "@/lib/audit-window";
import { AuditChainClient } from "./audit-chain-client";

// G30 — the per-tenant WORM audit-chain integrity view. `AuditChainStore.verify()` and
// `ChainViewer` both already exist production-quality (@caisson/audit-worm); the mutation surface
// already `.append()`s to a real per-tenant chain on every dual-logged action (ADR-0220), but
// nothing anywhere in apps/admin ever calls `.verify()` against real tenant data. This is that
// wiring: an operator enters a target account id, and the page runs the SAME anchor derivation
// (`wormAnchorAccount`) and the SAME `AuditChainStore` (`getAdminMutationDeps().worm`) every
// mutation route already uses, then hands the result straight to `ChainViewer`.
export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const targetAccountId = params.account?.trim() ?? "";
  const configured = adminDbConfigured();

  let entries: readonly AuditChainEntry[] = [];
  let verification: ChainVerification = { valid: true, brokenAt: null };
  let rowStatuses: Awaited<
    ReturnType<typeof buildAdminAuditWindow>
  >["rowStatuses"] = [];
  let redactedPaths: readonly string[] = [];
  let loaded = false;
  let loadError: string | null = null;

  if (configured && targetAccountId !== "") {
    try {
      const deps = await getAdminMutationDeps();
      const anchor = wormAnchorAccount(targetAccountId);
      const window = await buildAdminAuditWindow({
        source: deps.worm,
        accountId: anchor,
        tenantId: targetAccountId,
        now: new Date(),
      });
      entries = window.entries;
      verification = window.verification;
      rowStatuses = window.rowStatuses;
      redactedPaths = window.redactedPaths;
      loaded = true;
    } catch (err) {
      loadError = err instanceof Error ? err.message : "chain read failed";
    }
  }

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin / business</p>
        <h1 className="page-title">WORM audit-chain verification</h1>
        <p className="lede">
          Verify one account&apos;s tamper-evident audit chain. Every
          dual-logged operator mutation appends to this same chain — this
          confirms it hasn&apos;t been tampered with.
        </p>
      </section>

      {!configured ? (
        <div className="panel">
          <p className="section-title">Not configured</p>
          <p className="muted">
            Set <span className="mono">CAISSON_ADMIN_DB_URL</span> to verify a
            live chain.
          </p>
        </div>
      ) : null}

      <form method="GET" className="row" style={{ gap: "var(--cs-space-2)" }}>
        <input
          type="text"
          name="account"
          defaultValue={targetAccountId}
          placeholder="Target account id"
          className="mono text-input"
          style={{ minWidth: 320 }}
        />
        <Button type="submit" variant="primary" size="sm">
          Verify chain
        </Button>
      </form>

      {loadError !== null ? (
        <div className="panel">
          <p className="section-title">Verification failed</p>
          <p className="muted">{loadError}</p>
        </div>
      ) : null}

      {loaded ? (
        <AuditChainClient
          accountId={targetAccountId}
          entries={entries}
          verification={verification}
          rowStatuses={rowStatuses}
          anchorProvenance={{ length: entries.length }}
          redactedPaths={redactedPaths}
        />
      ) : (
        <p className="muted">
          {targetAccountId === ""
            ? "Enter an account id to verify its WORM audit chain."
            : null}
        </p>
      )}
    </div>
  );
}
