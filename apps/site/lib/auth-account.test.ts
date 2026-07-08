// D4 (ADR-0176): getSession resolves the tenant accountId via account_member. With no membership
// row a fresh signed-in user gets a personal account (accountId == userId) created idempotently on
// first resolve — the path every existing single-user tenant takes. better-auth is mocked to a
// fixed session; the DB is the PGlite double (DATABASE_URL unset), which now bootstraps the
// account_member table (lib/db.ts). A separate file from auth.test.ts because the auth-server mock
// here is the opposite of that file's "unavailable runtime" setup.
import { expect, mock, test } from "bun:test";

const USER_ID = "user_d4_test";

// The active-account cookie (G8) — no cookie set in these tests unless a case overrides this mock,
// so `requestedAccountId` resolves to `undefined` and every test below keeps its pre-G8 behavior.
let activeAccountCookie: string | undefined;

mock.module("next/headers", () => ({
  headers: async (): Promise<Headers> => new Headers(),
  cookies: async () => ({
    get: (name: string) =>
      name === "cs_active_account" && activeAccountCookie !== undefined
        ? { name, value: activeAccountCookie }
        : undefined,
  }),
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

test("G8: the active-account cookie switches an invited seat to the org account", async () => {
  delete process.env.DATABASE_URL;
  const { ensurePersonalAccount } = await import("@caisson/auth");
  const { addAccountMember } = await import("@caisson/org-controls");
  const { getDb } = await import("./db.ts");
  const { getSession } = await import("./auth.ts");

  const ORG_ACCOUNT_ID = "org_owner_g8";
  const db = await getDb();
  await ensurePersonalAccount(db, ORG_ACCOUNT_ID);
  await addAccountMember(db, "owner", ORG_ACCOUNT_ID, USER_ID, "seat");

  activeAccountCookie = ORG_ACCOUNT_ID;
  try {
    const session = await getSession();
    expect(session?.accountId).toBe(ORG_ACCOUNT_ID);
    expect(session?.role).toBe("seat");
  } finally {
    activeAccountCookie = undefined;
  }
});

test("G8: a cookie naming an account the user does NOT belong to falls back to personal", async () => {
  delete process.env.DATABASE_URL;
  const { getSession } = await import("./auth.ts");

  activeAccountCookie = "some_other_account_never_joined";
  try {
    const session = await getSession();
    expect(session?.accountId).toBe(USER_ID); // fell back — never crossed tenants
  } finally {
    activeAccountCookie = undefined;
  }
});
