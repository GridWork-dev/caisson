// G40 route boundary — the fail-closed guards that run BEFORE any DB work: a request with no
// verified admin session is denied 401 (ADR-0283 `requireAdmin`), an unknown body field is rejected
// 400 by the `.strict()` schema. Same auth-mock convention as the other admin route tests. The
// full mutation path (dual-log, notifyPurchaseEmail never-throws) is covered on a real PGlite
// double by `services/license/src/admin-mutations.integration.test.ts` — deliberately NOT
// re-exercised here through `getAdminMutationDeps()`, which `mutation-error-mapping.test.ts`
// process-wide-mocks to a broken stub for its OWN purposes (Bun's `mock.module` applies for the
// rest of the test process regardless of file load order); every other admin route test in this
// app stops at the same route-boundary scope for the identical reason.
import { beforeEach, describe, expect, test } from "bun:test";
import { ResendPurchaseEmailBody } from "@caisson/service-license";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "@/lib/admin-auth-mock";

const { POST } = await import("./route.ts");

beforeEach(() => {
  setAdminAuthFixture();
});

function req(body: unknown): Request {
  return new Request("http://admin.local/api/admin/email/resend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const valid = { targetAccountId: "acct_1" };

describe("POST /api/admin/email/resend (G40)", () => {
  test("no verified session -> 401 (fails closed before any DB work)", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(401);
  });

  test("an unknown body field -> 400 (the .strict() boundary rejects it)", async () => {
    setAdminAuthFixture(VERIFIED_ADMIN);
    const res = await POST(req({ ...valid, evil: "x" }));
    expect(res.status).toBe(400);
  });

  test("the body carries exactly one target account (one account per call)", () => {
    expect(ResendPurchaseEmailBody.safeParse(valid).success).toBe(true);
    expect(
      ResendPurchaseEmailBody.safeParse({
        ...valid,
        targetAccountId: ["a", "b"],
      }).success,
    ).toBe(false);
  });
});
