// The owner-only authz gate (ADR-0176), split out of membership.ts so it can ride the `./browser`
// entry (ADR-0396). Nothing else in this package can: membership.ts value-imports
// @caisson-sh/tenancy-rls (and through it the `pg` driver) for its real Postgres transactions, and
// clerk.ts pulls the `@clerk/backend` SDK — neither belongs in a client bundle. Note the blocker is
// those PACKAGES, not a `node:` builtin: this package's barrel reaches zero node builtins, which is
// exactly why the check has to be a source-graph walk over the whole frontier and not a build.
//
// This module's only value edge is the browser-safe @caisson-sh/kernel barrel; `Role` is a
// STATEMENT-LEVEL type import (erased at emit — @caisson-sh/auth's own barrel is node:crypto-tainted
// through jwt.ts/session-token.ts, so that erasure is load-bearing, and browser-safety.test.ts
// walks the auth barrel as its positive control to keep that fact honest).
import { AuthzError } from "@caisson-sh/kernel";
import type { Role } from "@caisson-sh/auth";

/** Owner-only gate for member/billing management (ADR-0176 — seats cannot manage). */
export function assertCanManageMembers(role: Role): void {
  if (role !== "owner") {
    throw new AuthzError("Only an account owner can manage members or billing");
  }
}
