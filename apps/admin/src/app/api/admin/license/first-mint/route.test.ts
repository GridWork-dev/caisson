// ADR-0292 route boundary — the fail-closed guards that run BEFORE any DB work: a request with no
// verified admin session is denied 401 (ADR-0283 `requireAdmin`), an unknown body field is rejected
// 400 by the `.strict()` schema, and the body admits exactly ONE target account. Same auth-mock
// convention as the other admin route tests (never a second `mock.module` registration).
import { beforeEach, describe, expect, test } from "bun:test";
import { FirstMintLicenseBody } from "@caisson/service-license";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "@/lib/admin-auth-mock";

const { POST } = await import("./route.ts");

beforeEach(() => {
  setAdminAuthFixture();
});

function req(body: unknown): Request {
  return new Request("http://admin.local/api/admin/license/first-mint", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const valid = { targetAccountId: "acct_1", major: 1 };

describe("POST /api/admin/license/first-mint (ADR-0292)", () => {
  test("no verified session -> 401 (fails closed before any DB work)", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(401);
  });

  test("an unknown body field -> 400 (the .strict() boundary rejects it)", async () => {
    setAdminAuthFixture(VERIFIED_ADMIN);
    const res = await POST(req({ ...valid, evil: "x" }));
    expect(res.status).toBe(400);
  });

  test("no CAISSON_ADMIN_DB_URL configured -> the PGlite double has no license/entitlement rows, so the entitlement guard 400s (never a 500)", async () => {
    setAdminAuthFixture(VERIFIED_ADMIN);
    const res = await POST(req(valid));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("no active entitlements");
  });

  test("the body carries exactly one target account (one account per call)", () => {
    expect(FirstMintLicenseBody.safeParse(valid).success).toBe(true);
    expect(
      FirstMintLicenseBody.safeParse({ ...valid, targetAccountId: ["a", "b"] })
        .success,
    ).toBe(false);
  });
});
