// Route-level proof for `mutationErrorResponse` (post-hardening follow-ups item 1): a `CaissonError`
// thrown by the mutation orchestration (a `NotFoundError` on a nonexistent target account) now
// reaches the operator as its real status/code instead of the old blanket `catch { 500 }`, while
// the existing 401 (no verified session, ADR-0283 `requireAdmin`) and 400 (invalid `.strict()`
// body) paths are unchanged. The orchestration functions are mocked (no live DB); the real Zod
// bodies are kept so the 400 path is exercised for real, not asserted by inspection. Auth state
// comes from the SHARED `admin-auth-mock.ts` fixture (never a second `mock.module` call on
// `admin-auth-server.ts` — see that file's header for why).
import { beforeEach, expect, mock, test } from "bun:test";
import { NotFoundError } from "@caisson/kernel";
// Captured BEFORE `mock.module` swaps the registry entry, so the real `.strict()` bodies (used to
// exercise the 400 path for real below) survive the mock — self-importing the mocked specifier
// from inside its own factory would deadlock on the module still being defined.
import * as realServiceLicense from "@caisson/service-license";
// Same reason: `mock.module` is process-wide (Bun loads every *.test.ts file's top-level code
// before running any test body, so this fires regardless of file execution order) — spreading the
// REAL module means a route added later that imports a function this test doesn't override (e.g.
// `readActiveEntitlementIds`) still gets the real implementation instead of silently `undefined`.
import * as realAdminMutationsRuntime from "@/lib/admin-mutations-runtime";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "@/lib/admin-auth-mock";

mock.module("@/lib/admin-mutations-runtime", () => ({
  ...realAdminMutationsRuntime,
  getAdminMutationDeps: async () => ({}) as never,
  readLicenseForReissue: async () => null,
}));

mock.module("@caisson/service-license", () => ({
  ...realServiceLicense,
  grantEntitlementAdmin: async () => {
    throw new NotFoundError("target account does not exist", {
      targetAccountId: "ghost",
    });
  },
  adjustCreditsAdmin: async () => {
    throw new NotFoundError("target account does not exist", {
      targetAccountId: "ghost",
    });
  },
}));

function postReq(body: unknown): Request {
  return new Request("http://admin.internal/api/admin/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  setAdminAuthFixture();
});

test("grant: nonexistent target account -> 404 not_found, not a blanket 500", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN);
  const { POST } = await import("./entitlement/grant/route.ts");
  const res = await POST(
    postReq({ targetAccountId: "ghost", entitlementIds: ["compliance"] }),
  );
  expect(res.status).toBe(404);
  const body = (await res.json()) as { error: { code: string } };
  expect(body.error.code).toBe("not_found");
});

test("credit adjust: nonexistent target account -> 404 not_found, not a blanket 500", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN);
  const { POST } = await import("./credit/adjust/route.ts");
  const res = await POST(
    postReq({
      targetAccountId: "ghost",
      deltaCredits: 500,
      reason: "billing fix",
    }),
  );
  expect(res.status).toBe(404);
  const body = (await res.json()) as { error: { code: string } };
  expect(body.error.code).toBe("not_found");
});

test("grant: no verified session -> 401 (unchanged)", async () => {
  const { POST } = await import("./entitlement/grant/route.ts");
  const res = await POST(
    postReq({ targetAccountId: "ghost", entitlementIds: ["compliance"] }),
  );
  expect(res.status).toBe(401);
});

test("credit adjust: invalid .strict() body (zero delta) -> 400 (unchanged)", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN);
  const { POST } = await import("./credit/adjust/route.ts");
  const res = await POST(
    postReq({ targetAccountId: "ghost", deltaCredits: 0, reason: "no-op" }),
  );
  expect(res.status).toBe(400);
});
