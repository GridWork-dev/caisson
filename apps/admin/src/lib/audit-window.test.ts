import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import type {
  AnchorSigner,
  RowProof,
  RowProofUnverifiable,
} from "@caisson/audit-worm";
import {
  anchorChain,
  buildChain,
  type AuditChainEntry,
  type ChainVerification,
} from "@caisson/kernel";
import { buildEvidencePack } from "@caisson/kernel/evidence";
import { anchorSignatureEnvelopeBytes } from "@caisson/kernel/audit-verify";
import { assembleProofSuccess, type ProofSuccess } from "./audit-proof.ts";
import {
  ADMIN_AUDIT_PROOF_CONCURRENCY,
  MAX_ADMIN_AUDIT_WINDOW_ENTRIES,
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
    expect(JSON.stringify(window.displayEntries)).not.toContain("secret-a");
    expect(JSON.stringify(window.displayEntries)).not.toContain("secret-b");
    expect(JSON.stringify(window.displayEntries)).toContain("[redacted]");
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

  test("refuses an export when chain-level verification detects truncation", async () => {
    const entries = buildChain([{ event: "first" }, { event: "second" }]);
    const source = sourceFor(entries);

    const window = await buildAdminAuditWindow({
      source: {
        ...source,
        async verify() {
          return { valid: false, brokenAt: entries.length };
        },
      },
      accountId: "11111111-1111-4111-8111-111111111111",
      tenantId: "buyer_account_01",
      now: NOW,
    });

    expect(window.receipts).toHaveLength(2);
    expect(window.verification).toEqual({
      valid: false,
      brokenAt: entries.length,
    });
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

  test("binds a signed export's terminal length and complete receipt set to a pack seal", async () => {
    const entries = buildChain([{ event: "first" }, { event: "second" }]);
    const accountId = "11111111-1111-4111-8111-111111111111";
    const keyId = "test-anchor-key";
    const keyPair = generateKeyPairSync("ed25519");
    const signer: AnchorSigner = {
      keyId,
      async sign(payload) {
        return Uint8Array.from(
          sign(null, Buffer.from(payload), keyPair.privateKey),
        );
      },
    };
    const source = sourceFor(entries);
    const signedSource: AuditProofSource = {
      ...source,
      async getRowProof(requestAccountId, seq) {
        const proof = await source.getRowProof(requestAccountId, seq);
        if ("unverifiable" in proof) return proof;
        const sig = await signer.sign(
          anchorSignatureEnvelopeBytes(proof.anchorForRow, accountId),
        );
        return {
          ...proof,
          anchorForRow: {
            ...proof.anchorForRow,
            sig: Buffer.from(sig).toString("base64"),
            keyId,
            sigV: 2,
            sigAccountId: accountId,
          },
        };
      },
    };

    const window = await buildAdminAuditWindow({
      source: signedSource,
      accountId,
      tenantId: accountId,
      now: NOW,
      anchorAuth: {
        keyId,
        publicKeySpkiBase64: keyPair.publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64"),
      },
      packSigner: signer,
    });

    expect(window.evidencePack).not.toBeNull();
    const receiptsFile = window.evidencePack?.files.find(
      (file) => file.name === "receipts.json",
    );
    const body = JSON.parse(receiptsFile?.contents ?? "{}") as {
      packSeal?: { keyId?: string; accountId?: string; sig?: string };
    };
    expect(body.packSeal).toEqual({
      keyId,
      accountId,
      sig: expect.any(String),
      v: 1,
    });
  });

  test("refuses a signature-claimed export when its anchors are unsigned", async () => {
    const entries = buildChain([{ event: "first" }]);
    const window = await buildAdminAuditWindow({
      source: sourceFor(entries),
      accountId: "11111111-1111-4111-8111-111111111111",
      tenantId: "buyer_account_01",
      now: NOW,
      anchorAuth: {
        keyId: "anchor-v1",
        publicKeySpkiBase64: "cHVibGljLWtleQ==",
      },
    });

    expect(window.rowStatuses).toEqual(["unverifiable"]);
    expect(window.evidencePack).toBeNull();
  });

  test("rejects an oversized chain before starting any per-row WORM proof reads", async () => {
    const entries = buildChain(
      Array.from(
        { length: MAX_ADMIN_AUDIT_WINDOW_ENTRIES + 1 },
        (_, index) => ({ index }),
      ),
    );
    let proofReads = 0;
    const source = sourceFor(entries);

    await expect(
      buildAdminAuditWindow({
        source: {
          ...source,
          async getRowProof(accountId, seq) {
            proofReads += 1;
            return source.getRowProof(accountId, seq);
          },
        },
        accountId: "11111111-1111-4111-8111-111111111111",
        tenantId: "buyer_account_01",
        now: NOW,
      }),
    ).rejects.toThrow(/exceeds the maximum/);
    expect(proofReads).toBe(0);
  });

  test("bounds concurrent per-row WORM proof reads", async () => {
    const entries = buildChain(
      Array.from({ length: ADMIN_AUDIT_PROOF_CONCURRENCY * 2 }, (_, index) => ({
        index,
      })),
    );
    const source = sourceFor(entries);
    let active = 0;
    let maxActive = 0;

    await buildAdminAuditWindow({
      source: {
        ...source,
        async getRowProof(accountId, seq) {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 2));
          try {
            return await source.getRowProof(accountId, seq);
          } finally {
            active -= 1;
          }
        },
      },
      accountId: "11111111-1111-4111-8111-111111111111",
      tenantId: "buyer_account_01",
      now: NOW,
    });

    expect(maxActive).toBeLessThanOrEqual(ADMIN_AUDIT_PROOF_CONCURRENCY);
  });
});
