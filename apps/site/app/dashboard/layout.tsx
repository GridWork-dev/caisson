// The buyer dashboard route group (ADR-0114): authed, force-dynamic, tenant-scoped. Every
// `/dashboard/**` route is gated here — `requireDashboardSession` redirects to `/login` before
// any child route renders, so a child page never has to re-check auth itself.
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Suspense, type ReactNode } from "react";
import { Button, Select } from "@caisson/ui/components";
import { DashboardShell } from "@/components/dashboard-shell";
import { PostHogInit } from "@/components/posthog-init";
import {
  ACTIVE_ACCOUNT_COOKIE,
  getAccountMemberships,
  requireDashboardSession,
} from "@/lib/auth";

// Never statically cached — a tenant's dashboard must not be served from a shared cache (no
// cross-tenant leak). `force-dynamic` also forces every child route dynamic.
export const dynamic = "force-dynamic";

/**
 * Set the active-account cookie (G8) and reload the dashboard so `getSession` re-resolves against
 * it. `accountId` is never trusted as-is: `selectActiveAccount` only matches it against the
 * signed-in user's OWN verified memberships (user-scoped RLS), so posting an id the caller doesn't
 * belong to just falls back to their personal account — the cookie is a preference, not a grant.
 */
async function switchAccountAction(formData: FormData): Promise<void> {
  "use server";
  // Auth-gates the action (redirects to /login if the session died mid-page); the return value
  // itself is unneeded — the cookie carries only a PREFERENCE, re-verified against the caller's
  // own memberships on every subsequent read (see the cookie's doc comment in lib/auth.ts).
  await requireDashboardSession("/dashboard");
  const accountId = formData.get("accountId");
  if (typeof accountId !== "string" || accountId.trim().length === 0) return;
  const jar = await cookies();
  jar.set(ACTIVE_ACCOUNT_COOKIE, accountId.trim(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard");
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireDashboardSession("/dashboard");
  const memberships = await getAccountMemberships(session.userId);

  const topBar = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--cs-space-3)",
      }}
    >
      {memberships.length > 1 ? (
        // Only surfaced once the user actually has more than one account to switch between (G8) —
        // e.g. an invited org seat, previously stuck on their personal account with no way to
        // reach the org they were added to.
        <form
          action={switchAccountAction}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--cs-space-2)",
            margin: 0,
          }}
        >
          <Select
            name="accountId"
            aria-label="Active account"
            defaultValue={session.accountId}
            options={memberships.map((m) => ({
              value: m.accountId,
              label:
                m.accountId === session.userId
                  ? `${m.accountId} (personal)`
                  : m.accountId,
            }))}
          />
          <Button type="submit" variant="ghost" size="sm">
            Switch
          </Button>
        </form>
      ) : (
        <span
          className="cs-muted"
          style={{
            fontSize: "var(--cs-text-xs)",
            fontFamily: "var(--cs-font-mono)",
          }}
        >
          {session.accountId}
        </span>
      )}
      <form action="/api/auth/sign-out" method="post" style={{ margin: 0 }}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </div>
  );

  return (
    <>
      {/* PostHog product analytics — authed dashboard only (never the cookieless marketing site).
          No-op until NEXT_PUBLIC_POSTHOG_KEY is set on the caisson-site service. Suspense is the
          Next.js App Router requirement for PostHogInit's internal useSearchParams (manual
          $pageview) — force-dynamic above does not remove it. */}
      <Suspense fallback={null}>
        <PostHogInit accountId={session.accountId} />
      </Suspense>
      <DashboardShell topBar={topBar}>{children}</DashboardShell>
    </>
  );
}
