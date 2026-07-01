// D4 (ADR-0176): getSession resolves the tenant accountId via account_member. With no membership
// row a fresh signed-in user gets a personal account (accountId == userId) created idempotently on
// first resolve — the path every existing single-user tenant takes. better-auth is mocked to a
// fixed session; the DB is the PGlite double (DATABASE_URL unset), which now bootstraps the
// account_member table (lib/db.ts). A separate file from auth.test.ts because the auth-server mock
// here is the opposite of that file's "unavailable runtime" setup.
import { expect, mock, test } from "bun:test";

const USER_ID = "user_d4_test";

mock.module("next/headers", () => ({
  headers: async (): Promise<Headers> => new Headers(),
}));

mock.module("./auth-server.ts", () => ({
  SESSION_COOKIE_NAME: "caisson_session",
  getAuth: () => ({
    api: {
      getSession: async (): Promise<{ user: { id: string } }> => ({
        user: { id: USER_ID },
      }),
    },
  }),
}));

test("getSession resolves a fresh user to their personal account (accountId == userId)", async () => {
  delete process.env.DATABASE_URL; // PGlite double — bootstraps account_member

  const { getSession } = await import("./auth.ts");
  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session?.userId).toBe(USER_ID);
  expect(session?.accountId).toBe(USER_ID); // personal-default via ensurePersonalAccount
  expect(session?.role).toBe("owner");
});
