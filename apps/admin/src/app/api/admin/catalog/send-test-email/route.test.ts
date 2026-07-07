// Route-level proof for the catalog's send-test-to-operator action: the actor gate, the unknown-id
// 400, the unconfigured-recipient 503, and — with a recipient configured but no RESEND_API_KEY (the
// test-suite default) — the capture-driver 200 that reports `delivered: false` rather than pretending
// a network send happened.
import { afterEach, expect, test } from "bun:test";

const ENV_KEYS = [
  "CATALOG_TEST_EMAIL_TO",
  "RESEND_API_KEY",
  "RESEND_FROM",
] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) saved[k] = process.env[k];

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(
    "http://admin.internal/api/admin/catalog/send-test-email",
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  );
}

test("no verified actor -> 401", async () => {
  const { POST } = await import("./route.ts");
  const res = await POST(postReq({ templateId: "waitlist-welcome" }));
  expect(res.status).toBe(401);
});

test("unknown templateId -> 400", async () => {
  const { POST } = await import("./route.ts");
  const res = await POST(
    postReq(
      { templateId: "not-a-real-template" },
      { "x-admin-actor": "<email>" },
    ),
  );
  expect(res.status).toBe(400);
});

test("CATALOG_TEST_EMAIL_TO unset -> 503, no send attempted", async () => {
  delete process.env.CATALOG_TEST_EMAIL_TO;
  const { POST } = await import("./route.ts");
  const res = await POST(
    postReq(
      { templateId: "waitlist-welcome" },
      { "x-admin-actor": "<email>" },
    ),
  );
  expect(res.status).toBe(503);
});

test("recipient configured, no RESEND_API_KEY -> 200, delivered:false (captured, not sent)", async () => {
  process.env.CATALOG_TEST_EMAIL_TO = "operator@caisson.sh";
  delete process.env.RESEND_API_KEY;
  const { POST } = await import("./route.ts");
  const res = await POST(
    postReq(
      { templateId: "waitlist-welcome" },
      { "x-admin-actor": "<email>" },
    ),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { ok: boolean; delivered: boolean };
  expect(body.ok).toBe(true);
  expect(body.delivered).toBe(false);
});
