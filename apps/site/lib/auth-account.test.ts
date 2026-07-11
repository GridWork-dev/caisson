// D4 (ADR-0176): getSession resolves the tenant accountId via account_member. With no membership
// row a fresh signed-in user gets a personal account (accountId == userId) created idempotently on
// first resolve — the path every existing single-user tenant takes. better-auth is mocked to a
// fixed session; the DB is the PGlite double (DATABASE_URL unset), which now bootstraps the
// account_member table (lib/db.ts). A separate file from auth.test.ts because the auth-server mock
// here is the opposite of that file's "unavailable runtime" setup.
import { expect, mock, test } from "bun:test";
import * as realAuthServer from "./auth-server.ts";

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

// `mock.module` is process-wide and never torn down, so this factory MUST return the module's
// full export surface — a partial `{ SESSION_COOKIE_NAME, getAuth }` object gutted `createAuth`/
// `SESSION_HINT_COOKIE_NAME` for every later-loaded file (auth-server.test.ts's static import
// then throws "Export named ... not found"; file order is machine-dependent, so it only broke on
// CI). Spread the real module and override only `getAuth`. If a sibling's mock loaded first,
// `realAuthServer` IS that mock — safe, because every mocker of this module spreads the same way.
mock.module("./auth-server.ts", () => ({
  ...realAuthServer,
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

test("G16: getOwnedCartItemIds maps an active entitlement grant to its catalog cart id", async () => {
  delete process.env.DATABASE_URL;
  const { getDb } = await import("./db.ts");
  const { getOwnedCartItemIds } = await import("./owned-cart-items.ts");

  // USER_ID's personal account (bootstrapped by the first test above) owns field-crypto — seeded
  // directly (bypasses RLS, same pattern as members-gate.test.ts's seedGrant) since this is a
  // fixture write, not the code path under test.
  const db = await getDb();
  await db.transaction((tx) =>
    tx.exec(
      `INSERT INTO entitlement_grant
         (id, account_id, entitlement_id, source_kind, purchase_id, source_event_id, status)
       VALUES
         ('grant_g16_test', '${USER_ID}', 'field-crypto', 'one_time', 'pi_g16', 'evt_g16', 'active')
       ON CONFLICT (id) DO NOTHING`,
    ),
  );

  const owned = await getOwnedCartItemIds();
  expect(owned.has("module:field-crypto")).toBe(true);
  expect(owned.has("module:audit-worm")).toBe(false); // not granted — stays un-owned
});
