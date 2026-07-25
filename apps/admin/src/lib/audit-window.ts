import type { RowProof, RowProofUnverifiable } from "@caisson/audit-worm";
import type { AuditChainEntry, ChainVerification } from "@caisson/kernel";
import {
  classifyRowState,
  type RowReceipt,
  type RowState,
} from "@caisson/kernel/audit-verify";
import { buildEvidencePack, type EvidencePack } from "@caisson/kernel/evidence";
import { assembleProofSuccess } from "./audit-proof.ts";

export interface AuditProofSource {
  load(accountId: string): Promise<readonly AuditChainEntry[]>;
  verify(accountId: string): Promise<ChainVerification>;
  getRowProof(
    accountId: string,
    seq: number,
  ): Promise<RowProof | RowProofUnverifiable>;
}

export interface AdminAuditWindow {
  readonly entries: readonly AuditChainEntry[];
  readonly verification: ChainVerification;
  readonly rowStatuses: readonly RowState[];
  readonly receipts: readonly RowReceipt[];
  readonly redactedPaths: readonly string[];
  readonly evidencePack: EvidencePack | null;
}

export async function buildAdminAuditWindow(input: {
  readonly source: AuditProofSource;
  readonly accountId: string;
  readonly tenantId: string;
  readonly now: Date;
}): Promise<AdminAuditWindow> {
  const { source, accountId, tenantId, now } = input;
  const [entries, verification] = await Promise.all([
    source.load(accountId),
    source.verify(accountId),
  ]);
  const proofs = await Promise.all(
    entries.map((entry) => source.getRowProof(accountId, entry.seq)),
  );

  const rowStatuses: RowState[] = [];
  const receipts: RowReceipt[] = [];
  const redactedPaths = new Set<string>();

  for (const [index, proof] of proofs.entries()) {
    if ("unverifiable" in proof) {
      rowStatuses.push("unverifiable");
      continue;
    }
    const assembled = await assembleProofSuccess(proof, now);
    receipts.push(assembled.receipt);
    for (const path of assembled.redactedPaths ?? []) {
      redactedPaths.add(path);
    }
    rowStatuses.push(
      classifyRowState(assembled.receipt.checks, {
        redacted: assembled.redacted,
        isGenesis: entries[index]?.seq === 0,
      }),
    );
  }

  const evidencePack =
    entries.length > 0 && receipts.length === entries.length
      ? buildEvidencePack({
          receipts,
          meta: {
            tenantId,
            chainLength: entries.length,
            now,
            chainVerification: verification,
          },
        })
      : null;

  return {
    entries,
    verification,
    rowStatuses,
    receipts,
    redactedPaths: [...redactedPaths].sort(),
    evidencePack,
  };
}
