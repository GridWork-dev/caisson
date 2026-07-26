import type { ChainVerification, AuditChainEntry } from "@caisson/kernel";
import { withAdminWrite } from "@caisson/org-controls";
import {
  insertAdminActionLog,
  wormAnchorAccount,
} from "@caisson/service-license";
import { Button } from "@caisson/ui/components";
import { headers } from "next/headers";
import { adminDbConfigured } from "@/lib/admin-db";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";
import { checkAdminAuditWindowRateLimit } from "@/lib/admin-audit-window-rate-limit";
import { AuditProofAccount } from "@/lib/audit-proof";
import { buildAdminAuditWindow } from "@/lib/audit-window";
import { adminAuditAnchorTrustFromEnv } from "@/lib/audit-anchor-trust";
import { AuditChainClient } from "./audit-chain-client";

// G30 — the per-tenant WORM audit-chain integrity view. `AuditChainStore.verify()` and
// `ChainViewer` both already exist production-quality (@caisson/audit-worm); the mutation surface
// already `.append()`s to a real per-tenant chain on every dual-logged action (ADR-0220), but
// nothing anywhere in apps/admin ever calls `.verify()` against real tenant data. This is that
// wiring: an operator enters a target account id, and the page runs the SAME anchor derivation
// (`wormAnchorAccount`) and the SAME `AuditChainStore` (`getAdminMutationDeps().worm`) every
// mutation route already uses, then hands the result straight to `ChainViewer`.
export const dynamic = "force-dynamic";

export function parseAuditPageAccount(input: unknown): string | null {
  const parsed = AuditProofAccount.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const parsedTargetAccountId = parseAuditPageAccount(params.account);
  const targetAccountId = parsedTargetAccountId ?? "";
  const configured = adminDbConfigured();

  let entries: readonly AuditChainEntry[] = [];
  let verification: ChainVerification = { valid: true, brokenAt: null };
  let rowStatuses: Awaited<
    ReturnType<typeof buildAdminAuditWindow>
  >["rowStatuses"] = [];
  let redactedPaths: readonly string[] = [];
  let pinnedAnchorKey:
    | NonNullable<ReturnType<typeof adminAuditAnchorTrustFromEnv>>["pinnedKey"]
    | undefined;
  let anchorAccountId: string | undefined;
  let loaded = false;
  let loadError: string | null =
    params.account !== undefined && parsedTargetAccountId === null
      ? "chain read failed"
      : null;

  if (configured && targetAccountId !== "") {
    try {
      const actor = (await headers()).get("x-admin-actor");
      if (actor === null) {
        throw new Error("verified admin actor unavailable");
      }
      const rate = checkAdminAuditWindowRateLimit(actor, targetAccountId);
      if (!rate.allowed) {
        throw new Error("audit-chain verification is temporarily rate limited");
      }
      const deps = await getAdminMutationDeps();
      const anchor = wormAnchorAccount(targetAccountId);
      const anchorTrust = adminAuditAnchorTrustFromEnv();
      const window = await buildAdminAuditWindow({
        source: deps.worm,
        accountId: anchor,
        tenantId: targetAccountId,
        now: new Date(),
        ...(anchorTrust === null
          ? {}
          : {
              anchorAuth: anchorTrust.pinnedKey,
              packSigner: anchorTrust.signer,
            }),
      });
      entries = window.displayEntries;
      verification = window.verification;
      rowStatuses = window.rowStatuses;
      redactedPaths = window.redactedPaths;
      pinnedAnchorKey = anchorTrust?.pinnedKey;
      anchorAccountId = anchor;
      loaded = true;
      try {
        await withAdminWrite(deps.db, (tx) =>
          insertAdminActionLog(tx, {
            actorEmail: actor,
            targetAccountId,
            action: "audit_proof_read",
            before: null,
            after: {
              source: "page",
              range: "full",
              chainLength: window.entries.length,
            },
          }),
        );
      } catch {
        /* Access logging is best-effort for a read-only verdict. */
      }
    } catch (error) {
      loadError =
        error instanceof Error && /rate limited/u.test(error.message)
          ? error.message
          : "chain read failed";
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
          {...(pinnedAnchorKey === undefined ? {} : { pinnedAnchorKey })}
          {...(anchorAccountId === undefined ? {} : { anchorAccountId })}
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
