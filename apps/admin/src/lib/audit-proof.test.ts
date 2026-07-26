// T-A2 (pure core) — the security-critical proof-assembly invariants, tested without a PGlite/WORM/
// auth harness: server-side redaction (H3), the receipt shape (L2 no WORM key + CR-06 raw material),
// the redacted-row honest marking (leg 1 `na`), and strict-both-ways schema behavior.
import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { anchorChain, chainEntry } from "@caisson/kernel";
import { anchorSignatureEnvelopeBytes } from "@caisson/kernel/audit-verify";
import type { AuditChainAnchor } from "@caisson/kernel";
import type { RowProof } from "@caisson/audit-worm";
import {
  assembleProofSuccess,
  AuditProofQuery,
  parseProofResponse,
  ProofSuccessSchema,
  ProofUnverifiableSchema,
} from "./audit-proof.ts";

/** A one-entry RowProof over `payload` — a real genesis entry + its real per-length anchor, so leg 1
 *  (link recompute) and leg 2 (anchor-tip equality) both genuinely pass for a non-redacted payload. */
function proofFor(payload: Parameters<typeof chainEntry>[1]): RowProof {
  const entry = chainEntry(null, payload);
  const anchor = anchorChain([entry]);
  return { entry, anchorForRow: anchor, chainLength: 1 };
}

/** A RowProof whose anchor is signed with an ephemeral Ed25519 key (GATE-1) — proves the signature
 *  provenance crosses the wire so the client can run its own signature leg. */
function signedProofFor(payload: Parameters<typeof chainEntry>[1]): RowProof {
  const base = proofFor(payload);
  const { privateKey } = generateKeyPairSync("ed25519");
  const sigAccountId = "11111111-1111-4111-8111-111111111111";
  const sig = nodeSign(
    null,
    Buffer.from(anchorSignatureEnvelopeBytes(base.anchorForRow, sigAccountId)),
    privateKey,
  ).toString("base64");
  const anchor: AuditChainAnchor = {
    ...base.anchorForRow,
    sig,
    keyId: "test-anchor-key",
    sigV: 2,
    sigAccountId,
  };
  return { ...base, anchorForRow: anchor };
}

const NOW = new Date("2026-07-13T00:00:00.000Z");

