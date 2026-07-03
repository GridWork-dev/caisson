// Gate behaviour: an unauthenticated dashboard access redirects to /login. `next/navigation`'s
// `redirect` and `next/headers`'s `headers` are stubbed (this runs outside a Next request scope);
// with no DB/secret configured the better-auth runtime is unavailable, so `getSession` fails
// closed to null and the guard redirects — the same path a real request with no session cookie
// takes.
import { expect, mock, test } from "bun:test";
import * as realNavigation from "next/navigation";

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
}));

// Owner-only write gate (vuln-0006, ADR-0208 #1): owner passes, seat is denied. Unauthenticated is
// the existing null-session case below (the BYOK route 401s / the dashboard redirects before the
// role check is ever reached). Roles today are only owner | seat.
test("isOwner: owner passes, seat denied", async () => {
  const { isOwner } = await import("./auth.ts");
  const base = { userId: "user_1", accountId: "acct_1" } as const;
  expect(isOwner({ ...base, role: "owner" })).toBe(true);
  expect(isOwner({ ...base, role: "seat" })).toBe(false);
});

test("no session → getSession is null, requireDashboardSession redirects to /login", async () => {
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;

  const { getSession, requireDashboardSession } = await import("./auth.ts");

  expect(await getSession()).toBeNull();

  captured.url = null;
  await expect(requireDashboardSession("/dashboard/license")).rejects.toThrow(
    "NEXT_REDIRECT",
  );
  expect(lastRedirect()).toBe("/login?next=%2Fdashboard%2Flicense");
});
