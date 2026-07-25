import { describe, expect, test } from "bun:test";
import type { RowProof, RowProofUnverifiable } from "@caisson/audit-worm";
import {
  anchorChain,
  buildChain,
  type AuditChainEntry,
  type ChainVerification,
} from "@caisson/kernel";
import { buildEvidencePack } from "@caisson/kernel/evidence";
import { assembleProofSuccess, type ProofSuccess } from "./audit-proof.ts";
import {
  buildAdminAuditWindow,
  type AuditProofSource,
} from "./audit-window.ts";

const NOW = new Date("2026-07-25T18:00:00.000Z");

function sourceFor(
  entries: readonly AuditChainEntry[],
  overrides: ReadonlyMap<number, RowProofUnverifiable> = new Map(),
): AuditProofSource {
  const verification: ChainVerification = { valid: true, brokenAt: null };
  return {
    async load() {
      return entries;
    },
    async verify() {
      return verification;
    },
    async getRowProof(_accountId, seq) {
      const override = overrides.get(seq);
      if (override !== undefined) return override;
      const entry = entries[seq];
      if (entry === undefined) throw new Error("fixture seq is out of range");
      const proof: RowProof = {
        entry,
        anchorForRow: anchorChain(entries.slice(0, seq + 1)),
        chainLength: entries.length,
      };
      return proof;
    },
  };
}

async function expectedReceipts(
  entries: readonly AuditChainEntry[],
): Promise<ProofSuccess[]> {
  return Promise.all(
    entries.map((entry, seq) =>
      assembleProofSuccess(
        {
          entry,
          anchorForRow: anchorChain(entries.slice(0, seq + 1)),
          chainLength: entries.length,
        },
        NOW,
      ),
    ),
  );
}

describe("buildAdminAuditWindow", () => {
  test("computes row states server-side and keeps one distinct repeated redaction path", async () => {
    const entries = buildChain([
      { event: "first", credentials: { token: "secret-a" } },
      { event: "second", credentials: { token: "secret-b" } },
    ]);

    const window = await buildAdminAuditWindow({
      source: sourceFor(entries),
      accountId: "11111111-1111-4111-8111-111111111111",
      tenantId: "buyer_account_01",
      now: NOW,
    });

    expect(window.rowStatuses).toEqual([
      "anchor-confirmed-original-not-disclosed",
      "anchor-confirmed-original-not-disclosed",
    ]);
    expect(window.redactedPaths).toEqual(["credentials.token"]);
    expect(window.receipts).toHaveLength(2);
  });

  test("marks an unreadable per-row anchor unverifiable and refuses a partial export", async () => {
    const entries = buildChain([{ event: "first" }, { event: "second" }]);
    const unavailable = new Map<number, RowProofUnverifiable>([
      [
        1,
        {
          unverifiable: true,
          reason: "per-length anchor is missing for this row",
        },
      ],
    ]);

    const window = await buildAdminAuditWindow({
      source: sourceFor(entries, unavailable),
      accountId: "11111111-1111-4111-8111-111111111111",
      tenantId: "buyer_account_01",
      now: NOW,
    });

    expect(window.rowStatuses).toEqual(["genesis", "unverifiable"]);
    expect(window.evidencePack).toBeNull();
  });

  test("returns buildEvidencePack's logical file map and sha256 byte-for-byte", async () => {
    const entries = buildChain([{ event: "first" }, { event: "second" }]);
    const source = sourceFor(entries);
    const window = await buildAdminAuditWindow({
      source,
      accountId: "11111111-1111-4111-8111-111111111111",
      tenantId: "buyer_account_01",
      now: NOW,
    });
    const expected = buildEvidencePack({
      receipts: (await expectedReceipts(entries)).map(
        (result) => result.receipt,
      ),
      meta: {
        tenantId: "buyer_account_01",
        chainLength: entries.length,
        now: NOW,
        chainVerification: { valid: true, brokenAt: null },
      },
    });

    expect(window.evidencePack).toEqual(expected);
    expect(window.evidencePack?.sha256).toBe(expected.sha256);
    expect(window.evidencePack?.files).toEqual(expected.files);
  });
});
