// T-A2 (pure core) — the security-critical proof-assembly invariants, tested without a PGlite/WORM/
// auth harness: server-side redaction (H3), the receipt shape (L2 no WORM key + CR-06 raw material),
// the redacted-row honest marking (leg 1 `na`), and strict-both-ways schema behavior.
import { describe, expect, test } from "bun:test";
import { anchorChain, chainEntry } from "@caisson/kernel";
import type { RowProof } from "@caisson/audit-worm";
import {
  assembleProofSuccess,
  AuditProofQuery,
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

  test("L2 — the receipt omits the internal WORM object key (length + tipHash only)", async () => {
    const body = await assembleProofSuccess(proofFor({ event: "locked" }), NOW);
    expect(Object.keys(body.receipt.anchor).sort()).toEqual([
      "length",
      "tipHash",
    ]);
    expect("key" in body.receipt.anchor).toBe(false);
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
    expect(body.redactedPaths).toEqual(["password", "token"]);
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
});

describe("strict schemas (binding #6)", () => {
  test("the query rejects unknown fields, non-uuid account, and non-integer seq", () => {
    const account = "11111111-1111-4111-8111-111111111111"; // valid v4/variant UUID
    expect(AuditProofQuery.safeParse({ account, seq: "0" }).success).toBe(true);
    expect(AuditProofQuery.safeParse({ account, seq: "3" }).success).toBe(true);
    expect(
      AuditProofQuery.safeParse({ account, seq: "0", evil: "x" }).success,
    ).toBe(false);
    expect(
      AuditProofQuery.safeParse({ account: "not-a-uuid", seq: "0" }).success,
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
