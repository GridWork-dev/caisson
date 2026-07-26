import type {
  AnchorSigner,
  RowProof,
  RowProofUnverifiable,
} from "@caisson/audit-worm";
import {
  ValidationError,
  type AuditChainEntry,
  type ChainVerification,
  type JsonValue,
} from "@caisson/kernel";
import {
  classifyRowState,
  type RowReceipt,
  type RowState,
} from "@caisson/kernel/audit-verify";
import {
  buildEvidencePack,
  evidencePackSealPayloadBytes,
  type EvidencePack,
  type EvidencePackAnchorAuth,
  type EvidencePackMeta,
} from "@caisson/kernel/evidence";
import { DEFAULT_REDACT_KEYS, redactValue } from "@caisson/kernel/redact";
import { assembleProofSuccess } from "./audit-proof.ts";

export const MAX_ADMIN_AUDIT_WINDOW_ENTRIES = 250;
export const ADMIN_AUDIT_PROOF_CONCURRENCY = 8;

export interface AuditProofSource {
  load(accountId: string): Promise<readonly AuditChainEntry[]>;
  verify(accountId: string): Promise<ChainVerification>;
  getRowProof(
    accountId: string,
    seq: number,
  ): Promise<RowProof | RowProofUnverifiable>;
}

export interface AdminAuditWindow {
  /** Raw rows stay server-side for verification and are never passed into a client component. */
  readonly entries: readonly AuditChainEntry[];
  /** Server-redacted rows safe to serialize into the operator page's React payload. */
  readonly displayEntries: readonly AuditChainEntry[];
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
  readonly anchorAuth?: EvidencePackAnchorAuth;
  readonly packSigner?: AnchorSigner;
}): Promise<AdminAuditWindow> {
  const { source, accountId, tenantId, now, anchorAuth, packSigner } = input;
  const [entries, verification] = await Promise.all([
    source.load(accountId),
    source.verify(accountId),
  ]);
  if (entries.length > MAX_ADMIN_AUDIT_WINDOW_ENTRIES) {
    throw new ValidationError(
      `audit window exceeds the maximum of ${String(MAX_ADMIN_AUDIT_WINDOW_ENTRIES)} entries`,
      { chainLength: entries.length },
    );
  }
  const proofs: Array<RowProof | RowProofUnverifiable> = new Array(
    entries.length,
  );
  let nextIndex = 0;
  await Promise.all(
    Array.from(
      {
        length: Math.min(ADMIN_AUDIT_PROOF_CONCURRENCY, entries.length),
      },
      async () => {
        for (;;) {
          const index = nextIndex;
          nextIndex += 1;
          const entry = entries[index];
          if (entry === undefined) return;
          proofs[index] = await source.getRowProof(accountId, entry.seq);
        }
      },
    ),
  );
  const displayEntries = entries.map((entry) => ({
    ...entry,
    payload: redactValue(entry.payload, DEFAULT_REDACT_KEYS) as JsonValue,
  }));

  const rowStatuses: RowState[] = [];
  const receipts: RowReceipt[] = [];
  const redactedPaths = new Set<string>();

  for (const [index, proof] of proofs.entries()) {
    if ("unverifiable" in proof) {
      rowStatuses.push("unverifiable");
      continue;
    }
    const assembled = await assembleProofSuccess(
      proof,
      now,
      anchorAuth === undefined
        ? undefined
        : { pinnedKey: anchorAuth, expectedAccountId: accountId },
    );
    receipts.push(assembled.receipt);
    for (const path of assembled.redactedPaths ?? []) {
      redactedPaths.add(path);
    }
    rowStatuses.push(
      classifyRowState(assembled.receipt.checks, {
        redacted: assembled.redacted,
        isGenesis: entries[index]?.seq === 0,
        requireSignature: anchorAuth !== undefined,
      }),
    );
  }

  const canBuildEvidencePack =
    entries.length > 0 &&
    verification.valid === true &&
    verification.brokenAt === null &&
    receipts.length === entries.length &&
    (anchorAuth === undefined ||
      (packSigner !== undefined &&
        packSigner.keyId === anchorAuth.keyId &&
        // nosemgrep: tools.security.semgrep-rules.no-insecure-token-compare -- `checks.signature` is a per-receipt verdict enum ("pass"/"fail"/"na"), not signature bytes; the real Ed25519 verification already ran in assembleProofSuccess. No timing side channel on a public verdict.
        receipts.every((receipt) => receipt.checks.signature === "pass")));

  let evidencePack: EvidencePack | null = null;
  if (canBuildEvidencePack) {
    const baseMeta: Omit<EvidencePackMeta, "packSeal"> = {
      tenantId,
      chainLength: entries.length,
      now,
      chainVerification: verification,
      ...(anchorAuth === undefined ? {} : { anchorAuth }),
    };
    if (anchorAuth === undefined) {
      evidencePack = buildEvidencePack({ receipts, meta: baseMeta });
    } else if (packSigner !== undefined) {
      const signature = await packSigner.sign(
        evidencePackSealPayloadBytes({
          receipts,
          meta: baseMeta,
          accountId,
        }),
      );
      evidencePack = buildEvidencePack({
        receipts,
        meta: {
          ...baseMeta,
          packSeal: {
            v: 1,
            keyId: packSigner.keyId,
            accountId,
            sig: Buffer.from(signature).toString("base64"),
          },
        },
      });
    }
  }

  return {
    entries,
    displayEntries,
    verification,
    rowStatuses,
    receipts,
    redactedPaths: [...redactedPaths].sort(),
    evidencePack,
  };
}
