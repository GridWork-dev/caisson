// ADR-0225 route boundary — the fail-closed guards that run BEFORE any DB work: a request with no
// verified CF-Access actor is denied 401, an unknown body field is rejected 400 by the `.strict()`
// schema, and the body admits exactly ONE target account (no batch field to widen the RLS bound).
import { describe, expect, test } from "bun:test";
import { RevokePurchaseBody } from "@caisson/service-license";
import { POST } from "./route.ts";

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(
    "http://admin.local/api/admin/entitlement/revoke-purchase",
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  );
}

const valid = {
  targetAccountId: "acct_1",
  purchaseId: "pay_1",
  clawUnspentCredits: true,
  revokeEdgeAccess: true,
};

describe("POST /api/admin/entitlement/revoke-purchase (ADR-0225)", () => {
  test("no x-admin-actor → 401 (fails closed before any DB work)", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(401);
  });

  test("an unknown body field → 400 (the .strict() boundary rejects it)", async () => {
    const res = await POST(
      req({ ...valid, evil: "x" }, { "x-admin-actor": "<email>" }),
    );
    expect(res.status).toBe(400);
  });

  test("the body carries exactly one target account (one account per call)", () => {
    // A single string targetAccountId is required; there is no array/batch field to widen the bound.
    expect(RevokePurchaseBody.safeParse(valid).success).toBe(true);
    expect(
      RevokePurchaseBody.safeParse({ ...valid, targetAccountId: ["a", "b"] })
        .success,
    ).toBe(false);
  });
});
