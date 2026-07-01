// Gate behaviour: an unauthenticated dashboard access redirects to /login. `next/navigation` and
// `next/headers` are mocked (this runs outside a Next request scope); with no DB/secret configured
// the better-auth runtime is unavailable, so `getSession` fails closed to null and the guard
// redirects — the same path a real request with no session cookie takes.
import { expect, mock, test } from "bun:test";

// A holder read through a typed getter: the redirect target is written inside the mock callback,
// which TS control-flow can't observe, so a bare `let` would narrow to `null` at the assertion.
const captured: { url: string | null } = { url: null };
const lastRedirect = (): string | null => captured.url;

mock.module("next/navigation", () => ({
  redirect: (url: string): never => {
    captured.url = url;
    throw new Error("NEXT_REDIRECT");
  },
}));

mock.module("next/headers", () => ({
  headers: async (): Promise<Headers> => new Headers(),
}));

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
