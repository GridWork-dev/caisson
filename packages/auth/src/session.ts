// The session contract (ADR-0015). better-auth is the chosen runtime provider (self-hosted, owns
// its Drizzle tables); it implements `SessionProvider`. The rest of the base depends only on this
// contract + the verified account token (jwt.ts) — never on a framework. `accountId` here is the
// ONLY value the data layer trusts for RLS (`withTenant`).
import { AuthnError } from "@caisson-sh/kernel";

export type Role = "owner" | "seat";

export interface SessionContext {
  userId: string;
  /** The caller's ACTIVE account/tenant — the value bound into RLS by withTenant. */
  accountId: string;
  role: Role;
}

/** Implemented by the auth runtime (better-auth). Resolves a request to its session, or null. */
export interface SessionProvider {
  resolveSession(request: Request): Promise<SessionContext | null>;
}

/** Guard for protected surfaces — throws 401 when there is no session. */
export function requireSession(ctx: SessionContext | null): SessionContext {
  if (ctx === null) throw new AuthnError();
  return ctx;
}
