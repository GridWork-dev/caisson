// Route-level proof for `mutationErrorResponse` (post-hardening follow-ups item 1): a `CaissonError`
// thrown by the mutation orchestration (CAISSON-9's `NotFoundError` on a nonexistent target account)
// now reaches the operator as its real status/code instead of the old blanket `catch { 500 }`, while
// the existing 401 (no verified actor) and 400 (invalid `.strict()` body) paths are unchanged. The
// orchestration functions are mocked (no live DB); the real Zod bodies are kept so the 400 path is
// exercised for real, not asserted by inspection.
import { expect, mock, test } from "bun:test";
import { NotFoundError } from "@caisson/kernel";
// Captured BEFORE `mock.module` swaps the registry entry, so the real `.strict()` bodies (used to
// exercise the 400 path for real below) survive the mock — self-importing the mocked specifier
// from inside its own factory would deadlock on the module still being defined.
import * as realServiceLicense from "@caisson/service-license";

mock.module("@/lib/admin-mutations-runtime", () => ({
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

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://admin.internal/api/admin/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("grant: nonexistent target account -> 404 not_found, not a blanket 500", async () => {
  const { POST } = await import("./entitlement/grant/route.ts");
  const res = await POST(
    postReq(
      { targetAccountId: "ghost", entitlementIds: ["compliance"] },
      { "x-admin-actor": "<email>" },
    ),
  );
  expect(res.status).toBe(404);
  const body = (await res.json()) as { error: { code: string } };
  expect(body.error.code).toBe("not_found");
});

test("credit adjust: nonexistent target account -> 404 not_found, not a blanket 500", async () => {
  const { POST } = await import("./credit/adjust/route.ts");
  const res = await POST(
    postReq(
      { targetAccountId: "ghost", deltaCredits: 500, reason: "billing fix" },
      { "x-admin-actor": "<email>" },
    ),
  );
  expect(res.status).toBe(404);
  const body = (await res.json()) as { error: { code: string } };
  expect(body.error.code).toBe("not_found");
});

test("grant: no verified actor -> 401 (unchanged)", async () => {
  const { POST } = await import("./entitlement/grant/route.ts");
  const res = await POST(
    postReq({ targetAccountId: "ghost", entitlementIds: ["compliance"] }),
  );
  expect(res.status).toBe(401);
});

test("credit adjust: invalid .strict() body (zero delta) -> 400 (unchanged)", async () => {
  const { POST } = await import("./credit/adjust/route.ts");
  const res = await POST(
    postReq(
      { targetAccountId: "ghost", deltaCredits: 0, reason: "no-op" },
      { "x-admin-actor": "<email>" },
    ),
  );
  expect(res.status).toBe(400);
});
