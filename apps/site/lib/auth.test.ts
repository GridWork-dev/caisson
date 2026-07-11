// Gate behaviour: an unauthenticated dashboard access redirects to /login. `next/navigation`'s
// `redirect` and `next/headers`'s `headers` are stubbed (this runs outside a Next request scope),
// and `./auth-server.ts` is mocked so `getAuth()` returns null (the "sign-in runtime unavailable"
// state, i.e. no DB/secret configured), so `getSession` fails closed to null and the guard
// redirects, the same path a real request with no session cookie takes.
//
// Pinning `getAuth` here is REQUIRED for isolation, not a convenience. Bun's `mock.module` registers
// process-wide and is never torn down, so the sibling `auth-account.test.ts` (which mocks this same
// module to a fixed signed-in session) leaks into this file whenever Bun loads it first, and test
// file discovery order is NOT stable across machines. That is exactly what broke under the runner
// migration: the old runner happened to load this file first, the new one loads it second. Mocking
// `getAuth` in this file makes its "no session" contract deterministic regardless of file order,
// instead of depending on the real unconfigured-runtime path surviving that leak.
import { expect, mock, test } from "bun:test";
import * as realNavigation from "next/navigation";
import * as realAuthServer from "./auth-server.ts";

// A holder read through a typed getter: the redirect target is written inside the mock callback,
// which TS control-flow can't observe, so a bare `let` would narrow to `null` at the assertion.
const captured: { url: string | null } = { url: null };
const lastRedirect = (): string | null => captured.url;

// `mock.module` replaces the module in Bun's process-wide registry, not just for this file — a
// factory that returns ONLY `{ redirect }` would leave every OTHER export (e.g. `usePathname`,
// used by client nav components) missing for any later-loaded test that transitively imports the
// real module. Spread the real module first so only `redirect` is actually overridden.
mock.module("next/navigation", () => ({
  ...realNavigation,
  redirect: (url: string): never => {
    captured.url = url;
    throw new Error("NEXT_REDIRECT");
  },
}));

mock.module("next/headers", () => ({
  headers: async (): Promise<Headers> => new Headers(),
  // The active-account cookie (G8) — no cookie in these tests; getSession() short-circuits to
  // null before ever reading it (no DB/secret configured), but `lib/auth.ts` imports `cookies`
  // statically, so the mock module must still export it.
  cookies: async () => ({ get: () => undefined }),
}));

// Pin the sign-in runtime to "unavailable" (see the header note): `getAuth()` returns null, so
// `getSession()` fails closed without ever touching a DB. This must be declared here so it wins over
// `auth-account.test.ts`'s process-wide `./auth-server.ts` mock no matter which file Bun loads first.
// Same full-surface rule as the `next/navigation` mock above: spread the real module so
// later-loaded files (auth-server.test.ts statically imports `createAuth` +
// `SESSION_HINT_COOKIE_NAME`) still see every export — a partial factory is exactly what broke
// CI, where file order differs from local.
mock.module("./auth-server.ts", () => ({
  ...realAuthServer,
  getAuth: (): null => null,
}));

// Owner-only write gate (ADR-0208 #1): owner passes, seat is denied. Unauthenticated is
// the existing null-session case below (the BYOK route 401s / the dashboard redirects before the
// role check is ever reached). Roles today are only owner | seat.
test("isOwner: owner passes, seat denied", async () => {
  const { isOwner } = await import("./auth.ts");
  const base = { userId: "user_1", accountId: "acct_1" } as const;
  expect(isOwner({ ...base, role: "owner" })).toBe(true);
  expect(isOwner({ ...base, role: "seat" })).toBe(false);
});

test("no session → getSession is null, requireDashboardSession redirects to /login", async () => {
  // `getAuth` is mocked to null at the top of this file (the unavailable-runtime state), so this
  // no longer depends on `DATABASE_URL`/`BETTER_AUTH_SECRET` being unset in the process env.
  const { getSession, requireDashboardSession } = await import("./auth.ts");

  expect(await getSession()).toBeNull();

  captured.url = null;
  await expect(requireDashboardSession("/dashboard/license")).rejects.toThrow(
    "NEXT_REDIRECT",
  );
  expect(lastRedirect()).toBe("/login?next=%2Fdashboard%2Flicense");
});