describe("assembleProofSuccess — a clean (non-redacted) row", () => {
  test("both legs pass and the receipt carries raw material sufficient to recompute", async () => {
    const proof = proofFor({ event: "created", actor: "op" });
    const body = await assembleProofSuccess(proof, NOW);

    expect(body.redacted).toBe(false);
    expect(body.redactedPaths).toBeUndefined();
    expect(body.receipt.checks.linkRecompute).toBe("pass");
    expect(body.receipt.checks.anchorEquality).toBe("pass");
    // CR-06 raw material: prevHash + the (unredacted) payload are present for a client to recompute.
    expect(body.receipt.raw.prevHash).toBeNull();
    expect(body.receipt.raw.payload).toEqual({ event: "created", actor: "op" });
    expect(body.receipt.hash).toBe(proof.entry.hash);
    expect(body.receipt.anchor.tipHash).toBe(proof.anchorForRow.tipHash);
  });

  test("L2 — the receipt never exports the internal WORM object key (only public commitment fields)", async () => {
    const proof = proofFor({ event: "locked" });
    const body = await assembleProofSuccess(proof, NOW);
    // The internal WORM key is NEVER exported (L2) — that is the invariant, not the exact field set.
    expect("key" in body.receipt.anchor).toBe(false);
    // Only public commitment/provenance fields cross the wire: length + tipHash, plus genesisHash and
    // (when signed) sig/keyId — the client needs the latter to run its own signature leg (GATE-1).
    const allowed = [
      "length",
      "tipHash",
      "genesisHash",
      "sig",
      "keyId",
      "sigV",
      "sigAccountId",
    ];
    expect(
      Object.keys(body.receipt.anchor).every((k) => allowed.includes(k)),
    ).toBe(true);
    expect(body.receipt.anchor.length).toBe(1);
    expect(body.receipt.anchor.tipHash).toBe(proof.anchorForRow.tipHash);
  });

  test("GATE-1 — a signed anchor's sig + keyId cross the wire so the client can check them", async () => {
    const proof = signedProofFor({ event: "locked" });
    const body = await assembleProofSuccess(proof, NOW);
    // The public signature material is present in the receipt (never the private key, never the WORM key).
    expect(body.receipt.anchor.sig).toBe(proof.anchorForRow.sig);
    expect(body.receipt.anchor.keyId).toBe("test-anchor-key");
    expect(body.receipt.anchor.sigV).toBe(2);
    expect(body.receipt.anchor.sigAccountId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect("key" in body.receipt.anchor).toBe(false);
    // The outgoing body still strict-validates with the additive provenance fields present.
    expect(ProofSuccessSchema.safeParse(body).success).toBe(true);
  });

  test("the strict client parser preserves v2 signature identity end to end", async () => {
    const body = await assembleProofSuccess(
      signedProofFor({ event: "locked" }),
      NOW,
    );

    const parsed = parseProofResponse(body);

    expect("receipt" in parsed).toBe(true);
    if ("receipt" in parsed) {
      expect(parsed.receipt.anchor.sigV).toBe(2);
      expect(parsed.receipt.anchor.sigAccountId).toBe(
        "11111111-1111-4111-8111-111111111111",
      );
    }
  });

  test("the strict response boundary rejects unsupported receipt versions", async () => {
    const body = await assembleProofSuccess(
      signedProofFor({ event: "locked" }),
      NOW,
    );

    expect(
      ProofSuccessSchema.safeParse({
        ...body,
        receipt: { ...body.receipt, v: 2 },
      }).success,
    ).toBe(false);
  });
});

describe("assembleProofSuccess — H3 server-side redaction", () => {
  test("secret values never appear in the body or receipt; leg 1 is `na`", async () => {
    const proof = proofFor({
      user: "alice",
      password: "hunter2",
      nested: { token: "s3cr3t-token", keep: "ok" },
    });
    const body = await assembleProofSuccess(proof, NOW);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("s3cr3t-token");

    expect(body.redacted).toBe(true);
    expect(body.redactedPaths).toEqual(["nested.token", "password"]);
    // The masked payload is what crosses the wire; the original is gone.
    expect(body.receipt.raw.payload).toEqual({
      user: "alice",
      password: "[redacted]",
      nested: { token: "[redacted]", keep: "ok" },
    });
    // Redacted -> the client can't recompute the original hash, so leg 1 is honestly `na`, not `fail`.
    expect(body.receipt.checks.linkRecompute).toBe("na");
    // Leg 2 still holds: the anchor commits to the ORIGINAL hash, which the entry still carries.
    expect(body.receipt.checks.anchorEquality).toBe("pass");
    expect(body.receipt.redacted).toBe(true);
  });

  test("reports a repeated nested secret as one distinct key path", async () => {
    const proof = proofFor({
      rows: [
        { credentials: { token: "first" } },
        { credentials: { token: "second" } },
      ],
    });

    const body = await assembleProofSuccess(proof, NOW);

    expect(body.redactedPaths).toEqual(["rows.credentials.token"]);
  });

  test("redacts nested camelCase and snake_case compound credential keys at the admin proof boundary", async () => {
    const proof = proofFor({
      integrations: {
        serviceCredentials: {
          accessToken: "camel-access-secret",
          safeLabel: "primary",
        },
        api_credentials: {
          refresh_token: "snake-refresh-secret",
          safeLabel: "backup",
        },
      },
    });

    const body = await assembleProofSuccess(proof, NOW);
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("camel-access-secret");
    expect(serialized).not.toContain("snake-refresh-secret");
    expect(body.redacted).toBe(true);
    expect(body.redactedPaths).toEqual([
      "integrations.api_credentials.refresh_token",
      "integrations.serviceCredentials.accessToken",
    ]);
    expect(body.receipt.raw.payload).toEqual({
      integrations: {
        serviceCredentials: {
          accessToken: "[redacted]",
          safeLabel: "primary",
        },
        api_credentials: {
          refresh_token: "[redacted]",
          safeLabel: "backup",
        },
      },
    });
  });

  test("redacts a credential-shaped span stored under a benign key", async () => {
    const proof = proofFor({
      note: "provider returned sk-proj-abcdefghijklmnop during setup",
    });

    const body = await assembleProofSuccess(proof, NOW);
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("sk-proj-abcdefghijklmnop");
    expect(body.redacted).toBe(true);
    expect(body.redactedPaths).toEqual(["note"]);
  });
});

describe("strict schemas (binding #6)", () => {
  test("the query accepts opaque ids and rejects unknown fields, unsafe accounts, and non-integer seq", () => {
    const account = "11111111-1111-4111-8111-111111111111"; // valid v4/variant UUID
    const opaqueAccount = "k5G2mB9qL0xWc4vRt7nYs1uZp8dJh3fA";
    expect(AuditProofQuery.safeParse({ account, seq: "0" }).success).toBe(true);
    expect(
      AuditProofQuery.safeParse({ account: opaqueAccount, seq: "0" }).success,
    ).toBe(true);
    expect(AuditProofQuery.safeParse({ account, seq: "3" }).success).toBe(true);
    expect(
      AuditProofQuery.safeParse({ account, seq: "0", evil: "x" }).success,
    ).toBe(false);
    expect(
      AuditProofQuery.safeParse({ account: "../../etc/passwd", seq: "0" })
        .success,
    ).toBe(false);
    expect(AuditProofQuery.safeParse({ account, seq: "1.5" }).success).toBe(
      false,
    );
    expect(AuditProofQuery.safeParse({ account, seq: "-1" }).success).toBe(
      false,
    );
    expect(AuditProofQuery.safeParse({ account, seq: "abc" }).success).toBe(
      false,
    );
  });

  test("strict OUT — an unknown response field is rejected on the way out", async () => {
    const body = await assembleProofSuccess(proofFor({ event: "x" }), NOW);
    expect(ProofSuccessSchema.safeParse(body).success).toBe(true);
    expect(
      ProofSuccessSchema.safeParse({ ...body, sneaky: true }).success,
    ).toBe(false);
    expect(
      ProofUnverifiableSchema.safeParse({
        state: "unverifiable",
        reason: "gone",
      }).success,
    ).toBe(true);
    expect(
      ProofUnverifiableSchema.safeParse({
        state: "unverifiable",
        reason: "gone",
        extra: 1,
      }).success,
    ).toBe(false);
  });
});
