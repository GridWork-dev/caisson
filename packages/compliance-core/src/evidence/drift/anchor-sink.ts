// src/evidence/drift/anchor-sink.ts — the every-snapshot anchoring port (ADR-0371, SPEC item 5).
//
// Mirrors @caisson-sh/audit-worm's real anchoring seam (`AuditChainStore.append` + `AnchorOutbox`) by
// SHAPE only — compliance-core stays dependency-free of @caisson-sh/audit-worm, the same precedent
// `external-anchor.ts` already set ("only the two grade literals are load-bearing here"; the receipt
// itself is embedded verbatim, already validated by audit-worm on the WORM write). A caller wires
// this port with the real `AuditChainStore.append` (returns `{entry, anchor}`; `anchor` already
// carries `{length, tipHash}`) and `AnchorOutbox.enqueuePending` (`{accountId, target, anchorLength,
// anchorDigest}`) — no new transport, no new anchoring mechanism, exactly the existing seam.
import { createHash } from "node:crypto";
import { canonicalize, type JsonValue } from "@caisson-sh/kernel";

/** The minted anchor's identity — mirrors `@caisson-sh/kernel`'s `AuditChainAnchor` `{length, tipHash}`. */
export interface SnapshotAnchorResult {
  readonly length: number;
  readonly tipHash: string;
}

/**
 * The anchoring port. `appendSnapshotDigest` appends ONE entry to the tenant's WORM audit chain
 * (edge-wired to `AuditChainStore.append`) and returns the resulting anchor; `enqueueOutboxRow`
 * persists intent for external anchoring BEFORE egress (edge-wired to `AnchorOutbox.enqueuePending`)
 * — `runComplianceSnapshotOnce` calls both, exactly once each, for EVERY snapshot run (SPEC item 5).
 */
export interface SnapshotAnchorSink {
  appendSnapshotDigest(
    accountId: string,
    payload: JsonValue,
  ): Promise<SnapshotAnchorResult>;
  enqueueOutboxRow(
    accountId: string,
    anchor: SnapshotAnchorResult,
  ): Promise<void>;
}

/**
 * The canonical SHA-256 digest of a snapshot payload — deterministic (identical manifest content
 * yields an identical hex digest), independent of any injected clock. The generated pack's
 * `generatedAt` never enters the manifest body (ADR-0058's clock-at-the-edge rule), so re-running the
 * snapshot over unchanged evidence always digests to the same value.
 */
export function digestSnapshotPayload(payload: JsonValue): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}
