// Shared ADR-0283 test fixture for `admin-auth-server.ts`. Bun's `mock.module` replaces a module
// in the PROCESS-WIDE registry for the whole `bun test` run, not scoped to one file — two test
// files independently calling `mock.module` on the SAME resolved module clobber each other
// (whichever registers last silently wins everywhere, including in files that registered first).
// Every test that needs a fake admin session imports `setAdminAuthFixture`/`VERIFIED_ADMIN` from
// HERE instead of calling `mock.module` itself, so there is exactly ONE registration for
// `admin-auth-server.ts` across the whole suite. Not a `.test.ts` file itself (no `test()` calls),
// so bun's test-file glob never picks it up as an (empty) suite.
//
// The mock SPREADS the real module (captured before `mock.module` swaps the registry entry, same
// idiom mutation-error-mapping.test.ts uses for `@caisson/service-license`) rather than replacing
// it outright — `admin-auth-server.pglite.test.ts` needs the REAL `createAdminAuth` from this same
// resolved module, and a replace-not-spread mock would silently drop that export for every file in
// the suite, not just this one.
import { mock } from "bun:test";
import * as realAdminAuthServer from "./admin-auth-server.ts";

export interface FakeAdminAuth {
  api: {
    getSession: () => Promise<{ user: { email: string } } | null>;
    listUserAccounts: () => Promise<
      { providerId: string; accountId: string }[]
    >;
  };
}

let currentAuth: FakeAdminAuth | null = null;
let currentAllowedGithubIds = new Set<string>(["123456"]);

mock.module("./admin-auth-server.ts", () => ({
  ...realAdminAuthServer,
  getAdminAuth: () => currentAuth,
  getAllowedGithubIds: () => currentAllowedGithubIds,
}));

/** A verified session for GitHub numeric id "123456" — on the fixture's default allowlist. */
export const VERIFIED_ADMIN: FakeAdminAuth = {
  api: {
    getSession: async () => ({ user: { email: "op@gridwork.dev" } }),
    listUserAccounts: async () => [
      { providerId: "github", accountId: "123456" },
    ],
  },
};

/**
 * Set the fake `admin-auth-server.ts` state every subsequent `verifyAdminSession`/`requireAdmin`
 * call reads. Call with no args (or from a `beforeEach`) to reset to "unconfigured" between tests.
 */
export function setAdminAuthFixture(
  auth: FakeAdminAuth | null = null,
  allowedGithubIds: Set<string> = new Set(["123456"]),
): void {
  currentAuth = auth;
  currentAllowedGithubIds = allowedGithubIds;
}
