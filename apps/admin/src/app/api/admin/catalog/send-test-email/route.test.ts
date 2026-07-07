// Route-level proof for the catalog's send-test-to-operator action: the session gate (ADR-0283
// `requireAdmin` — a route-level re-verification, never a trusted `x-admin-actor` header), the
// unknown-id 400, the unconfigured-recipient 503, and — with a recipient configured but no
// RESEND_API_KEY (the test-suite default) — the capture-driver 200 that reports `delivered: false`
// rather than pretending a network send happened. Auth state comes from the SHARED
// `admin-auth-mock.ts` fixture (never a second `mock.module` call on `admin-auth-server.ts` — see
// that file's header for why: Bun's `mock.module` is process-wide, and a second registration would
// clobber `admin-session.test.ts`'s).
import { afterEach, beforeEach, expect, test } from "bun:test";
import { setAdminAuthFixture, VERIFIED_ADMIN } from "@/lib/admin-auth-mock";

const ENV_KEYS = [
  "CATALOG_TEST_EMAIL_TO",
  "RESEND_API_KEY",
  "RESEND_FROM",
] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) saved[k] = process.env[k];

beforeEach(() => {
  setAdminAuthFixture();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function postReq(body: unknown): Request {
  return new Request(
    "http://admin.internal/api/admin/catalog/send-test-email",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

test("no verified session -> 401", async () => {
  const { POST } = await import("./route.ts");
  const res = await POST(postReq({ templateId: "waitlist-welcome" }));
  expect(res.status).toBe(401);
});

test("unknown templateId -> 400", async () => {
  setAdminAuthFixture(VERIFIED_ADMIN);
  const { POST } = await import("./route.ts");
  const res = await POST(postReq({ templateId: "not-a-real-template" }));
  expect(res.status).toBe(400);
});

test("CATALOG_TEST_EMAIL_TO unset -> 503, no send attempted", async () => {
  delete process.env.CATALOG_TEST_EMAIL_TO;
  setAdminAuthFixture(VERIFIED_ADMIN);
  const { POST } = await import("./route.ts");
  const res = await POST(postReq({ templateId: "waitlist-welcome" }));
  expect(res.status).toBe(503);
});

test("recipient configured, no RESEND_API_KEY -> 200, delivered:false (captured, not sent)", async () => {
  process.env.CATALOG_TEST_EMAIL_TO = "operator@caisson.sh";
  delete process.env.RESEND_API_KEY;
  setAdminAuthFixture(VERIFIED_ADMIN);
  const { POST } = await import("./route.ts");
  const res = await POST(postReq({ templateId: "waitlist-welcome" }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { ok: boolean; delivered: boolean };
  expect(body.ok).toBe(true);
  expect(body.delivered).toBe(false);
});
