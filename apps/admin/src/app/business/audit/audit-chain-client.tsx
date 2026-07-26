"use client";

import { useCallback, useMemo } from "react";
import type { AuditChainEntry, ChainVerification } from "@caisson/kernel";
import type { PinnedAnchorKey, RowState } from "@caisson/kernel/audit-verify";
import { fetchWithTimeout } from "@caisson/kernel/fetch";
import { ChainViewer, type ProofBundleResponse } from "@caisson/audit-worm/ui";
import { parseProofResponse } from "@/lib/audit-proof";

export interface AuditChainClientProps {
  readonly accountId: string;
  readonly entries: readonly AuditChainEntry[];
  readonly verification: ChainVerification;
  readonly rowStatuses: readonly RowState[];
  readonly anchorProvenance: {
    readonly length: number;
    readonly retainUntil?: string;
  };
  readonly redactedPaths: readonly string[];
  readonly pinnedAnchorKey?: PinnedAnchorKey;
  readonly anchorAccountId?: string;
}

export function AuditChainClient({
  accountId,
  entries,
  verification,
  rowStatuses,
  anchorProvenance,
  redactedPaths,
  pinnedAnchorKey,
  anchorAccountId,
}: AuditChainClientProps) {
  const distinctRedactedPaths = useMemo(
    () => [...new Set(redactedPaths)].sort(),
    [redactedPaths],
  );
  const fetchProof = useCallback(
    async (seq: number): Promise<ProofBundleResponse> => {
      const query = new URLSearchParams({
        account: accountId,
        seq: String(seq),
      });
      const response = await fetchWithTimeout(
        `/api/admin/audit/proof?${query.toString()}`,
      );
      if (!response.ok) {
        throw new Error(
          `audit proof request failed (${String(response.status)})`,
        );
      }
      return parseProofResponse(await response.json());
    },
    [accountId],
  );
  const redactionCount = distinctRedactedPaths.length;

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--cs-space-4)",
          flexWrap: "wrap",
        }}
      >
        <span className="muted" aria-live="polite">
          {redactionCount} distinct redacted key{" "}
          {redactionCount === 1 ? "path" : "paths"}
        </span>
        <a
          href={`/api/admin/audit/export?account=${encodeURIComponent(accountId)}`}
          download
        >
          Export logical evidence pack
        </a>
      </div>
      <ChainViewer
        entries={entries}
        verification={verification}
        rowStatuses={rowStatuses}
        rowStatusProvenance="server-asserted"
        anchorProvenance={anchorProvenance}
        fetchProof={fetchProof}
        {...(pinnedAnchorKey === undefined ? {} : { pinnedAnchorKey })}
        {...(anchorAccountId === undefined
          ? {}
          : { expectedAnchorAccountId: anchorAccountId })}
      />
    </div>
  );
}
