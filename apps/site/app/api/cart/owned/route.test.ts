// ADR-0424 regression: real Better Auth durable cookies, optional hint independently absent.
import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { createCaptureEmailer } from "@caisson/email";
import type { Pool } from "pg";
import { createAuth, SESSION_HINT_COOKIE_NAME } from "@/lib/auth-server";
import { cartOwnedHandler } from "@/lib/cart-routes";

async function fixture() {
  const database = new Database(":memory:");
  const emailer = createCaptureEmailer();
  const auth = await createAuth({
    database: database as unknown as Pool,
    secret: "test-secret-value-at-least-32-characters-long",
    hmacKey: "test-hmac-key-value-at-least-32-characters-long",
    emailer,
    baseURL: "http://localhost:3030",
  });
  const { runMigrations } = await getMigrations({ ...auth.options, database });
  await runMigrations();
  await auth.api.signInMagicLink({
    body: { email: "buyer@example.com" },
    headers: new Headers(),
  });
  const url = String((emailer.sent[0]!.data as { url: string }).url);
  const verified = await auth.handler(new Request(url));
  const cookies = verified.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0]!);
  let reads = 0;
  const handler = cartOwnedHandler({
    session: async (request) => {
      const session = await auth.api.getSession({ headers: request.headers });
      return session
        ? { userId: session.user.id, accountId: session.user.id, role: "owner" }
        : null;
    },
    owned: async () => {
      reads++;
      return new Set(["module:field-crypto"]);
    },
  });
  const request = (values: string[]) =>
    new Request("http://localhost:3030/api/cart/owned", {
      headers: { cookie: values.join("; ") },
    });
  return { database, handler, cookies, request, reads: () => reads };
}

test("valid durable session without a hint returns owned items", async () => {
  const f = await fixture();
  try {
    const response = await f.handler(
      f.request(
        f.cookies.filter((c) => !c.startsWith(`${SESSION_HINT_COOKIE_NAME}=`)),
      ),
    );
    expect(await response.json()).toEqual({ owned: ["module:field-crypto"] });
    expect(f.reads()).toBe(1);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  } finally {
    f.database.close();
  }
});

test("independently evicting the hint leaves a durable session ownership read intact", async () => {
  const f = await fixture();
  try {
    expect(await (await f.handler(f.request(f.cookies))).json()).toEqual({
      owned: ["module:field-crypto"],
    });
    // Browser evicts an expired optional hint while retaining the still-valid session token.
    const withoutHint = f.cookies.filter(
      (c) => !c.startsWith(`${SESSION_HINT_COOKIE_NAME}=`),
    );
    expect(await (await f.handler(f.request(withoutHint))).json()).toEqual({
      owned: ["module:field-crypto"],
    });
    expect(f.reads()).toBe(2);
  } finally {
    f.database.close();
  }
});

test("forged hint without a durable session grants no ownership", async () => {
  const f = await fixture();
  try {
    expect(
      await (
        await f.handler(f.request([`${SESSION_HINT_COOKIE_NAME}=1`]))
      ).json(),
    ).toEqual({ owned: [] });
    expect(f.reads()).toBe(0);
  } finally {
    f.database.close();
  }
});

test("production owned route binds the real session and scoped entitlement reader", async () => {
  const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();
  expect(source).toContain("session: getSession");
  expect(source).toContain("owned: getOwnedCartItemIdsForAccount");
  expect(source).not.toContain("SESSION_HINT_COOKIE_NAME");
});
