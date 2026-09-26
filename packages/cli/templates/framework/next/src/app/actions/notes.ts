// Server Action example for `@caisson-sh/tenancy-rls`: tenant context is bound PER CALL inside
// `withTenant` — never cached across requests. The session's `accountId` (never a client-supplied
// param) is the only value trusted for tenant scoping; RLS on the `notes` table does the rest
// (fail-closed — a query outside `withTenant` sees nothing, ADR-0005). Server Actions never
// receive a `Request`, so the session comes off `next/headers`'s cookie jar instead of
// `resolveSessionFromRequest`.
"use server";

import { cookies } from "next/headers";
import { requireSession } from "@caisson-sh/auth";
import { withTenant } from "@caisson-sh/tenancy-rls";
import { SESSION_COOKIE, verifySessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export interface Note {
  id: string;
  body: string;
}

/** Illustrative — add a migration for a `notes(id, account_id, body, created_at)` table (with
 *  `@caisson-sh/tenancy-rls`'s `buildTenantPolicySql("notes")` RLS policy) before this runs for real. */
export async function listNotes(): Promise<Note[]> {
  const jar = await cookies();
  const session = requireSession(
    verifySessionToken(jar.get(SESSION_COOKIE)?.value),
  );
  return withTenant(db, session.accountId, async (tx) => {
    const { rows } = await tx.query<Note>(
      "SELECT id, body FROM notes ORDER BY created_at DESC LIMIT 20",
    );
    return rows;
  });
}
