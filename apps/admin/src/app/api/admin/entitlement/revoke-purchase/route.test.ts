// ADR-0225 route boundary — the fail-closed guards that run BEFORE any DB work: a request with no
// verified admin session is denied 401 (ADR-0283 `requireAdmin` — a route-level re-verification,
// never a trusted `x-admin-actor` header), an unknown body field is rejected 400 by the `.strict()`
// schema, and the body admits exactly ONE target account (no batch field to widen the RLS bound).
// Auth state comes from the SHARED `admin-auth-mock.ts` fixture (never a second `mock.module` call
// on `admin-auth-server.ts` here — see that file's header for why: Bun's `mock.module` is
// process-wide, and a second registration would clobber `admin-session.test.ts`'s).
import { beforeEach, describe, expect, test } from "bun:test";
import { RevokePurchaseBody } from "@caisson/service-license";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "@/lib/admin-auth-mock";

const { POST } = await import("./route.ts");

beforeEach(() => {
  setAdminAuthFixture();
});

function req(body: unknown): Request {
  return new Request(
    "http://admin.local/api/admin/entitlement/revoke-purchase",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
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
  test("no verified session → 401 (fails closed before any DB work)", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(401);
  });

  test("an unknown body field → 400 (the .strict() boundary rejects it)", async () => {
    setAdminAuthFixture(VERIFIED_ADMIN);
    const res = await POST(req({ ...valid, evil: "x" }));
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
